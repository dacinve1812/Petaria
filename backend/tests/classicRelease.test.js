const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const express=require('express');
const mysql=require('mysql2/promise');
const {createClassicBattle,validateAction}=require('../services/classicBattle');
const {createClassicAuth}=require('../routes/classicAuth');
require('dotenv').config({path:require('path').resolve(__dirname,'../../.env')});

test('reject stale turns, unowned items and wrong equipment type',()=>{
 const state={turn_count:2,equipment:[{id:3,durability_left:10,equipment_type:'shield'}]};
 assert.equal(validateAction(state,{action:'defend_shield',itemId:3,expectedTurn:2}),null);
 assert.ok(validateAction(state,{action:'defend_shield',itemId:99,expectedTurn:2}));
 assert.ok(validateAction(state,{action:'attack_item',itemId:3,expectedTurn:2}));
 assert.ok(validateAction(state,{action:'defend_basic',expectedTurn:1}));
 assert.ok(validateAction(state,{action:'invented',expectedTurn:2}));
});

test('isolated MySQL: atomic rewards, concurrent retries, account registration and recovery',async()=>{
 const schema='petaria_classic_test_'+crypto.randomBytes(6).toString('hex');
 const config={host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''};
 const admin=await mysql.createConnection(config);let db,server;
 try{
  await admin.query(`CREATE DATABASE \`${schema}\``);
  db=mysql.createPool({...config,database:schema,connectionLimit:8});
  const statements=[
   'CREATE TABLE users(id INT PRIMARY KEY AUTO_INCREMENT,username VARCHAR(100) UNIQUE,password VARCHAR(100),role VARCHAR(20),peta INT DEFAULT 0)',
   'CREATE TABLE user_profiles(user_id INT PRIMARY KEY,display_name VARCHAR(100),avatar_url TEXT)',
   'CREATE TABLE account_security(user_id INT PRIMARY KEY,email VARCHAR(254) UNIQUE,password2_hash VARCHAR(100),email_verified TINYINT DEFAULT 0,token_version INT DEFAULT 0)',
   'CREATE TABLE account_email_tokens(token_hash CHAR(64) PRIMARY KEY,user_id INT,purpose VARCHAR(20),expires_at DATETIME,used_at DATETIME)',
   'CREATE TABLE arena_match_receipts(match_id VARCHAR(36) PRIMARY KEY,user_id INT,pet_id INT,result_json JSON,finished_at DATETIME)',
   'CREATE TABLE pets(id INT PRIMARY KEY,owner_id INT,current_exp INT,level INT,current_hp INT,hp INT,battles_won INT DEFAULT 0,battles_lost INT DEFAULT 0,hunger_status INT DEFAULT 10,hunger_battles INT DEFAULT 0)',
   'CREATE TABLE boss_templates(id INT PRIMARY KEY,drop_table JSON)',
   'CREATE TABLE items(id INT PRIMARY KEY,name VARCHAR(50),type VARCHAR(20),image_url VARCHAR(100))',
   'CREATE TABLE equipment_data(item_id INT,durability_max INT)',
   'CREATE TABLE inventory(id INT AUTO_INCREMENT PRIMARY KEY,player_id INT,item_id INT,quantity INT,is_equipped INT,durability_left INT)'
  ];for(const sql of statements)await db.query(sql);
  await db.query("INSERT INTO users(id,username,password,role) VALUES(1,'battle_fixture','test','user')");
  await db.query('INSERT INTO pets(id,owner_id,current_exp,level,current_hp,hp) VALUES(1,1,0,1,100,100)');
  await db.query('INSERT INTO boss_templates VALUES(1,?)',[JSON.stringify([{item_id:0,quantity:25},{item_id:7,quantity:2}])]);
  await db.query("INSERT INTO items VALUES(7,'Potion','food','')");
  const service=createClassicBattle({db,calculateLoot:x=>x,calculateBattleExpGain:()=>1,titleService:{recordPetaEarned:async()=>{},recordHuntWin:async()=>{}}});
  let inFlight=0,maxInFlight=0;
  const serialized=service.serialize(async()=>{inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);await new Promise(r=>setTimeout(r,15));inFlight--;});
  await Promise.all([serialized({classicUserId:schema},{}),serialized({classicUserId:schema},{})]);
  assert.equal(maxInFlight,1);
  const state={userId:1,pet_id:1,boss_id:1,boss_level:1,player:{current_hp:73,final_stats:{hp:100}},enemy:{name:'Fixture'},equipment:[]};
  await service.register(state);
  const retries=Array.from({length:4},()=>JSON.parse(JSON.stringify(state)));
  await Promise.all(retries.map(s=>service.finalize(s,'player')));
  const [[pet]]=await db.query('SELECT * FROM pets WHERE id=1');
  const [[user]]=await db.query('SELECT peta FROM users WHERE id=1');
  const [[item]]=await db.query('SELECT quantity FROM inventory');
  assert.equal(pet.current_exp,1);assert.equal(pet.battles_won,1);assert.equal(pet.current_hp,73);assert.equal(user.peta,25);assert.equal(item.quantity,2);
  assert.deepEqual(retries[0].reward,retries[3].reward);
  const bad={...state,matchId:crypto.randomUUID(),userId:999};await assert.rejects(service.finalize(bad,'player'));
  const failService=createClassicBattle({db,calculateLoot:x=>x,calculateBattleExpGain:()=>1,titleService:{recordPetaEarned:async()=>{throw new Error('injected failure');},recordHuntWin:async()=>{}}});
  const failed=JSON.parse(JSON.stringify(state));delete failed.matchId;await failService.register(failed);await assert.rejects(failService.finalize(failed,'player'));
  const [[after]]=await db.query('SELECT current_exp FROM pets WHERE id=1');assert.equal(after.current_exp,1);
  const app=express();app.use(express.json());app.use(createClassicAuth({db,getUserIdFromToken:()=>null}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const post=async(path,body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  // No real email is sent in this test.
  const oldSMTP=process.env.SMTP_HOST;delete process.env.SMTP_HOST;
  try{
   const account={username:'test_player',displayName:'Test',email:'test@example.invalid',password:'Primary-test-123',password2:'Secondary-test-456',avatar:'/images/character/angel.jpg'};
   assert.equal((await post('/register',account)).status,400); // underscore is not valid in new usernames
   account.username='testplayer';assert.equal((await post('/register',account)).status,201);
   assert.equal((await post('/register',account)).status,409);
   const [[security]]=await db.query('SELECT * FROM account_security WHERE email=?',[account.email]);
   assert.notEqual(security.password2_hash,account.password2);assert.equal(security.email_verified,0);
   const raw=crypto.randomBytes(32).toString('hex');const hash=crypto.createHash('sha256').update(raw).digest('hex');
   await db.query("INSERT INTO account_email_tokens VALUES(?,?,'reset',DATE_ADD(NOW(),INTERVAL 5 MINUTE),NULL)",[hash,security.user_id]);
   const reset={token:raw,password:'Replacement-123',password2:'Replacement-456'};
   assert.equal((await post('/auth/reset',reset)).status,200);
   assert.equal((await post('/auth/reset',reset)).status,400);
   const [[revoked]]=await db.query('SELECT token_version FROM account_security WHERE user_id=?',[security.user_id]);assert.equal(revoked.token_version,1);
   assert.equal((await post('/auth/forgot',{email:account.email})).status,503);
  }finally{if(oldSMTP!==undefined)process.env.SMTP_HOST=oldSMTP;}
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.end();
  // Only the randomly named disposable schema created by this test is dropped.
  if(!/^petaria_classic_test_[a-f0-9]{12}$/.test(schema))throw new Error('Invalid fixture schema');
  await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``);await admin.end();
 }
});
