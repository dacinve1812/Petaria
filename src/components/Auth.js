import React, {useEffect,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {useUser} from '../UserContext';
import './Auth.css';
const API=process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
export default function Auth(){
 const [params,setParams]=useSearchParams();
 const mode=params.get('mode') || 'login';
 const token=params.get('token') || '';
 const {user,login,logout}=useUser();
 const navigate=useNavigate();
 const [values,setValues]=useState({});
 const [options,setOptions]=useState({avatars:[]});
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [showPasswords,setShowPasswords]=useState(false);
 useEffect(()=>{fetch(`${API}/auth/options`).then(r=>r.json()).then(setOptions).catch(()=>setError('Không thể kết nối máy chủ.'));},[]);
 const changeMode=m=>{setParams(m==='login'?{}:{mode:m});setValues({});setError('');setMessage('');};
 const titles={login:'Đăng nhập vào Petaria',register:'Đăng ký tài khoản',forgot:'Khôi phục mật khẩu',reset:'Đặt lại mật khẩu',verify:'Xác nhận email',security:'Bảo mật tài khoản',change:'Đổi mật khẩu cấp 1'};
 async function submit(event,override){
  event?.preventDefault();if(busy)return;setError('');setMessage('');
  const target=override || mode;
  if(['register','reset','change'].includes(target) && values.password!==values.confirmPassword)return setError('Xác nhận mật khẩu cấp 1 chưa khớp.');
  if(['register','reset','security'].includes(target) && values.password2!==values.confirmPassword2)return setError('Xác nhận mật khẩu cấp 2 chưa khớp.');
  setBusy(true);
  try{
   const paths={login:'/login',register:'/register',forgot:'/auth/forgot',reset:'/auth/reset',verify:'/auth/verify',security:'/auth/security',change:'/auth/change-primary',resend:'/auth/resend-verification'};
   const headers={'Content-Type':'application/json'};
   if(['security','change','resend'].includes(target) && user?.token)headers.Authorization=`Bearer ${user.token}`;
   const res=await fetch(`${API}${paths[target] || '/login'}`,{method:'POST',headers,body:JSON.stringify({...values,token,avatar:values.avatar || options.avatars[0]})});
   const data=await res.json();if(!res.ok)throw new Error(data.message || 'Không thể xử lý yêu cầu.');
   if(target==='login'){login(data.token,data.hasPet);navigate('/home-ver2');return;}
   if(target==='register'){
    const loginRes=await fetch(`${API}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:values.username,password:values.password})});
    const loginData=await loginRes.json().catch(()=>({}));
    if(loginRes.ok && loginData.token){login(loginData.token,loginData.hasPet);navigate('/home-ver2');return;}
   }
   setMessage(data.message);setValues({});
   if(['register','reset','verify','change'].includes(target)){if(['reset','change'].includes(target))logout();setParams({});}
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const field=(name,label,type='text',hint='',required=true)=><label className="petaria-auth-field" key={name}><span>{label}{required && <b> *</b>}</span><input type={type==="password" && showPasswords ? "text" : type} maxLength={name==="username" && mode==="register" ? 16 : name==="displayName" ? 20 : undefined} name={name} autoComplete={name==='username'?'username':type==='password'?(mode==='login'?'current-password':'new-password'):type==='email'?'email':'off'} required={required} value={values[name] || ''} onChange={e=>setValues({...values,[name]:e.target.value})} minLength={type==='password' && name!=='currentPassword' && mode!=='login'?8:undefined}/>{hint && <small>{hint}</small>}</label>;
 return <main className="petaria-auth-shell">
  <header className="petaria-auth-brand"><a href="/">PETARIA</a><span>Vương quốc thú ảo</span></header>
  <nav className="petaria-auth-nav" aria-label="Tài khoản"><button onClick={()=>changeMode('login')}>Đăng nhập</button><button onClick={()=>changeMode('register')}>Đăng ký</button>{user && <button onClick={()=>navigate('/home-ver2')}>Vào vương quốc</button>}</nav>
  <section className="auth-container"><h1>{titles[mode] || titles.login}</h1>
   {message && <p role="status" className="auth-success">{message}</p>}{error && <p role="alert" className="auth-error">{error}</p>}
   <form onSubmit={submit}>
    {['login','register'].includes(mode) && field('username','Tên đăng nhập','text',mode==='register'?'3–16 ký tự thường a–z và số 0–9.':'')}
    {mode==='register' && field('displayName','Tên hiển thị','text','Tối đa 20 ký tự; được dùng dấu và khoảng trắng.')}
    {['register','forgot','security'].includes(mode) && field('email','Địa chỉ email','email','Dùng để xác nhận tài khoản và khôi phục mật khẩu.')}
    {['login','register','reset','change'].includes(mode) && field('password',mode==='login'?'Mật khẩu':'Mật khẩu cấp 1','password',mode==='login'?'':'Dùng để đăng nhập; ít nhất 8 ký tự.')}
    {['register','reset','change'].includes(mode) && field('confirmPassword','Xác nhận mật khẩu cấp 1','password')}
    {mode==='security' && field('currentPassword','Mật khẩu đăng nhập hiện tại','password')}
    {['register','reset','security','change'].includes(mode) && field('password2','Mật khẩu cấp 2','password','Dùng để đổi mật khẩu cấp 1; phải khác mật khẩu đăng nhập.')}
    {['register','reset','security'].includes(mode) && field('confirmPassword2','Xác nhận mật khẩu cấp 2','password')}
    {mode==='register' && <fieldset className="auth-avatars"><legend>Ảnh đại diện</legend>{options.avatars.map((avatar,i)=><label key={avatar}><input type="radio" name="avatar" value={avatar} checked={(values.avatar || options.avatars[0])===avatar} onChange={()=>setValues({...values,avatar})}/><img src={avatar} alt={`Nhân vật ${i+1}`}/></label>)}</fieldset>}
    {mode==='verify' && <p>Nhấn xác nhận để liên kết email này với tài khoản của bạn.</p>}
    {mode==='security' && <p>Dành cho tài khoản cũ chưa có email và mật khẩu cấp 2.</p>}
    <label className="auth-password-toggle" hidden={["forgot","verify"].includes(mode)}><input type="checkbox" checked={showPasswords} onChange={e=>setShowPasswords(e.target.checked)}/> Hiện mật khẩu</label><button className="auth-submit" disabled={busy || (mode==='register'&&!options.avatars.length)}>{busy?'Đang xử lý…':mode==='login'?'Đăng nhập':mode==='register'?'Đăng ký':mode==='forgot'?'Gửi liên kết khôi phục':'Xác nhận'}</button>
   </form>
   <div className="auth-links"><button onClick={()=>changeMode('forgot')}>Quên mật khẩu?</button>{user && <><button onClick={()=>changeMode('security')}>Bổ sung bảo mật tài khoản</button><button onClick={()=>changeMode('change')}>Đổi mật khẩu bằng mật khẩu cấp 2</button><button disabled={busy} onClick={()=>submit(null,'resend')}>Gửi lại thư xác nhận</button></>}</div>
   <p className="auth-footnote">Giữ kín cả hai mật khẩu. Không dùng mật khẩu tài khoản email cho game.</p>
  </section>
 </main>;
}
