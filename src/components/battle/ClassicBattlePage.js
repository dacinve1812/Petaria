import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';
import './ClassicBattlePage.css';

const API = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const img = (value, folder='pets') => !value ? '' : /^(https?:|\/)/.test(value) ? value : `/images/${folder}/${value}`;
const num = value => Number(value || 0).toLocaleString('vi-VN');

export default function ClassicBattlePage() {
  const {user} = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [match,setMatch] = useState(null);
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  const [action,setAction] = useState('normal_attack');
  const [fleeConfirm,setFleeConfirm] = useState(false);
  const lock = useRef(false);
  const request = async (path,body) => {
    const response = await fetch(`${API}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${user?.token}`},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.message || 'Không thể xử lý trận đấu.');
    return data;
  };
  const remember = data => {
    setMatch(data);
    if(data.finished) dispatchCurrencyUpdate();
    if(action.includes(':') && !(data.equipment || []).some(item=>String(item.id)===action.split(':')[1]))setAction('normal_attack');
    if(data.matchId) sessionStorage.setItem('petaria-classic-match',data.matchId);
  };
  useEffect(()=>{
    if(!user?.token) return;
    let cancelled=false;
    (async()=>{
      try {
        const status=await request('/api/arena/match/status');
        let data=status.active?status:null;
        if(!data){
          const id=location.state?.matchState?.matchId || sessionStorage.getItem('petaria-classic-match');
          if(id) data=await request(`/api/arena/match/result/${encodeURIComponent(id)}`);
        }
        if(!cancelled) {if(data) remember(data); else setError('Chưa có trận đấu. Hãy chọn đối thủ tại đấu trường.');}
      }catch(e){if(!cancelled)setError(e.message);}
      finally{if(!cancelled)setBusy(false);}
    })();
    return()=>{cancelled=true;};
    // The server is the source of truth, including after refresh or a lost response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.token,location.key]);
  async function perform(flee=false){
    if(lock.current || !match || match.finished)return;
    lock.current=true;setBusy(true);setError('');
    const [kind,item]=action.split(':');
    try {
      remember(await request(`/api/arena/match/${flee?'terminate':'turn'}`,{action:kind,itemId:item?Number(item):undefined,expectedTurn:match.turn_count,matchId:match.matchId}));
      setFleeConfirm(false);
    }catch(e){
      setError(e.message);
      try {const status=await request('/api/arena/match/status');remember(status.active?status:await request(`/api/arena/match/result/${match.matchId}`));}catch{/* Keep last confirmed state; never fabricate rewards. */}
    }finally{setBusy(false);lock.current=false;}
  }
  const back=()=>navigate(match?.battleSource==='hunting' && match.huntingMapId ? `/hunting-world/map/${encodeURIComponent(match.huntingMapId)}`:'/battle/arena',{replace:true});
  if(!user) return <TemplatePage showSearch={false} showTabs={false}><p>Vui lòng đăng nhập để chiến đấu.</p></TemplatePage>;
  const unit=(pet,enemy=false)=><section className="classic-unit">
    <img className="classic-pet" src={img(pet.image,enemy?'boss':'pets')} alt={pet.name}/>
    <h2>{pet.name}</h2><p>Đẳng cấp: <strong>{num(pet.level)}</strong></p>
    <label>HP: {num(pet.current_hp)} / {num(pet.final_stats?.hp)}</label>
    <progress max={Math.max(1,pet.final_stats?.hp || 1)} value={Math.max(0,pet.current_hp || 0)}/>
    <label>MP: {num(pet.current_mp)} / {num(pet.final_stats?.mp)}</label>
    <progress className="classic-mp" max={Math.max(1,pet.final_stats?.mp || 1)} value={Math.max(0,pet.current_mp || 0)}/>
    <p className="classic-secondary">Sức mạnh {num(pet.final_stats?.str)} · Phòng thủ {num(pet.final_stats?.def)}</p>
  </section>;
  return <TemplatePage showSearch={false} showTabs={false}>
    <main className="classic-battle">
      {error && <p role="alert" className="classic-error">{error}</p>}
      {!match ? <p>{busy?'Đang tải trận đấu…':<button onClick={back}>Về đấu trường</button>}</p> : match.finished ? <section className="classic-result" aria-labelledby="classic-result-title">
        <img className="classic-result-pet" src={img(match.player.image)} alt={match.player.name}/>
        <h1 id="classic-result-title">{match.result==='win'?'Chiến thắng!':'Thất bại'}</h1>
        <p>{match.result==='win'?`Xin chúc mừng, bạn đã đánh bại ${match.enemy.name}!`:`${match.player.name} đã kết thúc trận đấu với ${match.enemy.name}.`}</p>
        {match.result==='win' && <p><strong>{num(match.reward?.expGained)}</strong> EXP · <strong>{num((match.reward?.loot || []).filter(x=>Number(x.item_id)===0).reduce((s,x)=>s+Number(x.quantity),0))}</strong> peta</p>}
        {match.reward?.levelUp && <p className="classic-level">Thú cưng lên cấp {num(match.reward.newLevel)}!</p>}
        {(match.reward?.loot || []).some(x=>Number(x.item_id)!==0) && <p>Vật phẩm: {match.reward.loot.filter(x=>Number(x.item_id)!==0).map(x=>`${x.name} × ${num(x.quantity)}`).join(', ')}</p>}
        <dl className="classic-stats">{[['Sức mạnh','str'],['Thông minh','intelligence'],['Tốc độ','spd'],['Phòng thủ','def'],['Sức khỏe','hp'],['Năng lượng','mp']].map(([label,key])=><div key={key}><dt>{label}</dt><dd>{num(match.player.final_stats?.[key])}</dd></div>)}</dl>
        <button onClick={back}>Trở lại {match.battleSource==='hunting'?'bản đồ':'đấu trường'}</button>
      </section> : <>
        <h1>Đấu trường</h1>
        <div className="classic-contest">{unit(match.player)}{unit(match.enemy,true)}</div>
        <div className="classic-log" aria-live="polite">{(match.history || []).slice(-3).map((entry,index)=><p key={index}>{entry.text}</p>)}{!match.history?.length && <p>Chọn hành động để bắt đầu lượt đấu.</p>}</div>
        <div className="classic-equipment">{(match.equipment || []).map(item=><button disabled={busy || item.durability_left<=0} className={action.endsWith(`:${item.id}`)?'selected':''} key={item.id} title={`${item.item_name} — độ bền ${item.durability_left}`} onClick={()=>setAction(`${item.equipment_type==='shield'?'defend_shield':'attack_item'}:${item.id}`)}><img src={img(item.image_url,'equipments')} alt={item.item_name}/></button>)}</div>
        <form className="classic-controls" onSubmit={event=>{event.preventDefault();perform();}}><select aria-label="Hành động" value={action} disabled={busy} onChange={e=>setAction(e.target.value)}><option value="normal_attack">Tấn công thường</option><option value="defend_basic">Phòng thủ</option>{(match.equipment || []).filter(x=>x.durability_left>0).map(item=><option key={item.id} value={`${item.equipment_type==='shield'?'defend_shield':'attack_item'}:${item.id}`}>{item.item_name}</option>)}</select><button disabled={busy}>{busy?'Đang xử lý…':'Đánh'}</button><button type="button" disabled={busy} onClick={()=>setFleeConfirm(true)}>Bỏ chạy</button></form>
        {fleeConfirm && <p>Bỏ chạy sẽ tính là thua. <button disabled={busy} onClick={()=>perform(true)}>Xác nhận bỏ chạy</button> <button onClick={()=>setFleeConfirm(false)}>Ở lại</button></p>}
      </>}
    </main>
  </TemplatePage>;
}
