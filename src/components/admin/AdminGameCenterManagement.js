import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminGameCenterManagement.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function genId() {
  return `gc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** rarity trong DB → nhãn hiển thị trên vòng quay */
function mapItemRarityToWheel(dbRarity) {
  const k = String(dbRarity || '').toLowerCase();
  if (k === 'legendary') return 'SSR';
  if (k === 'epic') return 'Hiếm';
  if (k === 'rare') return 'Hiếm';
  return 'Thường';
}

function equipImageSrc(imageField) {
  const s = String(imageField || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `/images/equipments/${s}`;
}

function AdminGameCenterManagement() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('hub');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryErr, setInventoryErr] = useState('');
  const [pickerSegmentIdx, setPickerSegmentIdx] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user?.token || !user?.isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/admin/items`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await r.json().catch(() => []);
        if (cancelled) return;
        if (!r.ok) {
          const msg =
            typeof data.message === 'string'
              ? data.message
              : typeof data.error === 'string'
                ? data.error
                : `HTTP ${r.status}`;
          setInventoryErr(msg);
          setInventoryItems([]);
          return;
        }
        setInventoryItems(Array.isArray(data) ? data : []);
        setInventoryErr('');
      } catch (e) {
        if (!cancelled) {
          setInventoryErr(e.message || 'Lỗi tải danh sách item');
          setInventoryItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.token, user?.isAdmin]);

  const pickerFilteredItems = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const arr = inventoryItems.filter((it) => {
      if (!q) return true;
      const idStr = String(it.id ?? '');
      const codeStr = String(it.item_code ?? '');
      const nameStr = String(it.name ?? '').toLowerCase();
      return nameStr.includes(q) || idStr === q || codeStr.includes(q);
    });
    return arr.slice(0, 150);
  }, [inventoryItems, pickerSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/config`);
      const data = await r.json();
      setDraft(data);
    } catch (e) {
      setErr(e.message || 'Không tải được cấu hình');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) load();
  }, [user?.isAdmin, load]);

  const save = async () => {
    if (!user?.token || !draft) return;
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/game-center/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(draft),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setDraft(data.config || draft);
      alert('Đã lưu cấu hình Game center.');
    } catch (e) {
      setErr(e.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file, onUrl) => {
    if (!user?.token || !file) return;
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${API_BASE_URL}/api/admin/game-center/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: fd,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Upload thất bại');
    onUrl(data.url);
  };

  if (isLoading || loading || !draft) {
    return (
      <div className="gc-admin">
        <p>{isLoading || loading ? 'Đang tải...' : 'Không có dữ liệu.'}</p>
        {err && <p style={{ color: 'coral' }}>{err}</p>}
      </div>
    );
  }

  const TABS = [
    { id: 'hub', label: 'Nút hub / ảnh' },
    { id: 'wheel', label: 'Vòng quay' },
    { id: 'scratch', label: 'Vé cào' },
    { id: 'mystery', label: 'Hộp bí ẩn' },
    { id: 'beggar', label: 'Vua ăn mày' },
    { id: 'daily', label: 'Quà miễn phí' },
    { id: 'booth', label: 'Lucky booth' },
    { id: 'slot', label: 'Máy slot' },
    { id: 'guess', label: 'Đoán số' },
  ];

  const patch = (fn) => {
    setDraft((d) => {
      const next = JSON.parse(JSON.stringify(d));
      fn(next);
      return next;
    });
  };

  return (
    <div className="gc-admin">
      <div className="gc-admin__header">
        <div>
          <Link to="/admin/site-management">← Quản lý Site</Link>
          <h1 style={{ margin: '8px 0 0' }}>Quản lý Game center</h1>
          <p className="gc-admin__help">
            Chỉnh ảnh nút (upload hoặc dán path như <code>/images/entertainment/...</code>), tỉ lệ, giá vé,
            biểu tượng và điều kiện thắng. Lưu để áp dụng cho người chơi (GET{' '}
            <code>/api/game-center/config</code>).
          </p>
        </div>
        <div className="gc-admin__actions">
          <button type="button" className="gc-admin__btn gc-admin__btn--ghost" onClick={load}>
            Tải lại
          </button>
          <button type="button" className="gc-admin__btn" onClick={save} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {err && (
        <p style={{ color: '#b91c1c', marginBottom: 12 }} role="alert">
          {err}
        </p>
      )}

      <div className="gc-admin__tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'hub' && (
        <div className="gc-admin__panel">
          <h3>Nút trên hub Trung tâm giải trí</h3>
          <p className="gc-admin__help">Mỗi game một dòng: tiêu đề, mô tả, đường dẫn ảnh.</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Ảnh</th>
                <th>Đường dẫn ảnh</th>
                <th>Tiêu đề</th>
                <th>Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {(draft.hubGames || []).map((g, idx) => (
                <tr key={g.id || idx}>
                  <td style={{ width: 100 }}>{g.id}</td>
                  <td>
                    {g.imgSrc ? (
                      <img src={g.imgSrc} alt="" className="gc-admin__thumb" />
                    ) : (
                      '—'
                    )}
                    <div style={{ marginTop: 6 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            await uploadFile(f, (url) => {
                              patch((d) => {
                                d.hubGames[idx].imgSrc = url;
                              });
                            });
                          } catch (ex) {
                            alert(ex.message);
                          }
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      value={g.imgSrc || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        patch((d) => {
                          d.hubGames[idx].imgSrc = v;
                        });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={g.title || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.hubGames[idx].title = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={g.description || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.hubGames[idx].description = e.target.value;
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'wheel' && (
        <div className="gc-admin__panel">
          <h3>Vòng quay may mắn</h3>
          <div className="gc-admin__row">
            <label>
              Lượt mua tối đa / ngày
              <input
                type="number"
                min={1}
                value={draft.luckyWheel?.maxPurchasesPerDay ?? 2}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.maxPurchasesPerDay = Number(e.target.value) || 1;
                  })
                }
              />
            </label>
          </div>
          <p className="gc-admin__help">
            <strong>Weight (trọng số):</strong> dùng để tính xác suất <em>tương đối</em>. Công thức:{' '}
            <code>P(ô i) ≈ weight_i / Σ weight</code>.{' '}
            <strong>Weight càng cao thì ô đó càng dễ trúng</strong> — không phải “càng cao càng hiếm”.
          </p>

          <h3 style={{ marginTop: 20 }}>Ô cố định (luôn có)</h3>
          <p className="gc-admin__help">
            Hai ô <strong>Peta</strong> và <strong>Peta Gold</strong>: chỉnh nhãn, rarity, weight, và{' '}
            <strong>khoảng số lượng</strong> (min–max) khi trúng. Server/API có thể random trong khoảng hoặc trả
            một giá trị cố định nếu min = max.
          </p>
          <div className="gc-admin__row">
            <label>
              Ô Peta — nhãn
              <input
                value={draft.luckyWheel?.petaSlot?.label ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaSlot.label = e.target.value;
                  })
                }
              />
            </label>
            <label>
              Rarity
              <input
                value={draft.luckyWheel?.petaSlot?.rarity ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaSlot.rarity = e.target.value;
                  })
                }
              />
            </label>
            <label>
              Weight
              <input
                type="number"
                min={1}
                value={draft.luckyWheel?.petaSlot?.weight ?? 12}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaSlot.weight = Number(e.target.value) || 1;
                  })
                }
              />
            </label>
            <label>
              Loại (read-only)
              <input readOnly value={draft.luckyWheel?.petaSlot?.currency || 'peta'} />
            </label>
          </div>
          <div className="gc-admin__row">
            <label>
              Peta — số tối thiểu
              <input
                type="number"
                min={0}
                value={draft.luckyWheel?.petaSlot?.amountMin ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaSlot.amountMin = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Peta — số tối đa
              <input
                type="number"
                min={0}
                value={draft.luckyWheel?.petaSlot?.amountMax ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaSlot.amountMax = Number(e.target.value);
                  })
                }
              />
            </label>
          </div>
          <div className="gc-admin__row">
            <label>
              Ô Peta Gold — nhãn
              <input
                value={draft.luckyWheel?.petaGoldSlot?.label ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaGoldSlot.label = e.target.value;
                  })
                }
              />
            </label>
            <label>
              Rarity
              <input
                value={draft.luckyWheel?.petaGoldSlot?.rarity ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaGoldSlot.rarity = e.target.value;
                  })
                }
              />
            </label>
            <label>
              Weight
              <input
                type="number"
                min={1}
                value={draft.luckyWheel?.petaGoldSlot?.weight ?? 12}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaGoldSlot.weight = Number(e.target.value) || 1;
                  })
                }
              />
            </label>
            <label>
              Loại (read-only)
              <input readOnly value={draft.luckyWheel?.petaGoldSlot?.currency || 'petagold'} />
            </label>
          </div>
          <div className="gc-admin__row">
            <label>
              Peta Gold — số tối thiểu
              <input
                type="number"
                min={0}
                value={draft.luckyWheel?.petaGoldSlot?.amountMin ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaGoldSlot.amountMin = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Peta Gold — số tối đa
              <input
                type="number"
                min={0}
                value={draft.luckyWheel?.petaGoldSlot?.amountMax ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyWheel.petaGoldSlot.amountMax = Number(e.target.value);
                  })
                }
              />
            </label>
          </div>

          <h3 style={{ marginTop: 24 }}>Ô vật phẩm (admin thêm)</h3>
          <p className="gc-admin__help">
            Gắn <strong>vật phẩm từ DB</strong> (ảnh trong <code>/images/equipments/</code>) hoặc chỉ nhãn tay.
            Cột <strong>Weight</strong> cùng quy tắc như ô tiền tệ: số càng lớn → trúng càng hay (theo tỉ lệ).
          </p>
          {inventoryErr ? (
            <p className="gc-admin__help" style={{ color: '#b91c1c' }} role="alert">
              Không tải được catalog item: {inventoryErr}
            </p>
          ) : (
            <p className="gc-admin__help">
              Đã tải <strong>{inventoryItems.length}</strong> vật phẩm — dùng &quot;Chọn item&quot; để gán vào
              ô.
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Segment ID</th>
                <th>Item DB</th>
                <th>Nhãn</th>
                <th>Rarity</th>
                <th>Weight</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(draft.luckyWheel?.segments || []).map((s, idx) => (
                <tr key={s.id || idx}>
                  <td>
                    <input
                      value={s.id || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.luckyWheel.segments[idx].id = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {s.itemImage ? (
                        <img src={equipImageSrc(s.itemImage)} alt="" className="gc-admin__thumb" />
                      ) : (
                        <span className="gc-admin__thumb-placeholder">—</span>
                      )}
                      <div style={{ fontSize: 12, color: '#475569', maxWidth: 140 }}>
                        {s.itemId != null ? (
                          <>
                            #{s.itemId}
                            <br />
                            <span style={{ wordBreak: 'break-word' }}>{s.label || '—'}</span>
                          </>
                        ) : (
                          <>Chưa gắn</>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="gc-admin__btn gc-admin__btn--ghost"
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        onClick={() => {
                          setPickerSearch('');
                          setPickerSegmentIdx(idx);
                        }}
                        disabled={!inventoryItems.length}
                      >
                        Chọn item…
                      </button>
                      {s.itemId != null && (
                        <button
                          type="button"
                          className="gc-admin__btn gc-admin__btn--danger"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          onClick={() =>
                            patch((d) => {
                              const seg = d.luckyWheel.segments[idx];
                              seg.itemId = null;
                              seg.itemImage = '';
                            })
                          }
                        >
                          Gỡ
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      value={s.label || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.luckyWheel.segments[idx].label = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={s.rarity || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.luckyWheel.segments[idx].rarity = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={s.weight ?? 1}
                      onChange={(e) =>
                        patch((d) => {
                          d.luckyWheel.segments[idx].weight = Number(e.target.value) || 1;
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="gc-admin__btn gc-admin__btn--danger"
                      onClick={() =>
                        patch((d) => {
                          d.luckyWheel.segments.splice(idx, 1);
                        })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="gc-admin__btn gc-admin__btn--ghost"
            onClick={() =>
              patch((d) => {
                d.luckyWheel.segments.push({
                  id: genId(),
                  label: 'Phần thưởng mới',
                  rarity: 'Thường',
                  weight: 10,
                  itemId: null,
                  itemImage: '',
                });
              })
            }
          >
            + Thêm ô
          </button>

          <h3 style={{ marginTop: 24 }}>Lịch sử hiển thị (mock)</h3>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Giải</th>
                <th>Thời gian</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(draft.luckyWheel?.serverHistory || []).map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      value={row.user || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.luckyWheel.serverHistory[idx].user = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.prize || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.luckyWheel.serverHistory[idx].prize = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.time || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.luckyWheel.serverHistory[idx].time = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="gc-admin__btn gc-admin__btn--danger"
                      onClick={() =>
                        patch((d) => {
                          d.luckyWheel.serverHistory.splice(idx, 1);
                        })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="gc-admin__btn gc-admin__btn--ghost"
            onClick={() =>
              patch((d) => {
                if (!d.luckyWheel.serverHistory) d.luckyWheel.serverHistory = [];
                d.luckyWheel.serverHistory.push({ user: '', prize: '', time: '' });
              })
            }
          >
            + Thêm dòng lịch sử
          </button>
        </div>
      )}

      {tab === 'scratch' && (
        <div className="gc-admin__panel">
          <h3>Vé số cào</h3>
          <div className="gc-admin__row">
            <label>
              Giá vé 3 ô (Peta)
              <input
                type="number"
                min={0}
                value={draft.scratchLottery?.ticketPrice3 ?? 0}
                onChange={(e) =>
                  patch((d) => {
                    d.scratchLottery.ticketPrice3 = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Giá vé 5 ô (Peta)
              <input
                type="number"
                min={0}
                value={draft.scratchLottery?.ticketPrice5 ?? 0}
                onChange={(e) =>
                  patch((d) => {
                    d.scratchLottery.ticketPrice5 = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Cần trùng (vé 3 ô)
              <input
                type="number"
                min={1}
                max={3}
                value={draft.scratchLottery?.matchCountToWin3 ?? 3}
                onChange={(e) =>
                  patch((d) => {
                    d.scratchLottery.matchCountToWin3 = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Cần trùng (vé 5 ô)
              <input
                type="number"
                min={1}
                max={5}
                value={draft.scratchLottery?.matchCountToWin5 ?? 3}
                onChange={(e) =>
                  patch((d) => {
                    d.scratchLottery.matchCountToWin5 = Number(e.target.value);
                  })
                }
              />
            </label>
          </div>

          <h3>Biểu tượng vé</h3>
          <p className="gc-admin__help">Emoji hoặc để trống emoji và dùng ảnh URL. ID dùng để so khớp khi cào.</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nhãn</th>
                <th>Emoji</th>
                <th>Ảnh URL</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(draft.scratchLottery?.symbols || []).map((sym, idx) => (
                <tr key={sym.id || idx}>
                  <td>
                    <input
                      value={sym.id || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.scratchLottery.symbols[idx].id = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={sym.label || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.scratchLottery.symbols[idx].label = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={sym.emoji || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.scratchLottery.symbols[idx].emoji = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={sym.imageUrl || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.scratchLottery.symbols[idx].imageUrl = e.target.value;
                        })
                      }
                    />
                    <input
                      type="file"
                      accept="image/*"
                      style={{ marginTop: 4 }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          await uploadFile(f, (url) => {
                            patch((d) => {
                              d.scratchLottery.symbols[idx].imageUrl = url;
                            });
                          });
                        } catch (ex) {
                          alert(ex.message);
                        }
                        e.target.value = '';
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="gc-admin__btn gc-admin__btn--danger"
                      onClick={() =>
                        patch((d) => {
                          d.scratchLottery.symbols.splice(idx, 1);
                        })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="gc-admin__btn gc-admin__btn--ghost"
            onClick={() =>
              patch((d) => {
                d.scratchLottery.symbols.push({
                  id: genId(),
                  label: 'Mới',
                  emoji: '🎁',
                  imageUrl: '',
                });
              })
            }
          >
            + Biểu tượng
          </button>
        </div>
      )}

      {tab === 'mystery' && (
        <div className="gc-admin__panel">
          <h3>Hộp bí ẩn — tỉ lệ phần thưởng (weight)</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nhãn</th>
                <th>Rarity</th>
                <th>Weight %</th>
                <th>itemId (optional)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(draft.mysteryBox?.outcomes || []).map((o, idx) => (
                <tr key={o.id || idx}>
                  <td>
                    <input
                      value={o.id || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.mysteryBox.outcomes[idx].id = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={o.label || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.mysteryBox.outcomes[idx].label = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={o.rarity || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.mysteryBox.outcomes[idx].rarity = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={o.weight ?? 1}
                      onChange={(e) =>
                        patch((d) => {
                          d.mysteryBox.outcomes[idx].weight = Number(e.target.value);
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={o.itemId ?? ''}
                      onChange={(e) =>
                        patch((d) => {
                          const v = e.target.value.trim();
                          d.mysteryBox.outcomes[idx].itemId = v === '' ? null : Number(v) || v;
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="gc-admin__btn gc-admin__btn--danger"
                      onClick={() =>
                        patch((d) => {
                          d.mysteryBox.outcomes.splice(idx, 1);
                        })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="gc-admin__btn gc-admin__btn--ghost"
            onClick={() =>
              patch((d) => {
                d.mysteryBox.outcomes.push({
                  id: genId(),
                  label: 'Phần thưởng',
                  rarity: 'Thường',
                  weight: 10,
                  itemId: null,
                });
              })
            }
          >
            + Dòng
          </button>
        </div>
      )}

      {tab === 'beggar' && (
        <div className="gc-admin__panel">
          <h3>Vua ăn mày</h3>
          <div className="gc-admin__row">
            <label>
              Min Peta
              <input
                type="number"
                value={draft.beggarKing?.minPeta ?? 100}
                onChange={(e) =>
                  patch((d) => {
                    d.beggarKing.minPeta = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Max Peta
              <input
                type="number"
                value={draft.beggarKing?.maxPeta ?? 5000}
                onChange={(e) =>
                  patch((d) => {
                    d.beggarKing.maxPeta = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Cooldown (giờ)
              <input
                type="number"
                min={1}
                value={draft.beggarKing?.cooldownHours ?? 6}
                onChange={(e) =>
                  patch((d) => {
                    d.beggarKing.cooldownHours = Number(e.target.value);
                  })
                }
              />
            </label>
          </div>
        </div>
      )}

      {tab === 'daily' && (
        <div className="gc-admin__panel">
          <h3>Vật phẩm miễn phí — weight = tỉ lệ quay mỗi ngày (tương đối)</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Bậc</th>
                <th>Tên hiển thị</th>
                <th>itemId</th>
                <th>Weight</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(draft.dailyFree?.tiers || []).map((t, idx) => (
                <tr key={t.id || idx}>
                  <td>
                    <input
                      value={t.id || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.dailyFree.tiers[idx].id = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={t.tierLabel || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.dailyFree.tiers[idx].tierLabel = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={t.itemLabel || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.dailyFree.tiers[idx].itemLabel = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={t.itemId ?? ''}
                      onChange={(e) =>
                        patch((d) => {
                          const v = e.target.value.trim();
                          d.dailyFree.tiers[idx].itemId = v === '' ? null : Number(v) || v;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={t.dailyWeight ?? 1}
                      onChange={(e) =>
                        patch((d) => {
                          d.dailyFree.tiers[idx].dailyWeight = Number(e.target.value);
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="gc-admin__btn gc-admin__btn--danger"
                      onClick={() =>
                        patch((d) => {
                          d.dailyFree.tiers.splice(idx, 1);
                        })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="gc-admin__btn gc-admin__btn--ghost"
            onClick={() =>
              patch((d) => {
                d.dailyFree.tiers.push({
                  id: genId(),
                  tierLabel: 'Mới',
                  itemLabel: 'Quà',
                  itemId: null,
                  dailyWeight: 10,
                });
              })
            }
          >
            + Dòng
          </button>
        </div>
      )}

      {tab === 'booth' && (
        <div className="gc-admin__panel">
          <h3>Lucky booth / Xổ số</h3>
          <div className="gc-admin__row">
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={draft.luckyBooth?.dailyResetEnabled !== false}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyBooth.dailyResetEnabled = e.target.checked;
                  })
                }
              />
              Reset vé mỗi ngày (giao diện / logic sau)
            </label>
            <label>
              Giá vé (Peta)
              <input
                type="number"
                min={0}
                value={draft.luckyBooth?.ticketPrice ?? 1}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyBooth.ticketPrice = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Jackpot hiển thị (Peta)
              <input
                type="number"
                min={0}
                value={draft.luckyBooth?.jackpotPeta ?? 10000}
                onChange={(e) =>
                  patch((d) => {
                    d.luckyBooth.jackpotPeta = Number(e.target.value);
                  })
                }
              />
            </label>
          </div>
        </div>
      )}

      {tab === 'slot' && (
        <div className="gc-admin__panel">
          <h3>Icon guồng</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nhãn</th>
                <th>Emoji</th>
                <th>Ảnh URL</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(draft.slotMachine?.reelIcons || []).map((ic, idx) => (
                <tr key={ic.id || idx}>
                  <td>
                    <input
                      value={ic.id || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.reelIcons[idx].id = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={ic.label || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.reelIcons[idx].label = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={ic.emoji || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.reelIcons[idx].emoji = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={ic.imageUrl || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.reelIcons[idx].imageUrl = e.target.value;
                        })
                      }
                    />
                    <input
                      type="file"
                      accept="image/*"
                      style={{ marginTop: 4 }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          await uploadFile(f, (url) => {
                            patch((d) => {
                              d.slotMachine.reelIcons[idx].imageUrl = url;
                            });
                          });
                        } catch (ex) {
                          alert(ex.message);
                        }
                        e.target.value = '';
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="gc-admin__btn gc-admin__btn--danger"
                      onClick={() =>
                        patch((d) => {
                          d.slotMachine.reelIcons.splice(idx, 1);
                        })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="gc-admin__btn gc-admin__btn--ghost"
            onClick={() =>
              patch((d) => {
                d.slotMachine.reelIcons.push({
                  id: genId(),
                  label: 'Icon',
                  emoji: '⭐',
                  imageUrl: '',
                });
              })
            }
          >
            + Icon
          </button>

          <h3 style={{ marginTop: 24 }}>Điều kiện thắng</h3>
          <p className="gc-admin__help">
            <strong>triple_icon</strong>: ba ô cùng iconId (vd. seven). <strong>triple_same</strong>: ba ô giống
            nhau bất kỳ. <strong>any_pair</strong>: ít nhất một cặp.
          </p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>kind</th>
                <th>iconId (cho triple_icon)</th>
                <th>Nhãn</th>
                <th>Mô tả thưởng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(draft.slotMachine?.winRules || []).map((rule, idx) => (
                <tr key={rule.id || idx}>
                  <td>
                    <input
                      value={rule.id || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.winRules[idx].id = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={rule.kind || 'triple_same'}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.winRules[idx].kind = e.target.value;
                        })
                      }
                    >
                      <option value="triple_icon">triple_icon</option>
                      <option value="triple_same">triple_same</option>
                      <option value="any_pair">any_pair</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={rule.iconId || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.winRules[idx].iconId = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={rule.label || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.winRules[idx].label = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={rule.rewardDescription || ''}
                      onChange={(e) =>
                        patch((d) => {
                          d.slotMachine.winRules[idx].rewardDescription = e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="gc-admin__btn gc-admin__btn--danger"
                      onClick={() =>
                        patch((d) => {
                          d.slotMachine.winRules.splice(idx, 1);
                        })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="gc-admin__btn gc-admin__btn--ghost"
            onClick={() =>
              patch((d) => {
                d.slotMachine.winRules.push({
                  id: genId(),
                  kind: 'triple_same',
                  iconId: '',
                  label: 'Rule mới',
                  rewardDescription: 'Thưởng',
                });
              })
            }
          >
            + Rule
          </button>
        </div>
      )}

      {tab === 'guess' && (
        <div className="gc-admin__panel">
          <h3>Đoán số</h3>
          <div className="gc-admin__row">
            <label>
              Min số ẩn
              <input
                type="number"
                value={draft.guessNumber?.minSecret ?? 1}
                onChange={(e) =>
                  patch((d) => {
                    d.guessNumber.minSecret = Number(e.target.value);
                  })
                }
              />
            </label>
            <label>
              Max số ẩn
              <input
                type="number"
                value={draft.guessNumber?.maxSecret ?? 99}
                onChange={(e) =>
                  patch((d) => {
                    d.guessNumber.maxSecret = Number(e.target.value);
                  })
                }
              />
            </label>
          </div>
        </div>
      )}

      {pickerSegmentIdx != null && (
        <div
          className="gc-item-picker-overlay"
          role="presentation"
          onClick={() => setPickerSegmentIdx(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPickerSegmentIdx(null);
          }}
        >
          <div
            className="gc-item-picker-modal"
            role="dialog"
            aria-labelledby="gc-item-picker-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gc-item-picker-head">
              <h2 id="gc-item-picker-title">Chọn vật phẩm cho ô vòng quay</h2>
              <button type="button" className="gc-item-picker-close" onClick={() => setPickerSegmentIdx(null)}>
                ×
              </button>
            </div>
            <input
              type="search"
              className="gc-item-picker-search"
              placeholder="Tìm theo tên hoặc id..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
            />
            <p className="gc-admin__help">
              Hiển thị tối đa 150 kết quả — thu hẹp từ khóa nếu không thấy. Ảnh:{' '}
              <code>/images/equipments/&lt;image_url&gt;</code>
            </p>
            <ul className="gc-item-picker-list">
              {pickerFilteredItems.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    className="gc-item-picker-row"
                    onClick={() => {
                      const segIdx = pickerSegmentIdx;
                      patch((d) => {
                        const seg = d.luckyWheel.segments[segIdx];
                        seg.itemId = it.id != null ? Number(it.id) : null;
                        seg.itemImage = String(it.image_url || '').trim();
                        seg.label =
                          String(it.name || seg.label || '').trim() ||
                          `Item #${it.id}`;
                        seg.rarity = mapItemRarityToWheel(it.rarity);
                      });
                      setPickerSegmentIdx(null);
                      setPickerSearch('');
                    }}
                  >
                    {it.image_url ? (
                      <img src={equipImageSrc(it.image_url)} alt="" className="gc-item-picker-thumb" />
                    ) : (
                      <span className="gc-item-picker-thumb gc-item-picker-thumb--empty">?</span>
                    )}
                    <span className="gc-item-picker-meta">
                      <strong>#{it.id}</strong> {it.name}
                      <small>
                        {' '}
                        · {String(it.type || '')} · {mapItemRarityToWheel(it.rarity)}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!pickerFilteredItems.length && (
              <p style={{ padding: 16, color: '#64748b' }}>Không có item khớp tìm kiếm.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGameCenterManagement;
