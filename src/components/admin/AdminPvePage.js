import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import {
  CHAMPION_NPCS,
  championRosterDefaults,
  championNpcInMode,
  fetchChampionRoster,
  peekLocalChampionRoster,
  readChampionRoster,
  writeChampionRoster,
} from '../battle/championNpcs';
import formationSystem from '../../data/formationSystem';
import './AdminNpcBossManagement.css';
import './AdminPvePage.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const MODE_PET_CAP = { '3v3': 3, '5v5': 5 };

const { formationsForMode, getFormation, normalizeFormationId } = formationSystem;

function slotChoiceLabel(formationId, index) {
  const formation = getFormation(normalizeFormationId(formationId));
  const line = index < formation.back ? 'Back' : 'Front';
  const place = index < formation.back ? index + 1 : index - formation.back + 1;
  return `${index + 1} · ${line} ${place}`;
}

function petSrc(file) {
  if (!file) return '/images/pets/placeholder.png';
  if (String(file).startsWith('/') || String(file).startsWith('http')) return file;
  return `/images/pets/${file}`;
}

function statsFromSpecies(species, level) {
  const lv = Math.max(1, Math.floor(Number(level)) || 1);
  const iv = 31;
  const baseOf = (base) => {
    const value = Number(base);
    return Number.isFinite(value) ? value : 10;
  };
  const stat = (base) => Math.floor(((2 * baseOf(base) + iv) * lv) / 100) + 5;
  const hp = (base) => (Math.floor(((2 * baseOf(base) + iv) * lv) / 100) + lv + 10) * 5;
  return {
    hp: hp(species.base_hp),
    str: stat(species.base_str),
    def: stat(species.base_def),
    spd: stat(species.base_spd),
  };
}

function matchSpecies(speciesList, pet) {
  const image = String(pet?.image || '').trim().toLowerCase();
  const name = String(pet?.name || '').trim().toLowerCase();
  return (
    speciesList.find((row) => image && String(row.image || '').trim().toLowerCase() === image) ||
    speciesList.find((row) => name && String(row.name || '').trim().toLowerCase() === name) ||
    null
  );
}

function mapPet(roster, npcId, mode, slotKey, updater) {
  return roster.map((npc) => {
    if (npc.npcId !== npcId) return npc;
    return {
      ...npc,
      formations: {
        ...npc.formations,
        [mode]: (npc.formations[mode] || []).map((pet) =>
          pet.slotKey === slotKey ? updater(pet) : pet
        ),
      },
    };
  });
}
function patchNpc(roster, npcId, field, value) {
  return roster.map((npc) => (npc.npcId === npcId ? { ...npc, [field]: value } : npc));
}

function patchPet(roster, npcId, mode, slotKey, field, value, speciesList) {
  return mapPet(roster, npcId, mode, slotKey, (pet) => {
    const next = { ...pet, [field]: value };
    if (field === 'hp' || field === 'str' || field === 'def' || field === 'spd') {
      return { ...next, autoStats: false };
    }
    if (!next.autoStats) return next;
    const species = matchSpecies(speciesList, next);
    if (!species || next.level === '' || next.level == null) return next;
    if (field === 'level' || field === 'name' || field === 'image') {
      return { ...next, ...statsFromSpecies(species, next.level) };
    }
    return next;
  });
}

function assignSpecies(roster, npcId, mode, slotKey, species) {
  return mapPet(roster, npcId, mode, slotKey, (pet) => {
    const level = pet.level === '' || pet.level == null ? 1 : pet.level;
    return {
      ...pet,
      name: species.name,
      image: species.image || '',
      level,
      autoStats: true,
      ...statsFromSpecies(species, level),
    };
  });
}

function addNpc(roster, mode) {
  return [
    ...roster,
    {
      npcId: `npc-${Date.now()}`,
      name: 'NPC mới',
      portrait: '',
      level: 1,
      element: 'normal',
      elementLabel: '',
      description: '',
      modes: [mode],
      formationIds: { '3v3': '2-1', '5v5': '3-2' },
      formations: { '3v3': [], '5v5': [] },
    },
  ];
}

function removeNpcFromMode(roster, npcId, mode) {
  return roster.flatMap((npc) => {
    if (npc.npcId !== npcId) return [npc];
    const modes = (Array.isArray(npc.modes) ? npc.modes : ['3v3', '5v5']).filter((item) => item !== mode);
    if (!modes.length) return [];
    return [{
      ...npc,
      modes,
      formations: { ...npc.formations, [mode]: [] },
    }];
  });
}

function addPet(roster, npcId, mode) {
  const cap = MODE_PET_CAP[mode] || 5;
  return roster.map((npc) => {
    if (npc.npcId !== npcId) return npc;
    const pets = [...(npc.formations[mode] || [])];
    if (pets.length >= cap) return npc;
    pets.push({
      slotKey: `e${pets.length + 1}`,
      name: '',
      image: '',
      level: '',
      hp: '',
      str: '',
      def: '',
      spd: '',
      autoStats: true,
    });
    return { ...npc, formations: { ...npc.formations, [mode]: pets } };
  });
}

function removePet(roster, npcId, mode, slotKey) {
  return roster.map((npc) => {
    if (npc.npcId !== npcId) return npc;
    const pets = (npc.formations[mode] || []).filter((pet) => pet.slotKey !== slotKey);
    return {
      ...npc,
      formations: {
        ...npc.formations,
        [mode]: pets.map((pet, index) => ({ ...pet, slotKey: `e${index + 1}` })),
      },
    };
  });
}

function movePetSlot(roster, npcId, mode, fromIndex, toIndex) {
  const from = Number(fromIndex);
  const to = Number(toIndex);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return roster;
  return roster.map((npc) => {
    if (npc.npcId !== npcId) return npc;
    const pets = [...(npc.formations[mode] || [])];
    if (from < 0 || to < 0 || from >= pets.length || to >= pets.length) return npc;
    const [moved] = pets.splice(from, 1);
    pets.splice(to, 0, moved);
    return {
      ...npc,
      formations: {
        ...npc.formations,
        [mode]: pets.map((pet, index) => ({ ...pet, slotKey: `e${index + 1}` })),
      },
    };
  });
}

function patchFormation(roster, npcId, mode, formationId) {
  return roster.map((npc) =>
    npc.npcId === npcId
      ? {
          ...npc,
          formationIds: { ...(npc.formationIds || {}), [mode]: formationId },
        }
      : npc
  );
}
function defaultInMode(npc, mode) {
  const modes = Array.isArray(npc?.modes) ? npc.modes : ['3v3', '5v5'];
  return modes.includes(mode);
}

function resetMode(roster, mode) {
  const defaults = championRosterDefaults().filter((npc) => defaultInMode(npc, mode));
  const next = roster.map((npc) => {
    const base = defaults.find((n) => n.npcId === npc.npcId);
    if (!base) return npc;
    const modes = Array.from(new Set([...(Array.isArray(npc.modes) ? npc.modes : ['3v3', '5v5']), mode]));
    return {
      ...npc,
      modes,
      formationIds: {
        ...(npc.formationIds || {}),
        [mode]: base.formationIds?.[mode],
      },
      formations: {
        ...npc.formations,
        [mode]: base.formations[mode],
      },
    };
  });
  defaults.forEach((base) => {
    if (next.some((npc) => npc.npcId === base.npcId)) return;
    next.push({
      ...base,
      modes: [mode],
      formations: {
        '3v3': mode === '3v3' ? base.formations['3v3'] : [],
        '5v5': mode === '5v5' ? base.formations['5v5'] : [],
      },
    });
  });
  return next;
}

function AdminPvePage() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [roster, setRoster] = useState(() => readChampionRoster());
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [species, setSpecies] = useState([]);

  useEffect(() => {
    if (!user?.token) return undefined;
    let cancel = false;
    (async () => {
      try {
        const result = await fetchChampionRoster({ force: true });
        if (cancel) return;
        if (!result.stored) {
          const local = peekLocalChampionRoster();
          if (local) {
            const next = await writeChampionRoster(local, user.token);
            if (!cancel) {
              setRoster(next);
              setMessageType('success');
              setMessage('Đã chuyển bản Champion trên trình duyệt này lên hệ thống.');
            }
            return;
          }
        }
        if (!cancel) setRoster(result.roster);
      } catch (err) {
        if (!cancel) {
          setMessageType('error');
          setMessage(err.message || 'Không tải được Champion PVE từ hệ thống.');
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token) return undefined;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/pet-species`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancel && Array.isArray(data)) setSpecies(data);
      } catch {
        /* nhập stat tay nếu không tải được loài */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.token]);

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) {
    return (
      <div className="admin-npc-boss">
        <div className="access-denied"><h2>Access Denied</h2></div>
      </div>
    );
  }

  const save = async () => {
    try {
      const next = await writeChampionRoster(roster, user.token);
      setRoster(next);
      setMessageType('success');
      setMessage('Đã lưu Champion PVE lên hệ thống. Mọi trình duyệt dùng bản này.');
    } catch (err) {
      setMessageType('error');
      setMessage(err.message || 'Không lưu được Champion PVE.');
    }
  };

  const restoreMode = (mode) => {
    setRoster((prev) => resetMode(prev, mode));
    setMessageType('success');
    setMessage(`Đã trả ${mode} về mặc định. Bấm Lưu để ghi.`);
  };

  return (
    <div className="admin-npc-boss admin-pve">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý PVE</h1>
          <p>Arena để trống. Champion điền sẵn đội mặc định — sửa ô rồi lưu.</p>
        </div>
        <button type="button" className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin
        </button>
      </div>

      {message ? <div className={`message ${messageType}`}>{message}</div> : null}

      <section className="section-card pve-block">
        <h2>Quản lý Arena PVE</h2>
        <p className="pve-note">Chưa mở.</p>
      </section>

      <section className="section-card pve-block">
        <h2>Champion</h2>
        <ModeDrop
          mode="3v3"
          title="3v3"
          open
          roster={roster}
          species={species}
          onAddNpc={() => {
            setRoster((prev) => addNpc(prev, '3v3'));
            setMessageType('success');
            setMessage('Đã thêm NPC vào 3v3. Thêm pet rồi Lưu.');
          }}
          onNpc={(npcId, field, value) => setRoster((prev) => patchNpc(prev, npcId, field, value))}
          onPet={(npcId, slotKey, field, value) =>
            setRoster((prev) => patchPet(prev, npcId, '3v3', slotKey, field, value, species))
          }
          onSpecies={(npcId, slotKey, picked) =>
            setRoster((prev) => assignSpecies(prev, npcId, '3v3', slotKey, picked))
          }
          onAddPet={(npcId) => setRoster((prev) => addPet(prev, npcId, '3v3'))}
          onRemovePet={(npcId, slotKey) => setRoster((prev) => removePet(prev, npcId, '3v3', slotKey))}
          onDeleteNpc={(npcId, name) => {
            if (!window.confirm(`Xóa ${name} khỏi 3v3?`)) return;
            setRoster((prev) => removeNpcFromMode(prev, npcId, '3v3'));
            setMessageType('success');
            setMessage(`Đã xóa ${name} khỏi 3v3. Bấm Lưu để Giải Vương cập nhật.`);
          }}
          onMove={(npcId, fromIndex, toIndex) =>
            setRoster((prev) => movePetSlot(prev, npcId, '3v3', fromIndex, toIndex))
          }
          onFormation={(npcId, formationId) =>
            setRoster((prev) => patchFormation(prev, npcId, '3v3', formationId))
          }
          onSave={save}
          onRestore={() => restoreMode('3v3')}
        />
        <ModeDrop
          mode="5v5"
          title="5v5"
          roster={roster}
          species={species}
          onAddNpc={() => {
            setRoster((prev) => addNpc(prev, '5v5'));
            setMessageType('success');
            setMessage('Đã thêm NPC vào 5v5. Thêm pet rồi Lưu.');
          }}
          onNpc={(npcId, field, value) => setRoster((prev) => patchNpc(prev, npcId, field, value))}
          onPet={(npcId, slotKey, field, value) =>
            setRoster((prev) => patchPet(prev, npcId, '5v5', slotKey, field, value, species))
          }
          onSpecies={(npcId, slotKey, picked) =>
            setRoster((prev) => assignSpecies(prev, npcId, '5v5', slotKey, picked))
          }
          onAddPet={(npcId) => setRoster((prev) => addPet(prev, npcId, '5v5'))}
          onRemovePet={(npcId, slotKey) => setRoster((prev) => removePet(prev, npcId, '5v5', slotKey))}
          onDeleteNpc={(npcId, name) => {
            if (!window.confirm(`Xóa ${name} khỏi 5v5?`)) return;
            setRoster((prev) => removeNpcFromMode(prev, npcId, '5v5'));
            setMessageType('success');
            setMessage(`Đã xóa ${name} khỏi 5v5. Bấm Lưu để Giải Vương cập nhật.`);
          }}
          onMove={(npcId, fromIndex, toIndex) =>
            setRoster((prev) => movePetSlot(prev, npcId, '5v5', fromIndex, toIndex))
          }
          onFormation={(npcId, formationId) =>
            setRoster((prev) => patchFormation(prev, npcId, '5v5', formationId))
          }
          onSave={save}
          onRestore={() => restoreMode('5v5')}
        />
        <p className="pve-note">3v3 mặc định có {CHAMPION_NPCS.length} trainer trong mã. 5v5 chưa có đội mặc định. Lưu ghi vào database, Champion Challenge đọc bản đó.</p>
      </section>
    </div>
  );
}

function ModeDrop({
  mode,
  title,
  open,
  roster,
  species,
  onAddNpc,
  onNpc,
  onPet,
  onSpecies,
  onAddPet,
  onRemovePet,
  onDeleteNpc,
  onMove,
  onFormation,
  onSave,
  onRestore,
}) {
  const [isOpen, setIsOpen] = useState(Boolean(open));
  const visible = roster.filter((npc) => championNpcInMode(npc, mode));
  const petCount = visible.reduce((sum, npc) => sum + (npc.formations[mode] || []).length, 0);

  return (
    <details
      className="pve-drop"
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary>{title}</summary>
      <div className="pve-drop__body">
        <div className="section-actions">
          <button type="button" className="btn btn-primary" onClick={onAddNpc}>Thêm NPC</button>
          <button type="button" className="btn btn-primary" onClick={onSave}>Lưu</button>
          <button type="button" className="btn btn-secondary" onClick={onRestore}>
            Khôi phục mặc định {title}
          </button>
          <span className="pet-species-total">Tổng: {petCount}</span>
        </div>
        {visible.map((npc) => (
          <NpcDrop
            key={npc.npcId}
            npc={npc}
            mode={mode}
            species={species}
            onNpc={onNpc}
            onPet={onPet}
            onSpecies={onSpecies}
            onAddPet={onAddPet}
            onRemovePet={onRemovePet}
            onDeleteNpc={onDeleteNpc}
            onMove={onMove}
            onFormation={onFormation}
          />
        ))}
      </div>
    </details>
  );
}

function NpcDrop({
  npc,
  mode,
  species,
  onNpc,
  onPet,
  onSpecies,
  onAddPet,
  onRemovePet,
  onDeleteNpc,
  onMove,
  onFormation,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pets = npc.formations[mode] || [];
  const cap = MODE_PET_CAP[mode] || pets.length;
  const formationId = normalizeFormationId(npc.formationIds?.[mode], mode);
  const formationChoices = formationsForMode(mode);
  const speciesOptions = [...species].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''))
  );

  return (
    <details
      className="pve-drop pve-drop--npc"
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary>
        <img className="pve-thumb pve-thumb--summary" src={petSrc(npc.portrait)} alt="" />
        <span>{npc.name}</span>
        <span className="pve-summary-meta">Rcmd Lv.{npc.level} · {npc.elementLabel}</span>
      </summary>
      <div className="pve-drop__body">
        <div className="pve-npc-fields">
          <label>
            NPC
            <input
              className="pve-input pve-input--name"
              value={npc.name}
              onChange={(e) => onNpc(npc.npcId, 'name', e.target.value)}
            />
          </label>
          <label>
            Hình NPC
            <img className="pve-thumb" src={petSrc(npc.portrait)} alt="" />
            <input
              className="pve-input"
              value={npc.portrait}
              onChange={(e) => onNpc(npc.npcId, 'portrait', e.target.value)}
            />
          </label>
          <label>
            Rcmd Lv
            <input
              className="pve-input pve-input--num"
              type="number"
              value={npc.level}
              onChange={(e) => onNpc(npc.npcId, 'level', e.target.value)}
            />
          </label>
          <label>
            Hệ
            <input
              className="pve-input pve-input--short"
              value={npc.elementLabel}
              onChange={(e) => onNpc(npc.npcId, 'elementLabel', e.target.value)}
            />
          </label>
          <label>
            Formation
            <select
              className="pve-input"
              value={formationId}
              onChange={(e) => onFormation(npc.npcId, e.target.value)}
            >
              {formationChoices.map((id) => {
                const formation = getFormation(id);
                return (
                  <option key={id} value={id}>
                    {formation.label} — {formation.title}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onDeleteNpc(npc.npcId, npc.name)}
          >
            Xóa khỏi {mode}
          </button>
        </div>
        <div className="section-actions pve-pet-bar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pets.length >= cap}
            onClick={() => onAddPet(npc.npcId)}
          >
            Thêm pet
          </button>
          <span className="pve-note">
            {pets.length}/{cap}. Chọn loài rồi nhập level — HP, STR, DEF, SPD tự điền (IV 31).
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Hình</th>
                <th>Loài</th>
                <th>name</th>
                <th>image</th>
                <th>level</th>
                <th>hp</th>
                <th>str</th>
                <th>def</th>
                <th>spd</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pets.map((pet, index) => {
                const matched = matchSpecies(species, pet);
                return (
                  <tr key={pet.slotKey}>
                    <td>
                      <select
                        className="pve-input pve-input--slot"
                        value={index}
                        onChange={(e) => onMove(npc.npcId, index, e.target.value)}
                      >
                        {pets.map((_, slotIndex) => (
                          <option key={slotIndex} value={slotIndex}>
                            {slotChoiceLabel(formationId, slotIndex)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <img
                        className="pve-thumb"
                        src={petSrc(pet.image)}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/images/background/pokeball-logo.svg';
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="pve-input pve-input--species"
                        value={matched ? String(matched.id) : ''}
                        onChange={(e) => {
                          const picked = species.find((row) => String(row.id) === e.target.value);
                          if (picked) onSpecies(npc.npcId, pet.slotKey, picked);
                        }}
                      >
                        <option value="">— loài —</option>
                        {speciesOptions.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="pve-input pve-input--name"
                        value={pet.name}
                        onChange={(e) => onPet(npc.npcId, pet.slotKey, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="pve-input"
                        value={pet.image}
                        onChange={(e) => onPet(npc.npcId, pet.slotKey, 'image', e.target.value)}
                      />
                    </td>
                    {['level', 'hp', 'str', 'def', 'spd'].map((field) => (
                      <td key={field}>
                        <input
                          className="pve-input pve-input--num"
                          type="number"
                          value={pet[field]}
                          onChange={(e) => onPet(npc.npcId, pet.slotKey, field, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => onRemovePet(npc.npcId, pet.slotKey)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export default AdminPvePage;
