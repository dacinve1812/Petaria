// ArenaBattlePage.js - Trang chiến đấu PvE
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../Navbar';
import '../css/BattlePage.css';
import '../css/ArenaBattlePage.css';
import expTable from '../../data/exp_table_petaria.json';

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
  const [attackAnimation, setAttackAnimation] = useState('');
    const [resultEffect, setResultEffect] = useState('');
    const [actionLocked, setActionLocked] = useState(false);
  
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

    const expToThisLevel = expTable[player.level] || 0;
    const expToNextLevel = expTable[player.level + 1] || 1;
    const expProgress = player.current_exp;
  const expRequired = expToNextLevel - expToThisLevel;
  
    const appendLog = (entry) => {
      setLog((prev) => [...prev.slice(-7), entry]);
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
      if (actionLocked) return;
      setActionLocked(true);
      // Sử dụng power trực tiếp từ item data
      const power = item.power || 10;

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
        
        // Cập nhật durability trong database
        try {
          const durabilityRes = await fetch(`${API_BASE_URL}/api/inventory/${item.id}/use-durability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 1 })
          });
          const durabilityResult = await durabilityRes.json();
          
          if (durabilityResult.item_broken) {
            // Xóa item khỏi equipped items nếu đã hỏng
            setEquippedItems((prev) => prev.filter(i => i.id !== item.id));
            appendLog(`${item.item_name} đã bị hư hại!`);
          } else {
            // Cập nhật durability
            setEquippedItems((prev) => prev.map(i => 
              i.id === item.id ? { ...i, durability_left: durabilityResult.durability_left } : i
            ));
          }
        } catch (err) {
          console.error('Error updating durability:', err);
          // Fallback: cập nhật UI local
          setEquippedItems((prev) => prev.map(i => i.id === item.id ? { ...i, durability_left: Math.max(i.durability_left - 1, 0) } : i));
        }
        
        setTurn((prev) => prev + 1);
        setAttackAnimation('player');

        if (!checkBattleEnded(newEnemyHp, player.current_hp)) {
          setTimeout(() => handleEnemyTurn(), 1500);
        } else {
          setActionLocked(false);
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
          setTimeout(() => handleEnemyTurn(), 1000);
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
      } finally {
        setActionLocked(false); // ✅ Unlock sau khi enemy kết thúc
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
    // Lấy battle stats với đầy đủ bonus (cached)
      fetch(`${API_BASE_URL}/api/pets/${player.id}/battle-stats`)
      .then(res => res.json())
      .then(data => {
        setPlayer(prev => ({ 
          ...prev, 
          final_stats: data.battle_stats,
          current_hp: data.battle_stats.hp 
        }));
      })
      .catch(err => console.error('Error loading battle stats:', err));
      
    // Lấy equipment
    fetch(`${API_BASE_URL}/api/pets/${player.id}/equipment`)
      .then(res => res.json())
      .then(setEquippedItems)
      .catch(err => console.error('Error loading equipment:', err));
    }, [player?.id]);
  
    useEffect(() => {
      if (player.current_hp <= 0 || enemy.current_hp <= 0) setBattleEnded(true);
    }, [player.current_hp, enemy.current_hp]);

    const gainExpIfVictory = async () => {
        if (player.current_hp > 0 && battleEnded) {
          // Cập nhật hunger status sau battle
          try {
            await fetch(`${API_BASE_URL}/api/pets/${player.id}/update-hunger-after-battle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (err) {
            console.error('Error updating hunger status after battle:', err);
          }
          try {
            const res = await fetch(`${API_BASE_URL}/api/pets/${player.id}/gain-exp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source: 'arena',
                enemy_level: enemy.level,
                custom_amount: null
              })
            });
            const updatedPet = await res.json();
            const oldLevel = player.level; // Lưu lại level cũ trước khi update
            // ✅ Update player stats nếu level up
            if (updatedPet.stats_updated && updatedPet.new_stats) {
              setPlayer(prev => ({ 
                ...prev, 
                level: updatedPet.level, 
                current_exp: updatedPet.current_exp,
                hp: updatedPet.new_stats.hp,
                max_hp: updatedPet.new_stats.hp,
                mp: updatedPet.new_stats.mp,
                max_mp: updatedPet.new_stats.mp,
                str: updatedPet.new_stats.str,
                def: updatedPet.new_stats.def,
                intelligence: updatedPet.new_stats.intelligence,
                spd: updatedPet.new_stats.spd,
                final_stats: updatedPet.new_stats
              }));
            } else {
              setPlayer(prev => ({ 
                ...prev, 
                level: updatedPet.level, 
                current_exp: updatedPet.current_exp 
              }));
            }

            console.log('Pet sau khi cộng EXP:', updatedPet);
            appendLog(`🎉 Chúc mừng ${player.name} nhận được ${updatedPet.gained} EXP`);
            if (updatedPet.level > oldLevel) {
              appendLog(`✨ ${player.name} đã lên cấp ${updatedPet.level}!`);
              if (updatedPet.stats_updated) {
                appendLog(`📊 Stat changes:`);
                const oldStats = updatedPet.old_stats;
                const newStats = updatedPet.new_stats;
                if (oldStats && newStats) {
                  const statChanges = [];
                  if (newStats.hp > oldStats.hp) statChanges.push(`HP: ${oldStats.hp} → ${newStats.hp} (+${newStats.hp - oldStats.hp})`);
                  if (newStats.str > oldStats.str) statChanges.push(`STR: ${oldStats.str} → ${newStats.str} (+${newStats.str - oldStats.str})`);
                  if (newStats.def > oldStats.def) statChanges.push(`DEF: ${oldStats.def} → ${newStats.def} (+${newStats.def - oldStats.def})`);
                  if (newStats.intelligence > oldStats.intelligence) statChanges.push(`INT: ${oldStats.intelligence} → ${newStats.intelligence} (+${newStats.intelligence - oldStats.intelligence})`);
                  if (newStats.spd > oldStats.spd) statChanges.push(`SPD: ${oldStats.spd} → ${newStats.spd} (+${newStats.spd - oldStats.spd})`);
                  if (newStats.mp > oldStats.mp) statChanges.push(`MP: ${oldStats.mp} → ${newStats.mp} (+${newStats.mp - oldStats.mp})`);
                  statChanges.forEach(change => appendLog(`   ${change}`));
                }
              }
            }
          } catch (err) {
            console.error('Lỗi khi cộng EXP sau chiến thắng:', err);
          }
        }
      };
    
      useEffect(() => {
        if (battleEnded && player.current_hp > 0) {
          gainExpIfVictory();
        }
      }, [battleEnded]);

      const resetBattle = () => {
        // ✅ Sử dụng stats hiện tại của player (có thể đã level up)
        const newPlayer = { 
          ...player, 
          current_hp: player.final_stats.hp 
        };
        const newEnemy = { ...enemyPet, current_hp: enemyPet.final_stats.hp };
        setPlayer(newPlayer);
        setEnemy(newEnemy);
        setTurn(0);
        setLog([]);
        setAutoMode(false);
        setIsBlitzMode(false);
        setBattleEnded(false);
        setAttackAnimation('');
        setResultEffect('');
        setActionLocked(false);
      
        // ✅ Gọi lại API lấy item trang bị
        fetch(`${API_BASE_URL}/api/pets/${newPlayer.id}/equipment`)
          .then(res => res.json())
          .then(setEquippedItems)
          .catch(err => console.error('Lỗi khi load trang bị (reset):', err));
      };
    useEffect(() => {
        if (location.state?._refresh) {
          resetBattle();
        }
      }, [location.state?._refresh]);

    return (
        <><Navbar />
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
              <p>Cấp độ: {player.level}</p>
              <div className="hp-bar">
                <div className="hp-fill" style={{ width: `${(player.current_hp / player.final_stats.hp) * 100}%` }}></div>
              </div>
              <progress style={{ width: `${(player.final_stats.hp / player.final_stats.hp) * 100}%` }} value={(expProgress - expToThisLevel)} max={expRequired}></progress>
            </div>
    
            <div className="pet-side">
              <img
                src={`/images/pets/${enemy.image}`}
                alt={enemy.name}
                className={attackAnimation === 'player' ? 'attack-flash' : ''}
                onAnimationEnd={() => setAttackAnimation('')}
              />
              <p>{enemy.name}</p>
              <p>Cấp độ: {enemy.level}</p>
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
                  // Sử dụng power trực tiếp từ item data
                  const power = item.power || 10;
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
                      <div style={{ fontSize: '12px' }}>🔧 {item.durability_left} uses left</div>
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
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button onClick={() => {
                navigate('/battle/pve/arena/arenabattle', {
                    state: { playerPet: player, enemyPet, _refresh: Date.now() }
                        });
                    }}>
                        🔁 Khiêu chiến lại
                </button>
            </div>
            </div>
            
          )}

            <li><Link to="/battle/pve/arena">Quay lại Đấu trường</Link></li>
            
        </div>
        </>
      );
    }

export default ArenaBattlePage;
