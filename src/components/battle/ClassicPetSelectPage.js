import React,{useEffect,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useUser} from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import './ClassicBattlePage.css';
const API=process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
export default function ClassicPetSelectPage(){
 const {user}=useUser(),{state:prep={}}=useLocation(),navigate=useNavigate();
 const [pets,setPets]=useState([]),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!user)return;fetch(`${API}/users/${user.userId}/pets`,{headers:{Authorization:`Bearer ${user.token}`}}).then(async r=>{if(!r.ok)throw new Error('Không tải được thú cưng.');return r.json();}).then(data=>setPets(Array.isArray(data)?data:data.pets || [])).catch(e=>setError(e.message));},[user]);
 async function start(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const body={petId:Number(selected),bossId:prep.enemy?.id,battleSource:prep.battleSource || 'arena',returnPath:prep.returnPath,huntingMapId:prep.huntingMapId,...(prep.battleSource==='hunting'?{bossLevel:prep.bossLevel || prep.enemy?.level}:{})};
  const r=await fetch(`${API}/api/arena/match/start`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${user.token}`},body:JSON.stringify(body)}),data=await r.json();
  if(!r.ok && data.code!=='ACTIVE_MATCH')throw new Error(data.message || 'Không thể bắt đầu trận.');
  const match=data.match || data;navigate('/battle/match',{state:{matchState:match}});
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!prep.enemy?.id || (prep.battleMode && prep.battleMode!=='1v1') || prep.battleSource==='champion')return <TemplatePage showSearch={false} showTabs={false}><p>Hãy chọn đối thủ tại đấu trường 1vs1.</p><button onClick={()=>navigate('/battle/arena')}>Về đấu trường</button></TemplatePage>;
 return <TemplatePage showSearch={false} showTabs={false}><main className="classic-battle"><h1>Khiêu chiến {prep.enemy.name}</h1><p>Chọn một thú cưng tham gia trận đấu.</p>{error && <p role="alert" className="classic-error">{error}</p>}<form onSubmit={start} className="classic-controls"><select required aria-label="Thú cưng tham chiến" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Chọn thú cưng</option>{pets.map(p=><option key={p.id} value={p.id}>{p.name} — Cấp {p.level} · HP {p.current_hp ?? p.hp}</option>)}</select><button disabled={busy || !selected}>{busy?'Đang chuẩn bị…':'Vào trận'}</button></form></main></TemplatePage>;
}
