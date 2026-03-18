// ArenaBattlePage.js - Trang chiến đấu PvE
import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import '../css/BattlePage.css';
import '../css/ArenaBattlePage.css';
import expTable from '../../data/exp_table_petaria.json';

function ArenaBattlePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useContext(UserContext) || {};
    const { playerPet, enemyPet, matchState: initialMatchState, useRedisMatch: useRedisMatchFromState } = location.state || {};
    const fromMatch = !!initialMatchState && !!useRedisMatchFromState;

    const [player, setPlayer] = useState(() => {
      if (fromMatch && initialMatchState?.player) return { ...initialMatchState.player, current_def_dmg: initialMatchState.player.current_def_dmg ?? 0 };
      return { ...playerPet, current_hp: playerPet?.current_hp || playerPet?.final_stats?.hp, current_def_dmg: 0 };
    });
    const [enemy, setEnemy] = useState(() => {
      if (fromMatch && initialMatchState?.enemy) return { ...initialMatchState.enemy, current_def_dmg: initialMatchState.enemy.current_def_dmg ?? 0 };
      return { ...enemyPet, current_hp: enemyPet?.current_hp || enemyPet?.final_stats?.hp, current_def_dmg: 0 };
    });
    const [turn, setTurn] = useState(fromMatch ? (initialMatchState?.turn_count ?? 0) : 0);
    const [isRedisMatch, setIsRedisMatch] = useState(!!useRedisMatchFromState);
    const playerRef = React.useRef(player);
    const enemyRef = React.useRef(enemy);
    playerRef.current = player;
    enemyRef.current = enemy;

    // Đảm bảo Boss có đủ action_pattern + skills (nếu vào trận với enemy thiếu dữ liệu)
    useEffect(() => {
      if (!enemyPet?.id || !enemyPet?.isBoss) return;
      const hasPattern = Array.isArray(enemyPet.action_pattern) && enemyPet.action_pattern.length > 0;
      const hasSkills = Array.isArray(enemyPet.skills) && enemyPet.skills.length > 0;
      if (hasPattern && hasSkills) return;
      fetch(`${process.env.REACT_APP_API_BASE_URL || ''}/api/bosses/${enemyPet.id}`)
        .then((r) => r.json())
        .then((boss) => {
          setEnemy((prev) => ({
            ...prev,
            ...boss,
            current_hp: prev.current_hp ?? boss.current_hp ?? boss.final_stats?.hp,
            action_pattern: boss.action_pattern ?? prev.action_pattern,
            skills: boss.skills ?? prev.skills,
          }));
        })
        .catch((err) => console.error('Load full boss for action_pattern:', err));
    }, [enemyPet?.id, enemyPet?.isBoss]);
    const [log, setLog] = useState(() => (fromMatch && Array.isArray(initialMatchState?.history) ? initialMatchState.history : []));
    const [autoMode, setAutoMode] = useState(false);
    const [isBlitzMode, setIsBlitzMode] = useState(false);
    const [battleEnded, setBattleEnded] = useState(false);
      const [equippedItems, setEquippedItems] = useState(() => {
        if (fromMatch && Array.isArray(initialMatchState?.equipment)) {
          return initialMatchState.equipment.map((e) => ({ ...e, image_url: e.image_url || '' }));
        }
        return [];
      });
  const [attackAnimation, setAttackAnimation] = useState('');
    const [resultEffect, setResultEffect] = useState('');
    const [actionLocked, setActionLocked] = useState(false);
    const [selectedAction, setSelectedAction] = useState('');
    const [battleReward, setBattleReward] = useState({ expGained: 0, levelUp: false, newLevel: null, loot: [] });
  
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const userName = user?.username || user?.name || 'Người chơi';

    const getItemImageSrc = (imageUrl) => {
      if (!imageUrl) return '/images/equipments/placeholder.png';
      if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
      return `/images/equipments/${imageUrl}`;
    };


    /** Công thức giống dùng item: Dmg_out / Def_dmg với R = random(power_min, power_max). Tấn công thường & Phòng thủ vật lý dùng cố định 7, 10. */
    const NORMAL_POWER_MIN = 7;
    const NORMAL_POWER_MAX = 10;

    const expProgress = Number(player.current_exp) || 0;
    const expToNextLevel = expTable[player.level + 1] ?? expTable[player.level] ?? 1;
  
    const appendLog = (entry, type = 'default') => {
      setLog((prev) => [...prev.slice(-49), { text: entry, type }]);
    };
    const logEndRef = React.useRef(null);
    useEffect(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log]);
  
    const checkBattleEnded = (nextEnemyHp, nextPlayerHp) => {
      if (nextEnemyHp <= 0 || nextPlayerHp <= 0) {
        setBattleEnded(true);
        setResultEffect(nextEnemyHp <= 0 ? 'win' : 'lose');
        return true;
      }
      return false;
    };

    const sendMatchTurn = async (payload) => {
      const res = await fetch(`${API_BASE_URL}/api/arena/match/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Turn failed');
      setPlayer({ ...data.player, current_def_dmg: data.player?.current_def_dmg ?? 0 });
      setEnemy({ ...data.enemy, current_def_dmg: data.enemy?.current_def_dmg ?? 0 });
      setLog(Array.isArray(data.history) ? data.history : []);
      if (Array.isArray(data.equipment)) setEquippedItems(data.equipment.map((e) => ({ ...e, image_url: e.image_url || '' })));
      setTurn(data.turn_count ?? 0);
      setBattleEnded(!!data.finished);
      setResultEffect(data.result || '');
      setAttackAnimation('player');
      return data;
    };
  
      const handleAttackWithItem = async (item) => {
      if (actionLocked) return;
      if (item.durability_left <= 0) return;
      setActionLocked(true);
      const powerMin = item.power_min != null ? item.power_min : 0;
      const powerMax = item.power_max != null ? item.power_max : 0;

      if (isRedisMatch) {
        try {
          await sendMatchTurn({ action: 'attack_item', itemId: item.id, power_min: powerMin, power_max: powerMax, moveName: item.item_name || 'Weapon' });
        } catch (err) {
          console.error('Match turn (attack_item):', err);
        }
        setActionLocked(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attacker: player,
            defender: enemy,
            movePower: item.power ?? 10,
            moveName: item.item_name || 'Weapon',
            power_min: powerMin,
            power_max: powerMax,
            defender_current_def_dmg: enemy.current_def_dmg ?? 0,
          })
        });
        const result = await res.json();
        if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, 'enemy_attack');
          setPlayer((prev) => ({ ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp }));
        } else {
          appendLog(`${result.attacker} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`, 'player_attack');
        }
        setEnemy((prev) => ({ ...prev, current_hp: result.defender_hp_after ?? Math.max(0, prev.current_hp - result.damage), current_def_dmg: 0 }));
        
        // Cập nhật durability trong database
        try {
          const durabilityRes = await fetch(`${API_BASE_URL}/api/inventory/${item.id}/use-durability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 1 })
          });
          const durabilityResult = await durabilityRes.json();
          
          if (durabilityResult.item_broken) {
            // Giữ item trong list với durability_left = 0 để sau trận gọi unequip
            setEquippedItems((prev) => prev.map(i => i.id === item.id ? { ...i, durability_left: 0, is_broken: true } : i));
            appendLog(`${item.item_name} đã bị hư hại!`, 'default');
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

        const newEnemyHp = result.defender_hp_after ?? Math.max(0, enemy.current_hp - result.damage);
        const newPlayerHp = result.reflectedDamage > 0 ? result.attacker_hp_after : player.current_hp;
        if (!checkBattleEnded(newEnemyHp, newPlayerHp)) {
          setTimeout(() => handleEnemyTurn(), 1500);
        } else {
          setActionLocked(false);
        }
      } catch (err) {
        console.error('Lỗi khi đánh bằng vũ khí:', err);
        setActionLocked(false);
      }
    };
  
    const handleDefend = async (shieldItem) => {
      if (actionLocked) return;
      if (!shieldItem || shieldItem.equipment_type !== 'shield' || shieldItem.durability_left <= 0) return;
      setActionLocked(true);
      const powerMin = shieldItem.power_min != null ? shieldItem.power_min : 0;
      const powerMax = shieldItem.power_max != null ? shieldItem.power_max : 0;
      if (isRedisMatch) {
        try {
          await sendMatchTurn({ action: 'defend_shield', itemId: shieldItem.id, power_min: powerMin, power_max: powerMax });
        } catch (err) {
          console.error('Match turn (defend_shield):', err);
        }
        setActionLocked(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-defend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defenderUnit: player,
            enemy,
            shield_power_min: powerMin,
            shield_power_max: powerMax,
          })
        });
        const result = await res.json();
        appendLog(result.logMessage || `${player.name} sử dụng Phòng thủ, thiết lập shield ${result.defDmg ?? 0} HP phòng ngự.`, 'defense');
        setPlayer((prev) => ({ ...prev, current_def_dmg: result.defDmg ?? 0 }));
        setTurn((prev) => prev + 1);
        try {
          const durRes = await fetch(`${API_BASE_URL}/api/inventory/${shieldItem.id}/use-durability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 1 })
          });
          const durData = await durRes.json();
          if (durData.item_broken) setEquippedItems((prev) => prev.map(i => i.id === shieldItem.id ? { ...i, durability_left: 0, is_broken: true } : i));
          else setEquippedItems((prev) => prev.map(i => i.id === shieldItem.id ? { ...i, durability_left: durData.durability_left } : i));
        } catch (_) {
          setEquippedItems((prev) => prev.map(i => i.id === shieldItem.id ? { ...i, durability_left: Math.max((i.durability_left || 1) - 1, 0) } : i));
        }
        if (!checkBattleEnded(enemy.current_hp, player.current_hp)) setTimeout(() => handleEnemyTurn(), 1500);
        else setActionLocked(false);
      } catch (err) {
        console.error('Lỗi khi phòng thủ:', err);
        setActionLocked(false);
      }
    };

    const handleNormalAttack = async () => {
      if (actionLocked) return;
      setActionLocked(true);
      if (isRedisMatch) {
        try {
          await sendMatchTurn({ action: 'normal_attack', power_min: NORMAL_POWER_MIN, power_max: NORMAL_POWER_MAX, moveName: 'Normal Attack' });
        } catch (err) {
          console.error('Match turn (normal_attack):', err);
        }
        setActionLocked(false);
        return;
      }
      const playerSpd = player?.final_stats?.spd ?? player?.spd ?? 0;
      const enemySpd = enemy?.final_stats?.spd ?? enemy?.spd ?? 0;
      const playerGoesFirst = playerSpd >= enemySpd;

      try {
        if (!playerGoesFirst) {
          const battleEndedAfterEnemy = await handleEnemyTurn();
          if (battleEndedAfterEnemy) return;
          setActionLocked(true);
        }
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attacker: player,
            defender: enemy,
            movePower: 10,
            moveName: 'Normal Attack',
            power_min: NORMAL_POWER_MIN,
            power_max: NORMAL_POWER_MAX,
            defender_current_def_dmg: enemy.current_def_dmg ?? 0,
          })
        });
        const result = await res.json();
        if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, 'enemy_attack');
          setPlayer((prev) => ({ ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp }));
        } else {
          appendLog(`${result.attacker} dùng ${result.moveUsed}, gây ${result.damage} sát thương.`, 'player_attack');
        }
        setEnemy((prev) => ({ ...prev, current_hp: result.defender_hp_after ?? Math.max(0, prev.current_hp - result.damage), current_def_dmg: 0 }));
        setTurn((prev) => prev + 1);
        setAttackAnimation('player');

        const newEnemyHp = result.defender_hp_after ?? Math.max(0, enemy.current_hp - result.damage);
        const newPlayerHp = result.reflectedDamage > 0 ? result.attacker_hp_after : player.current_hp;
        if (!checkBattleEnded(newEnemyHp, newPlayerHp) && playerGoesFirst) {
          setTimeout(() => handleEnemyTurn(), 1500);
        } else {
          setActionLocked(false);
        }
      } catch (err) {
        console.error('Lỗi khi tấn công thường:', err);
        setActionLocked(false);
      }
    };

    /** Phòng thủ vật lý cơ bản (không cần khiên): cùng công thức defend với khiên, dùng power cố định 7, 10. */
    const handleBasicDefend = async () => {
      if (actionLocked) return;
      setActionLocked(true);
      if (isRedisMatch) {
        try {
          await sendMatchTurn({ action: 'defend_basic', power_min: NORMAL_POWER_MIN, power_max: NORMAL_POWER_MAX });
        } catch (err) {
          console.error('Match turn (defend_basic):', err);
        }
        setActionLocked(false);
        return;
      }
      const playerSpd = player?.final_stats?.spd ?? player?.spd ?? 0;
      const enemySpd = enemy?.final_stats?.spd ?? enemy?.spd ?? 0;
      const playerGoesFirst = playerSpd >= enemySpd;
      try {
        if (!playerGoesFirst) {
          const battleEndedAfterEnemy = await handleEnemyTurn();
          if (battleEndedAfterEnemy) return;
          setActionLocked(true);
        }
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-defend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defenderUnit: player,
            enemy,
            shield_power_min: NORMAL_POWER_MIN,
            shield_power_max: NORMAL_POWER_MAX,
          })
        });
        const result = await res.json();
        appendLog(result.logMessage || `${player.name} sử dụng Phòng thủ vật lý, thiết lập shield ${result.defDmg ?? 0} HP phòng ngự.`, 'defense');
        setPlayer((prev) => ({ ...prev, current_def_dmg: result.defDmg ?? 0 }));
        setTurn((prev) => prev + 1);
        if (!checkBattleEnded(enemy.current_hp, player.current_hp) && playerGoesFirst) setTimeout(() => handleEnemyTurn(), 1500);
        else setActionLocked(false);
      } catch (err) {
        console.error('Lỗi khi phòng thủ vật lý:', err);
        setActionLocked(false);
      }
    };
  
    const handleEnemyTurn = async () => {
      const latestPlayer = playerRef.current;
      const latestEnemy = enemyRef.current;
      if (latestEnemy.current_hp <= 0 || latestPlayer.current_hp <= 0) return true;

      try {
        const payload = {
          attacker: latestEnemy,
          defender: latestPlayer,
          movePower: 10,
          moveName: 'Enemy Strike',
          isEnemyAttack: true,
          defender_current_def_dmg: latestPlayer.current_def_dmg ?? 0,
        };
        if (Array.isArray(latestEnemy.skills) && latestEnemy.skills.length > 0) payload.turnNumber = turn + 1;

        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        let ended = false;
        if (result.miss) {
          appendLog(`${result.attacker} dùng ${result.moveUsed} nhưng trượt!`);
        } else if (result.isBossDefend) {
          appendLog(`${result.attacker} sử dụng Phòng thủ, thiết lập shield ${result.bossDefDmg ?? 0} HP phòng ngự.`);
          setEnemy((prev) => ({ ...prev, current_def_dmg: result.bossDefDmg ?? 0 }));
        } else if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`);
          setPlayer((prev) => ({ ...prev, current_hp: result.defender_hp_after ?? prev.current_hp, current_def_dmg: 0 }));
          setEnemy((prev) => ({ ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp }));
          ended = checkBattleEnded(result.attacker_hp_after ?? enemy.current_hp, result.defender_hp_after ?? player.current_hp);
        } else {
          const newPlayerHp = result.defender_hp_after ?? Math.max(0, player.current_hp - (result.damage ?? 0));
          appendLog(`${result.attacker} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`, 'enemy_attack');
          setPlayer((prev) => ({ ...prev, current_hp: newPlayerHp, current_def_dmg: 0 }));
          ended = checkBattleEnded(enemy.current_hp, newPlayerHp);
        }

        setTurn((prev) => prev + 1);
        setAttackAnimation('enemy');
        return ended;
      } catch (err) {
        console.error('Enemy attack failed:', err);
        return false;
      } finally {
        setActionLocked(false);
      }
    };
  
    const handleBlitz = async () => {
      const firstWeapon = equippedItems.find(i => i.equipment_type !== 'shield');
      const playerPowerMin = firstWeapon?.power_min != null ? firstWeapon.power_min : 0;
      const playerPowerMax = firstWeapon?.power_max != null ? firstWeapon.power_max : 0;
      const firstAttackSkill = Array.isArray(enemy.skills) && enemy.skills.length
        ? enemy.skills.find(s => s.type === 'attack') || enemy.skills[0]
        : null;
      const enemyPowerMin = firstAttackSkill?.power_min ?? 80;
      const enemyPowerMax = firstAttackSkill?.power_max ?? 100;
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
            enemyMoveName: firstAttackSkill?.name || 'Bite',
            playerPowerMin,
            playerPowerMax,
            enemyPowerMin,
            enemyPowerMax,
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
  
  // Reconnect: nếu vào trang không có matchState nhưng user đã đăng nhập -> kiểm tra match đang chơi
  const [redisMatchRestored, setRedisMatchRestored] = useState(false);
  useEffect(() => {
    if (!user?.token || fromMatch || redisMatchRestored) return;
    fetch(`${API_BASE_URL}/api/arena/match/status`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404 && !playerPet) navigate('/battle/arena', { replace: true });
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (!data?.player) return;
        setPlayer({ ...data.player, current_def_dmg: data.player.current_def_dmg ?? 0 });
        setEnemy({ ...data.enemy, current_def_dmg: data.enemy.current_def_dmg ?? 0 });
        setTurn(data.turn_count ?? 0);
        setLog(Array.isArray(data.history) ? data.history : []);
        if (Array.isArray(data.equipment)) setEquippedItems(data.equipment.map((e) => ({ ...e, image_url: e.image_url || '' })));
        setRedisMatchRestored(true);
        setIsRedisMatch(true);
      })
      .catch(() => {
        if (!playerPet) navigate('/battle/arena', { replace: true });
      });
  }, [user?.token, fromMatch, redisMatchRestored, navigate, playerPet]);

      useEffect(() => {
    if (!player?.id) return;
    if (isRedisMatch) return; // Đã có từ matchState / status
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
    }, [player?.id, isRedisMatch]);
  
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

            setBattleReward((prev) => ({
              ...prev,
              expGained: updatedPet.gained ?? 0,
              levelUp: updatedPet.level > oldLevel,
              newLevel: updatedPet.level,
            }));
          } catch (err) {
            console.error('Lỗi khi cộng EXP sau chiến thắng:', err);
          }
          // Boss loot: gọi claim-loot khi thắng Boss
          if (enemy?.isBoss && enemy?.id && user?.token) {
            try {
              const lootRes = await fetch(`${API_BASE_URL}/api/arena/claim-loot`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${user.token}`,
                },
                body: JSON.stringify({ bossId: enemy.id, petId: player.id }),
              });
              const lootData = await lootRes.json();
              if (lootData.success && lootData.loot?.length > 0) {
                setBattleReward((prev) => ({ ...prev, loot: lootData.loot || [] }));
              }
            } catch (err) {
              console.error('Lỗi khi nhận loot Boss:', err);
            }
          }
        }
      };
    
      // Save HP to database after battle
      const savePlayerHP = async () => {
        try {
          await fetch(`${API_BASE_URL}/api/pets/${player.id}/update-hp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_hp: player.current_hp })
          });
        } catch (err) {
          console.error('Error saving player HP:', err);
        }
      };

      useEffect(() => {
        if (battleEnded) {
          if (player.current_hp > 0) {
            gainExpIfVictory();
          }
          if (!isRedisMatch) savePlayerHP();
          // Redis match: khi trận kết thúc luôn gọi terminate để xóa key, tránh 400 ACTIVE_MATCH khi khiêu chiến lại
          if (isRedisMatch) {
            fetch(`${API_BASE_URL}/api/arena/match/terminate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            }).catch(() => {}); // 404 = key đã xóa, bỏ qua
          }
          // Gỡ mọi item hết bền (broken) khỏi pet: gọi API unequip-broken theo pet để đồng bộ DB, sau đó unequip từng item trong state (fallback)
          const brokenIds = equippedItems.filter((i) => (i.durability_left ?? 1) <= 0).map((i) => i.id);
          if (player?.id) {
            fetch(`${API_BASE_URL}/api/pets/${player.id}/unequip-broken`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            }).catch((err) => console.error('Unequip broken (pet):', err));
          }
          brokenIds.forEach((id) => {
            fetch(`${API_BASE_URL}/api/inventory/${id}/unequip`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            }).catch((err) => console.error('Unequip broken item:', err));
          });
        }
      }, [battleEnded]);

      const handleLeaveBattle = async (e) => {
        if (!isRedisMatch || battleEnded) return;
        e?.preventDefault?.();
        if (!window.confirm('Nếu bạn rời đi, trận đấu sẽ tính là THUA.')) return;
        try {
          await fetch(`${API_BASE_URL}/api/arena/match/terminate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
          });
        } catch (err) {
          console.error('Terminate match:', err);
        }
        navigate('/battle/arena');
      };

      useEffect(() => {
        if (!isRedisMatch || battleEnded) return;
        const onBeforeUnload = (e) => {
          e.preventDefault();
          e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
      }, [isRedisMatch, battleEnded]);

      const resetBattle = () => {
        const newPlayer = { 
          ...player, 
          current_hp: player.current_hp || player.final_stats?.hp,
          current_def_dmg: 0,
        };
        const newEnemy = { ...enemyPet, current_hp: enemyPet?.current_hp ?? enemyPet?.final_stats?.hp, current_def_dmg: 0 };
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

      const handleGo = () => {
        if (!selectedAction || actionLocked) return;
        if (selectedAction === 'normal_attack') handleNormalAttack();
        else if (selectedAction === 'basic_defend') handleBasicDefend();
        setSelectedAction('');
      };

      const actionOptions = [
        { value: 'normal_attack', label: 'Tấn công thường' },
        { value: 'basic_defend', label: 'Phòng thủ vật lý' },
      ];

    if (battleEnded) {
      return (
        <TemplatePage showSearch={false} showTabs={false}>
          <div className={`arena-battle-result-screen ${resultEffect === 'win' ? 'arena-result-win' : 'arena-result-lose'}`}>
            <div className="arena-result-card">
              <h2 className="arena-result-title">{resultEffect === 'win' ? '🎉 Thắng lợi!' : '💀 Thất bại!'}</h2>
              {resultEffect === 'win' && (
                <div className="arena-result-rewards">
                  {battleReward.expGained > 0 && <p>+{battleReward.expGained} EXP</p>}
                  {battleReward.levelUp && <p>✨ Lên cấp {battleReward.newLevel}!</p>}
                  {battleReward.loot?.length > 0 && (
                    <div>
                      <p>Phần thưởng:</p>
                      <ul>
                        {battleReward.loot.map((entry, i) => (
                          <li key={i}>+{entry.quantity} {entry.item_id === 0 ? 'Peta' : entry.name || 'Item'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <button type="button" className="arena-result-back-btn" onClick={() => navigate('/battle/arena')}>
                Về Đấu trường
              </button>
            </div>
          </div>
        </TemplatePage>
      );
    }

    return (
        <TemplatePage showSearch={false} showTabs={false}>
        <div className="arena-battle-container">
          {/* Top: [Avatar + Speed] [HP bar + Name] | VS | [HP bar + Name] [Avatar + Speed] */}
          <header className="arena-battle-header">
            <div className="arena-header-player">
              <div className="arena-header-avatar-col">
                <div className="arena-header-avatar" style={{ backgroundImage: `url(/images/pets/${player?.image})` }} />
                <div className="arena-header-speed-box">
                  <img className="arena-speed-icon" src="/images/icons/speed.png" alt="" aria-hidden />
                  <span className="arena-speed-value">{player?.final_stats?.spd ?? player?.spd ?? 0}</span>
                </div>
              </div>
              <div className="arena-header-main">
                <div className="arena-header-hp">
                  <div className="arena-hp-bar">
                    <div className="arena-hp-fill" style={{ width: `${Math.max(0, ((player?.current_hp ?? 0) / (player?.final_stats?.hp ?? 1)) * 100)}%` }} />
                  </div>
                </div>
                <span className="arena-header-name">{userName}</span>
              </div>
            </div>
            <div className="arena-header-vs">VS</div>
            <div className="arena-header-enemy">
              <div className="arena-header-main">
                <div className="arena-header-hp">
                  <div className="arena-hp-bar enemy">
                    <div className="arena-hp-fill" style={{ width: `${Math.max(0, ((enemy?.current_hp ?? 0) / (enemy?.final_stats?.hp ?? 1)) * 100)}%` }} />
                  </div>
                </div>
                <span className="arena-header-name">{enemy?.name}</span>
              </div>
              <div className="arena-header-avatar-col">
                <div className="arena-header-avatar enemy" style={{ backgroundImage: `url(${enemy?.image})` }} />
                <div className="arena-header-speed-box">
                  <img className="arena-speed-icon" src="/images/icons/speed.png" alt="" aria-hidden />
                  <span className="arena-speed-value">{enemy?.final_stats?.spd ?? enemy?.spd ?? 0}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Middle: Pet images + name (with Lv) + stats (HP row, STR/DEF row) */}
          <div className="arena-battle-pets">
            <div className="arena-pet-block">
              <img src={`/images/pets/${player?.image}`} alt={player?.name} className={attackAnimation === 'enemy' ? 'attack-flash' : ''} onAnimationEnd={() => setAttackAnimation('')} />
              <p className="arena-pet-name">{player?.name} <span className="arena-pet-level">Lv.{player?.level ?? 1}</span></p>
              <div className="arena-pet-stats">
                <div className="arena-stats-row">HP: {player?.current_hp ?? 0}/{player?.final_stats?.hp ?? 0}</div>
                <div className="arena-stats-row">STR: {player?.final_stats?.str ?? player?.str ?? 0} · DEF: {player?.final_stats?.def ?? player?.def ?? 0}</div>
              </div>
            </div>
            <div className="arena-pet-block">
              <img src={enemy?.image} alt={enemy?.name} className={attackAnimation === 'player' ? 'attack-flash' : ''} onAnimationEnd={() => setAttackAnimation('')} />
              <p className="arena-pet-name">{enemy?.name} <span className="arena-pet-level">Lv.{enemy?.level ?? 1}</span></p>
              <div className="arena-pet-stats">
                <div className="arena-stats-row">HP: {enemy?.current_hp ?? 0}/{enemy?.final_stats?.hp ?? 0}</div>
                <div className="arena-stats-row">STR: {enemy?.final_stats?.str ?? enemy?.str ?? 0} · DEF: {enemy?.final_stats?.def ?? enemy?.def ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Battle log - scrollable */}
          <div className="arena-battle-log">
            <div className="arena-log-inner">
              {log.length === 0 && <div className="arena-log-line">Trận đấu bắt đầu!</div>}
              {log.map((entry, idx) => {
                const item = typeof entry === 'string' ? { text: entry, type: 'default' } : entry;
                return <div key={idx} className={`arena-log-line arena-log-${item.type}`}>{item.text}</div>;
              })}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Equipment - flex wrap; click item = trigger action directly */}
          <section className="arena-equipment-section">
            <h3 className="arena-equipment-title">Equipment</h3>
            <div className="arena-equipment-grid">
              {equippedItems.map((item) => {
                const isShield = item.equipment_type === 'shield';
                const magicVal = item.magic_value ?? item.power ?? 0;
                const disabled = (item.durability_left ?? 0) <= 0;
                const handleClick = () => {
                  if (actionLocked || disabled) return;
                  if (isShield) handleDefend(item);
                  else handleAttackWithItem(item);
                };
                return (
                  <div
                    key={item.id}
                    className={`arena-equipment-item ${disabled ? 'disabled' : ''}`}
                    onClick={handleClick}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onKeyDown={(e) => !disabled && (e.key === 'Enter' || e.key === ' ') && handleClick()}
                  >
                    <img src={getItemImageSrc(item.image_url)} alt={item.item_name} title={item.item_name} onError={(e) => { e.target.src = '/images/equipments/placeholder.png'; }} />
                    <span className="arena-equip-name">{item.item_name}</span>
                    <span className="arena-equip-stats">Độ bền: {item.durability_left ?? 0}/{item.max_durability ?? item.durability_left ?? 0}</span>
                    <span className="arena-equip-stats">Chỉ số Ma thuật: {magicVal}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Select ability + Go */}
          <div className="arena-action-row">
            <select
              className="arena-action-select"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              disabled={actionLocked}
            >
              <option value="">Chọn hành động cho {player?.name}</option>
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button type="button" className="arena-action-go" onClick={handleGo} disabled={!selectedAction || actionLocked}>
              Go!
            </button>
          </div>
        </div>
        </TemplatePage>
      );
    }

export default ArenaBattlePage;
