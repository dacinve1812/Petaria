const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validPassword = value => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value,'utf8') <= 72;
const emailValue = value => String(value || '').trim().toLowerCase();
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const avatars = ['Dylan-avatar.png','Everlyn-avatar.png','angel.jpg','char2.jpg','char3.jpg'].map(x=>`/images/character/${x}`);

function createClassicAuth({db,getUserIdFromToken}) {
 const router=express.Router();
 const limits=new Map();
 const mailReady=()=>Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.APP_PUBLIC_URL);
 const limit=(req,res,next)=>{
   const now=Date.now(),key=`${req.ip}:${req.path}`;
   for(const [k,v] of limits) if(v.until<now) limits.delete(k);
   const row=limits.get(key)||{count:0,until:now+15*60*1000};
   row.count++;limits.set(key,row);
   if(row.count>15) return res.status(429).json({message:'Bạn thử quá nhiều lần. Vui lòng đợi 15 phút.'});next();
 };
 const route=(path,handler)=>router.post(path,limit,(req,res)=>Promise.resolve(handler(req,res)).catch(e=>{
   console.error('Account operation failed:', e.code || e.name);
   res.status(e.code==='ER_DUP_ENTRY'?409:500).json({message:e.code==='ER_DUP_ENTRY'?'Tên đăng nhập hoặc email đã được sử dụng.':'Không thể xử lý yêu cầu. Vui lòng thử lại.'});
 }));
 async function sendToken(userId,email,purpose){
   if(!mailReady()) return false;
   const token=crypto.randomBytes(32).toString('hex');
   await db.query('INSERT INTO account_email_tokens (token_hash,user_id,purpose,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))',[digest(token),userId,purpose]);
   const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT || 587),secure:process.env.SMTP_SECURE==='true',...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}:{}),connectionTimeout:10000,socketTimeout:15000});
   const base=process.env.APP_PUBLIC_URL.replace(/\/$/,'');
   try {await transport.sendMail({from:process.env.SMTP_FROM,to:email,subject:purpose==='reset'?'Petaria — Khôi phục mật khẩu':'Petaria — Xác nhận email',text:`Mở liên kết sau để ${purpose==='reset'?'đặt lại mật khẩu':'xác nhận email'}. Liên kết dùng một lần, có hiệu lực 30 phút.\n${base}/login?mode=${purpose}&token=${token}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`});}
   catch(e){await db.query('DELETE FROM account_email_tokens WHERE token_hash=?',[digest(token)]);throw e;}
   return true;
 }
 router.get('/auth/options',(req,res)=>res.json({avatars,emailRecoveryAvailable:mailReady()}));
 router.post('/login',limit,(req,res,next)=>{
   if(typeof req.body.username!=='string'||typeof req.body.password!=='string')return res.status(400).json({message:'Thông tin đăng nhập không hợp lệ.'});next();
 });
 route('/register',async(req,res)=>{
   const {username,displayName,password,password2,avatar}=req.body;
   const email=emailValue(req.body.email);
   if(typeof username!=='string' || !/^[a-z0-9]{3,16}$/.test(username) || typeof displayName!=='string' || !displayName.trim() || displayName.trim().length>20 || !validEmail(email) || !validPassword(password) || !validPassword(password2) || password===password2 || !avatars.includes(avatar))return res.status(400).json({message:'Kiểm tra lại thông tin. Tên đăng nhập gồm 3–16 chữ thường/số; hai mật khẩu khác nhau, từ 8 ký tự và tối đa 72 byte.'});
   const hashes=await Promise.all([bcrypt.hash(password,12),bcrypt.hash(password2,12)]);
   const c=await db.getConnection();let id;
   const registrationLock='register:'+digest(username).slice(0,40);
   try {
     const [[lock]]=await c.query('SELECT GET_LOCK(?,5) AS acquired',[registrationLock]);
     if(!lock.acquired)return res.status(409).json({message:'Vui lòng thử lại.'});
     await c.beginTransaction();
     const [existing]=await c.query('SELECT id FROM users WHERE username=?',[username]);
     if(existing.length){await c.rollback();return res.status(409).json({message:'Tên đăng nhập đã được sử dụng.'});}
     const [result]=await c.query('INSERT INTO users(username,password,role) VALUES (?,?,\'user\')',[username,hashes[0]]);id=result.insertId;
     await c.query('INSERT INTO user_profiles(user_id,display_name,avatar_url) VALUES (?,?,?)',[id,displayName.trim(),avatar]);
     await c.query('INSERT INTO account_security(user_id,email,password2_hash) VALUES (?,?,?)',[id,email,hashes[1]]);
     await c.commit();
   }catch(e){await c.rollback();throw e;}finally{await c.query('SELECT RELEASE_LOCK(?)',[registrationLock]);c.release();}
   let sent=false;try{sent=await sendToken(id,email,'verify');}catch{/* Account exists; do not report a failed registration. */}
   res.status(201).json({message:sent?'Đăng ký thành công. Hãy xác nhận email trước khi dùng chức năng khôi phục.':'Đăng ký thành công. Email chưa được xác nhận; bạn có thể gửi lại thư xác nhận sau khi hệ thống mail sẵn sàng.'});
 });
 route('/auth/forgot',async(req,res)=>{
   if(!mailReady())return res.status(503).json({message:'Chức năng gửi email chưa được cấu hình. Vui lòng liên hệ quản trị viên.'});
   const email=emailValue(req.body.email);
   if(!validEmail(email))return res.status(400).json({message:'Email không hợp lệ.'});
   const [[account]]=await db.query('SELECT user_id FROM account_security WHERE email=? AND email_verified=1',[email]);
   if(account)await sendToken(account.user_id,email,'reset');
   res.json({message:'Nếu email đã được xác nhận cho một tài khoản, liên kết khôi phục sẽ được gửi đến hộp thư.'});
 });
 route('/auth/verify',async(req,res)=>{
   if(!/^[a-f0-9]{64}$/.test(req.body.token || ''))return res.status(400).json({message:'Liên kết không hợp lệ.'});
   const c=await db.getConnection();
   try{await c.beginTransaction();const [[token]]=await c.query('SELECT * FROM account_email_tokens WHERE token_hash=? AND purpose=\'verify\' AND used_at IS NULL AND expires_at>NOW() FOR UPDATE',[digest(req.body.token)]);
     if(!token){await c.rollback();return res.status(400).json({message:'Liên kết đã hết hạn hoặc đã sử dụng.'});}
     await c.query('UPDATE account_security SET email_verified=1 WHERE user_id=?',[token.user_id]);
     await c.query('UPDATE account_email_tokens SET used_at=NOW() WHERE user_id=? AND purpose=\'verify\'',[token.user_id]);await c.commit();res.json({message:'Email đã được xác nhận.'});
   }catch(e){await c.rollback();throw e;}finally{c.release();}
 });
 route('/auth/reset',async(req,res)=>{
   const {password,password2,token}=req.body;
   if(!/^[a-f0-9]{64}$/.test(token || '')||!validPassword(password)||!validPassword(password2)||password===password2)return res.status(400).json({message:'Liên kết hoặc mật khẩu không hợp lệ. Hai mật khẩu phải khác nhau.'});
   const hashes=await Promise.all([bcrypt.hash(password,12),bcrypt.hash(password2,12)]);
   const c=await db.getConnection();
   try{await c.beginTransaction();const [[row]]=await c.query('SELECT * FROM account_email_tokens WHERE token_hash=? AND purpose=\'reset\' AND used_at IS NULL AND expires_at>NOW() FOR UPDATE',[digest(token)]);
     if(!row){await c.rollback();return res.status(400).json({message:'Liên kết đã hết hạn hoặc đã sử dụng.'});}
     await c.query('UPDATE users SET password=? WHERE id=?',[hashes[0],row.user_id]);
     await c.query('UPDATE account_security SET password2_hash=?,token_version=token_version+1 WHERE user_id=?',[hashes[1],row.user_id]);
     await c.query('UPDATE account_email_tokens SET used_at=NOW() WHERE user_id=?',[row.user_id]);await c.commit();res.json({message:'Đã đặt lại hai mật khẩu. Vui lòng đăng nhập lại.'});
   }catch(e){await c.rollback();throw e;}finally{c.release();}
 });
 route('/auth/security',async(req,res)=>{
   const id=getUserIdFromToken(req);if(!id)return res.status(401).json({message:'Vui lòng đăng nhập.'});
   const [[user]]=await db.query('SELECT password FROM users WHERE id=?',[id]);
   if(!user || typeof req.body.currentPassword!=='string' || !(await bcrypt.compare(req.body.currentPassword,user.password)))return res.status(403).json({message:'Mật khẩu đăng nhập không đúng.'});
   const [[existing]]=await db.query('SELECT * FROM account_security WHERE user_id=?',[id]);
   if(existing?.password2_hash)return res.status(409).json({message:'Tài khoản đã có mật khẩu cấp 2. Dùng chức năng khôi phục nếu cần đặt lại.'});
   const email=emailValue(req.body.email),password2=req.body.password2;
   if(!validEmail(email)||!validPassword(password2)||password2===req.body.currentPassword)return res.status(400).json({message:'Email hoặc mật khẩu cấp 2 không hợp lệ.'});
   const hash=await bcrypt.hash(password2,12);
   if(existing) await db.query('UPDATE account_security SET email=?,password2_hash=? WHERE user_id=? AND password2_hash IS NULL',[email,hash,id]);
   else await db.query('INSERT INTO account_security(user_id,email,password2_hash) VALUES (?,?,?)',[id,email,hash]);
   let sent=false;try{sent=await sendToken(id,email,'verify');}catch{}
   res.json({message:sent?'Đã lưu. Vui lòng xác nhận email.':'Đã lưu. Hệ thống chưa gửi được thư xác nhận, vui lòng thử gửi lại sau.'});
 });
 route('/auth/resend-verification',async(req,res)=>{
   const id=getUserIdFromToken(req);if(!id)return res.status(401).json({message:'Vui lòng đăng nhập.'});
   if(!mailReady())return res.status(503).json({message:'Chưa cấu hình gửi email.'});
   const [[account]]=await db.query('SELECT email,email_verified FROM account_security WHERE user_id=?',[id]);
   if(!account?.email)return res.status(400).json({message:'Hãy bổ sung email và mật khẩu cấp 2.'});
   if(!account.email_verified)await sendToken(id,account.email,'verify');res.json({message:account.email_verified?'Email đã được xác nhận.':'Đã gửi thư xác nhận.'});
 });
 route('/auth/change-primary',async(req,res)=>{
   const id=getUserIdFromToken(req);if(!id)return res.status(401).json({message:'Vui lòng đăng nhập.'});
   const [[row]]=await db.query('SELECT password2_hash FROM account_security WHERE user_id=?',[id]);
   const {password,password2}=req.body;
   if(!row?.password2_hash || !validPassword(password) || typeof password2!=='string' || !(await bcrypt.compare(password2,row.password2_hash)) || password===password2)return res.status(400).json({message:'Mật khẩu cấp 2 hoặc mật khẩu mới không hợp lệ.'});
   const c=await db.getConnection();try{await c.beginTransaction();await c.query('UPDATE users SET password=? WHERE id=?',[await bcrypt.hash(password,12),id]);await c.query('UPDATE account_security SET token_version=token_version+1 WHERE user_id=?',[id]);await c.commit();res.json({message:'Đã đổi mật khẩu. Vui lòng đăng nhập lại.'});}catch(e){await c.rollback();throw e;}finally{c.release();}
 });
 return router;
}
module.exports={createClassicAuth,validPassword,validEmail};
