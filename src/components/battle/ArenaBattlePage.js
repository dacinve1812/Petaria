// ArenaBattlePage.js - Trang chiến đấu PvE
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../css/BattlePage.css';
import '../css/ArenaBattlePage.css';

function ArenaBattlePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { playerPet, enemyPet } = location.state || {};
  
    const [player, setPlayer] = useState({ ...playerPet, current_hp: playerPet?.final_stats?.hp });
    const [enemy, setEnemy] = useState({ ...enemyPet, current_hp: enemyPet?.final_stats?.hp });
    const [turn, setTurn] = useState(0);
    const [log, setLog] = useState([]);
    const [autoMode, setAutoMode] = useState(false);
    const [isBlitzMode, setIsBlitzMode] = useState(false);
    const [battleEnded, setBattleEnded] = useState(false);
    const [equippedItems, setEquippedItems] = useState([]);
    const [equipmentStats, setEquipmentStats] = useState([]);
    const [attackAnimation, setAttackAnimation] = useState('');
    const [resultEffect, setResultEffect] = useState('');
  
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  
    const appendLog = (entry) => {
      setLog((prev) => [...prev.slice(-3), entry]);
    };
  
    const checkBattleEnded = (nextEnemyHp, nextPlayerHp) => {
      if (nextEnemyHp <= 0 || nextPlayerHp <= 0) {
        setBattleEnded(true);
        setResultEffect(nextEnemyHp <= 0 ? 'win' : 'lose');
        return true;
      }
      return false;
    };
  
    const handleAttackWithItem = async (item) => {
      const stat = equipmentStats.find(e => e.item_id === item.item_id);
      const power = stat?.power || 10;
  
      if (item.durability_left <= 0) return;
  
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attacker: player,
            defender: enemy,
            movePower: power,
            moveName: item.item_name || 'Weapon'
          })
        });
        const result = await res.json();
        const newEnemyHp = Math.max(enemy.current_hp - result.damage, 0);
        appendLog(`${result.attacker} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`);
        setEnemy((prev) => ({ ...prev, current_hp: newEnemyHp }));
        setEquippedItems((prev) => prev.map(i => i.item_id === item.item_id ? { ...i, durability_left: i.durability_left - 1 } : i));
        setTurn((prev) => prev + 1);
        setAttackAnimation('player');
  
        if (!checkBattleEnded(newEnemyHp, player.current_hp)) {
          setTimeout(() => handleEnemyTurn(), 1500);
        }
      } catch (err) {
        console.error('Lỗi khi đánh bằng vũ khí:', err);
      }
    };
  
    const handleNormalAttack = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attacker: player,
            defender: enemy,
            movePower: 10,
            moveName: 'Normal Attack'
          })
        });
        const result = await res.json();
        const newEnemyHp = Math.max(enemy.current_hp - result.damage, 0);
        appendLog(`${result.attacker} dùng ${result.moveUsed}, gây ${result.damage} sát thương.`);
        setEnemy((prev) => ({ ...prev, current_hp: newEnemyHp }));
        setTurn((prev) => prev + 1);
        setAttackAnimation('player');
  
        if (!checkBattleEnded(newEnemyHp, player.current_hp)) {
          setTimeout(() => handleEnemyTurn(), 1500);
        }
      } catch (err) {
        console.error('Lỗi khi tấn công thường:', err);
      }
    };
  
    const handleEnemyTurn = async () => {
      if (enemy.current_hp <= 0 || player.current_hp <= 0) return;
  
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attacker: enemy,
            defender: player,
            movePower: 10,
            moveName: 'Enemy Strike'
          })
        });
        const result = await res.json();
        const newPlayerHp = Math.max(player.current_hp - result.damage, 0);
        appendLog(`${result.attacker} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`);
        setPlayer((prev) => ({ ...prev, current_hp: newPlayerHp }));
        setTurn((prev) => prev + 1);
        setAttackAnimation('enemy');
  
        checkBattleEnded(enemy.current_hp, newPlayerHp);
      } catch (err) {
        console.error('Enemy attack failed:', err);
      }
    };
  
    const handleBlitz = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-full`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerPet: player,
            enemyPet: enemy,
            playerMovePower: 10,
            playerMoveName: 'Slash',
            enemyMovePower: 10,
            enemyMoveName: 'Bite'
          })
        });
        const result = await res.json();
        setLog(result.log);
        setResultEffect(result.winner === player.name ? 'win' : 'lose');
        setBattleEnded(true);
      } catch (err) {
        console.error('Lỗi khi blitz:', err);
      }
    };
  
    useEffect(() => {
      if (!player?.id) return;
      fetch(`${API_BASE_URL}/api/pets/${player.id}/equipment`)
        .then(res => res.json())
        .then(setEquippedItems)
        .catch(err => console.error('Lỗi khi load trang bị:', err));
  
      fetch(`${API_BASE_URL}/api/admin/equipment-stats`)
        .then(res => res.json())
        .then(setEquipmentStats)
        .catch(err => console.error('Lỗi khi load chỉ số vũ khí:', err));
    }, [player?.id]);
  
    useEffect(() => {
      if (player.current_hp <= 0 || enemy.current_hp <= 0) setBattleEnded(true);
    }, [player.current_hp, enemy.current_hp]);

    return (
        <div className={`battle-page container ${resultEffect === 'win' ? 'battle-win' : resultEffect === 'lose' ? 'battle-lose' : ''}`}>
          <header><img src="/images/buttons/banner.jpeg" alt="Banner" /></header>
    
          <div className="battle-area">
            <div className="pet-side">
              <img
                src={`/images/pets/${player.image}`}
                alt={player.name}
                className={attackAnimation === 'enemy' ? 'attack-flash' : ''}
                onAnimationEnd={() => setAttackAnimation('')}
              />
              <p>{player.name}</p>
              <div className="hp-bar">
                <div className="hp-fill" style={{ width: `${(player.current_hp / player.final_stats.hp) * 100}%` }}></div>
              </div>
            </div>
    
            <div className="pet-side">
              <img
                src={`/images/pets/${enemy.image}`}
                alt={enemy.name}
                className={attackAnimation === 'player' ? 'attack-flash' : ''}
                onAnimationEnd={() => setAttackAnimation('')}
              />
              <p>{enemy.name}</p>
              <div className="hp-bar">
                <div className="hp-fill" style={{ width: `${(enemy.current_hp / enemy.final_stats.hp) * 100}%` }}></div>
              </div>
            </div>
          </div>
    
          <div className="battle-log">
            {log.map((line, idx) => (<div key={idx}>{line}</div>))}
          </div>
    
          {!battleEnded && (
            <div className="battle-controls">
              <div className="equipment-row">
                {equippedItems.map(item => {
                  const stat = equipmentStats.find(e => e.item_id === item.item_id);
                  const power = stat?.power || 10;
                  return (
                    <div key={item.id} style={{ display: 'inline-block', textAlign: 'center', margin: '5px' }}>
                      <img
                        src={`/images/equipments/${item.image_url}`}
                        alt={item.item_name}
                        title={item.item_name}
                        onClick={() => item.durability_left > 0 && handleAttackWithItem(item)}
                        style={{
                          border: item.durability_left <= 0 ? '1px solid gray' : '2px solid gold',
                          width: '48px', height: '48px', cursor: item.durability_left > 0 ? 'pointer' : 'not-allowed'
                        }}
                      />
                      <div style={{ fontSize: '12px' }}>{power} dmg</div>
                      <div style={{ fontSize: '12px' }}>🔧 {item.durability_left}</div>
                    </div>
                  );
                })}
              </div>
              <button onClick={handleNormalAttack}>Tấn công thường</button>
              <button onClick={() => setAutoMode(true)} disabled={autoMode}>Auto</button>
              <button onClick={handleBlitz}>Blitz</button>
            </div>
          )}
    
          {battleEnded && (
            <div className="battle-result">
              {player.current_hp > 0 ? '🎉 Thắng lợi!' : '💀 Thất bại!'}
            </div>
          )}
        </div>
      );
    }

export default ArenaBattlePage;
