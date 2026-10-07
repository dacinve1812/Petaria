const crypto = require('crypto');
const expTable = require('../../src/data/exp_table_petaria.json');
const { refreshPetIntrinsicStats } = require('../utils/petIntrinsicStats');
const petVitals = require('../petVitals');

function validateAction(state, body) {
  if (!Number.isInteger(body.expectedTurn) || body.expectedTurn !== state.turn_count) {
    return 'Lượt đấu đã thay đổi. Hãy tải lại trận đấu.';
  }
  if (!['normal_attack', 'attack_item', 'defend_basic', 'defend_shield'].includes(body.action)) return 'Hành động không hợp lệ.';
  if (['attack_item', 'defend_shield'].includes(body.action)) {
    const item = state.equipment.find(e => Number(e.id) === Number(body.itemId));
    if (!item || item.durability_left <= 0) return 'Trang bị không khả dụng.';
    if ((body.action === 'defend_shield') !== (item.equipment_type === 'shield')) return 'Sai loại trang bị.';
  }
  return null;
}

function createClassicBattle({ db, calculateLoot, calculateBattleExpGain, titleService, recordArenaTrainingUnlock }) {
  // MySQL advisory locks serialize all processes, and are released on disconnect.
  function serialize(handler) {
    return async (req,res) => {
      let connection, acquired=false;
      const key=`petaria:match:${req.classicUserId}`;
      try {
        connection=await db.getConnection();
        const [[row]]=await connection.query('SELECT GET_LOCK(?,3) AS acquired',[key]);
        acquired=Boolean(row.acquired);
        if(!acquired)return res.status(409).json({message:'Trận đấu đang được xử lý.'});
        // Keep the lock until the handler settles, even if the browser disconnects.
        await handler(req,res);
      } catch(error) {
        if(!res.headersSent)res.status(503).json({message:'Không thể xử lý trận đấu. Vui lòng thử lại.'});
      } finally {
        if(connection){
          try {if(acquired)await connection.query('SELECT RELEASE_LOCK(?)',[key]);}
          finally{connection.release();}
        }
      }
    };
  }

  async function register(state) {
    state.matchId = crypto.randomUUID();
    await db.query('INSERT INTO arena_match_receipts (match_id,user_id,pet_id) VALUES (?,?,?)', [state.matchId, state.userId, state.pet_id]);
  }

  async function finalize(state, winner) {
    if (!state.matchId) throw new Error('Trận cũ cần bắt đầu lại.');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[receipt]] = await conn.query('SELECT * FROM arena_match_receipts WHERE match_id=? AND user_id=? FOR UPDATE', [state.matchId, state.userId]);
      if (!receipt) throw new Error('Không tìm thấy trận đấu.');
      if (receipt.result_json) {
        Object.assign(state, typeof receipt.result_json === 'string' ? JSON.parse(receipt.result_json) : receipt.result_json);
        await conn.commit(); return;
      }
      const [[pet]] = await conn.query('SELECT * FROM pets WHERE id=? AND owner_id=? FOR UPDATE', [state.pet_id, state.userId]);
      if (!pet) throw new Error('Pet không còn thuộc người chơi.');
      const win = winner === 'player';
      const gained = win ? calculateBattleExpGain(state.boss_level) : 0;
      const newExp = Number(pet.current_exp || 0) + gained;
      let level = Number(pet.level);
      while (expTable[level + 1] && newExp >= expTable[level + 1]) level++;
      let hp = winner === 'enemy' ? 0 : Math.max(0, Math.floor(state.player.current_hp || 0));
      if (win && state.battleSource === 'arena' && typeof recordArenaTrainingUnlock === 'function') {
        const remainHp = Math.max(0, Math.floor(Number(state.player && state.player.current_hp) || 0));
        const maxHp = Math.max(0, Math.floor(Number(state.player && state.player.final_stats && state.player.final_stats.hp) || Number(pet.hp) || 0));
        if (maxHp > 0 && remainHp / maxHp > 0.5) {
          await recordArenaTrainingUnlock(conn, pet.id, state.boss_id);
        }
      }
      await conn.query(`UPDATE pets SET current_exp=?,level=?,current_hp=?,battles_won=COALESCE(battles_won,0)+?,battles_lost=COALESCE(battles_lost,0)+? WHERE id=?`, [newExp, level, hp, win ? 1 : 0, win ? 0 : 1, pet.id]);
      let stats = state.player.final_stats;
      if (level > pet.level) stats = (await refreshPetIntrinsicStats(conn, pet.id)).merged;
      const vitals = petVitals.applyBattlesIncrementToHunger(petVitals.clampHunger(pet.hunger_status), Number(pet.hunger_battles) || 0);
      await conn.query('UPDATE pets SET hunger_status=?,hunger_battles=? WHERE id=?',[vitals.hunger,vitals.hunger_battles,pet.id]);
      if(vitals.hunger===0)await conn.query('UPDATE pets SET current_hp=0,hp=0 WHERE id=?',[pet.id]);
      const [[savedPet]]=await conn.query('SELECT current_hp FROM pets WHERE id=?',[pet.id]);
      hp=Number(savedPet.current_hp);
      const loot = [];
      if (win) {
        const [[boss]] = await conn.query('SELECT drop_table FROM boss_templates WHERE id=?', [state.boss_id]);
        const table = typeof boss?.drop_table === 'string' ? JSON.parse(boss.drop_table) : boss?.drop_table;
        await conn.query('SELECT id FROM users WHERE id=? FOR UPDATE', [state.userId]);
        for (const entry of calculateLoot(Array.isArray(table) ? table : [])) {
          const quantity = Number(entry.quantity);
          if (!Number.isSafeInteger(quantity) || quantity <= 0) continue;
          if (Number(entry.item_id) === 0) {
            await conn.query('UPDATE users SET peta=peta+? WHERE id=?', [quantity, state.userId]);
            loot.push({ ...entry, quantity, name: 'Peta' });
            await titleService.recordPetaEarned(conn, state.userId, quantity);
            continue;
          }
          const [[item]] = await conn.query('SELECT id,name,type,image_url FROM items WHERE id=?', [entry.item_id]);
          if (!item) continue;
          if (item.type === 'equipment') {
            const [[equipment]] = await conn.query('SELECT durability_max FROM equipment_data WHERE item_id=?', [item.id]);
            for (let n=0;n<quantity;n++) await conn.query('INSERT INTO inventory (player_id,item_id,quantity,is_equipped,durability_left) VALUES (?,?,1,0,?)', [state.userId,item.id,equipment?.durability_max ?? 1]);
          } else {
            const [[existing]] = await conn.query('SELECT id FROM inventory WHERE player_id=? AND item_id=? AND COALESCE(is_equipped,0)=0 LIMIT 1 FOR UPDATE',[state.userId,item.id]);
            if (existing) await conn.query('UPDATE inventory SET quantity=quantity+? WHERE id=?',[quantity,existing.id]);
            else await conn.query('INSERT INTO inventory (player_id,item_id,quantity) VALUES (?,?,?)',[state.userId,item.id,quantity]);
          }
          loot.push({...entry,quantity,name:item.name,image_url:item.image_url});
        }
        await titleService.recordHuntWin(conn, state.userId, 1);
      }
      state.player = {...state.player, level, current_exp:newExp, current_hp:hp, final_stats:stats};
      state.finished = true;
      state.result = win ? 'win' : 'lose';
      state.reward = {expGained:gained,levelUp:level>pet.level,newLevel:level,loot};
      await conn.query('UPDATE arena_match_receipts SET result_json=?,finished_at=NOW() WHERE match_id=?',[JSON.stringify(state),state.matchId]);
      await conn.commit();
    } catch(error) { await conn.rollback(); throw error; }
    finally { conn.release(); }
  }
  return { serialize, register, finalize };
}
module.exports = { createClassicBattle, validateAction };
