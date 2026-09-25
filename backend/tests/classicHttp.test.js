const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const {spawn}=require('child_process');
const path=require('path');
const mysql=require('mysql2/promise');
const {createClient}=require('redis');
const jwt=require('jsonwebtoken');
require('dotenv').config({path:path.resolve(__dirname,'../../.env')});

test('full server with isolated MySQL and Redis namespace: win, retry, permissions, flee', {timeout:60000},async()=>{
 const suffix=crypto.randomBytes(5).toString('hex'),schema='petaria_http_test_'+suffix,prefix='test:'+suffix+':';
 const source=process.env.DB_NAME || 'petaria';
 assert.match(source,/^[a-zA-Z0-9_]+$/);
 const admin=await mysql.createConnection({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''});
 let child,redis,log='';
 try{
  await admin.query(`CREATE DATABASE \`${schema}\``);
  const [tables]=await admin.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE=\'BASE TABLE\'',[source]);
  for(const row of tables){assert.match(row.TABLE_NAME,/^[a-zA-Z0-9_]+$/);await admin.query(`CREATE TABLE \`${schema}\`.\`${row.TABLE_NAME}\` LIKE \`${source}\`.\`${row.TABLE_NAME}\``);}
  for(const table of ['pet_species','boss_templates','boss_skills','skills','items','equipment_data','titles'])await admin.query(`INSERT INTO \`${schema}\`.\`${table}\` SELECT * FROM \`${source}\`.\`${table}\``);
  await admin.changeUser({database:schema});
  await admin.query("INSERT INTO users(id,username,password,role) VALUES(900000001,'classicfixture','unused','user')");
  const [[species]]=await admin.query('SELECT id FROM pet_species LIMIT 1');
  const stats={hp:10000,mp:100,str:10000,def:1000,intelligence:100,spd:10000};
  await admin.query('INSERT INTO pets(id,uuid,name,pet_species_id,owner_id,level,current_exp,hp,max_hp,current_hp,mp,max_mp,str,def,intelligence,spd,final_stats,hunger_status,mood) VALUES(900000001,?,?,?,?,1,0,10000,10000,10000,100,100,10000,1000,100,10000,?,10,10)',[crypto.randomUUID(),'Fixture',species.id,900000001,JSON.stringify(stats)]);
  const [[boss]]=await admin.query('SELECT id FROM boss_templates WHERE location_id=0 ORDER BY level LIMIT 1');assert.ok(boss);
  const port=15000+crypto.randomInt(10000);
  child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,DB_NAME:schema,PORT:String(port),REDIS_MATCH_PREFIX:prefix},windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>{log=(log+b.toString()).slice(-12000);});child.stderr.on('data',b=>{log=(log+b.toString()).slice(-12000);});
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let n=0;n<80;n++){try{ready=(await fetch(base+'/auth/options')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,200));}
  assert.ok(ready,'Isolated backend did not start');
  const token=jwt.sign({userId:900000001},process.env.JWT_SECRET || 'your-secret-key',{expiresIn:'5m'});
  const call=async(method,url,body,auth=true)=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  for(const url of ['/api/pets/900000001/gain-exp','/api/pets/900000001/update-hp','/api/arena/claim-loot'])assert.equal((await call('POST',url,{})).status,410);
  assert.equal((await call('PUT','/api/users/900000001/role',{role:'admin',adminUserId:1})).status,403);
  assert.equal((await call('POST','/api/admin/pet-species',{name:'invalid'})).status,403);
  assert.equal((await call('POST','/api/arena/match/start',{petId:900000001,bossId:boss.id,battleMode:'3v3'})).status,403);
  let response=await call('POST','/api/arena/match/start',{petId:900000001,bossId:boss.id});assert.equal(response.status,200,JSON.stringify(response.data));
  let match=response.data;
  assert.equal((await call('POST','/api/arena/match/turn',{matchId:match.matchId,expectedTurn:0,action:'defend_shield',itemId:99999999,power_min:99999})).status,409);
  for(let n=0;n<8 && !match.finished;n++){
    response=await call('POST','/api/arena/match/turn',{matchId:match.matchId,expectedTurn:match.turn_count,action:'normal_attack'});
    assert.equal(response.status,200,JSON.stringify(response.data));match=response.data;
  }
  assert.equal(match.result,'win');assert.ok(match.reward.expGained>0);
  const [[before]]=await admin.query('SELECT current_exp,battles_won FROM pets WHERE id=900000001');
  const result=await call('GET','/api/arena/match/result/'+match.matchId);assert.equal(result.status,200);assert.deepEqual(result.data.reward,match.reward);
  await call('POST','/api/arena/match/turn',{matchId:match.matchId,expectedTurn:0,action:'normal_attack'});
  const [[after]]=await admin.query('SELECT current_exp,battles_won FROM pets WHERE id=900000001');assert.deepEqual(after,before);
  response=await call('POST','/api/arena/match/start',{petId:900000001,bossId:boss.id});assert.equal(response.status,200);match=response.data;
  response=await call('POST','/api/arena/match/terminate',{matchId:match.matchId});assert.equal(response.status,200);assert.equal(response.data.result,'lose');assert.equal(response.data.reward.expGained,0);
 }catch(error){
  // Only log server error categories; never dump secrets or response tokens.
  console.error(log.split('\n').filter(line=>/Error|error|ER_|TypeError/.test(line)).slice(-8).join('\n'));
  throw error;
 }finally{
  if(child && child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
  redis=createClient({url:process.env.REDIS_URL||'redis://localhost:6379'});redis.on('error',()=>{});
  try{await redis.connect();const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);}finally{if(redis.isOpen)await redis.quit();}
  assert.match(schema,/^petaria_http_test_[a-f0-9]{10}$/);
  await admin.query(`DROP DATABASE \`${schema}\``);await admin.end();
 }
});
