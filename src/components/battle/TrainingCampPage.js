import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import GameDialogModal from '../ui/GameDialogModal';
import './TrainingCampPage.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

function mediaSrc(img) {
  if (!img) return '/images/placeholder.png';
  const value = String(img);
  if (value.startsWith('http') || value.startsWith('/')) return value;
  return `/images/pets/${value}`;
}

function formatNum(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function formatRemain(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} giờ ${String(minutes).padStart(2, '0')} phút ${String(seconds).padStart(2, '0')} giây`;
  if (minutes > 0) return `${minutes} phút ${String(seconds).padStart(2, '0')} giây`;
  return `${seconds} giây`;
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

function liveTicks(session, now) {
  if (!session) return 0;
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.endsAt).getTime();
  const elapsed = Math.floor(Math.max(0, Math.min(now, end) - start) / 60000);
  return Math.min(session.totalTicks, Math.max(session.processedTicks, elapsed));
}

function TrainingCampPage() {
  const { user, isLoading, updateUserData } = useContext(UserContext);
  const navigate = useNavigate();
  const [camp, setCamp] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [setup, setSetup] = useState(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [unlockSlot, setUnlockSlot] = useState(null);
  const [claimResult, setClaimResult] = useState(null);
  const tickBucket = useRef(0);
  const endedFetch = useRef(new Set());

  const load = useCallback(async () => {
    if (!user?.token) return;
    const res = await fetch(`${API_BASE}/api/training-camp`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      navigate('/login');
      return;
    }
    if (!res.ok) throw new Error(data.message || 'Không tải được Trại huấn luyện.');
    setCamp(data);
    if (data.balances) updateUserData({ peta: data.balances.peta, petagold: data.balances.petagold });
  }, [navigate, updateUserData, user?.token]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) navigate('/login');
  }, [isLoading, navigate, user]);

  useEffect(() => {
    if (!user?.token) return undefined;
    let cancelled = false;
    setError('');
    load().catch((err) => {
      if (!cancelled) setError(err.message || 'Không tải được Trại huấn luyện.');
    });
    return () => { cancelled = true; };
  }, [load, user?.token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!camp) return;
    const bucket = Math.floor(now / 60000);
    const overdue = (camp.slots || []).some((slot) => {
      const session = slot.session;
      if (!session) return false;
      return liveTicks(session, now) > session.processedTicks || (session.remainingMs > 0 && now >= new Date(session.endsAt).getTime());
    });
    if (!overdue || bucket === tickBucket.current) {
      const justEnded = (camp.slots || []).some((slot) => {
        const session = slot.session;
        return session && session.status === 'RUNNING' && now >= new Date(session.endsAt).getTime() && !endedFetch.current.has(session.id);
      });
      if (!justEnded) return;
      (camp.slots || []).forEach((slot) => {
        const session = slot.session;
        if (session && session.status === 'RUNNING' && now >= new Date(session.endsAt).getTime()) {
          endedFetch.current.add(session.id);
        }
      });
      load().catch(() => {});
      return;
    }
    tickBucket.current = bucket;
    load().catch(() => {});
  }, [camp, load, now]);

  const selectedPet = useMemo(
    () => (camp?.pets || []).find((pet) => pet.id === setup?.petId) || null,
    [camp, setup]
  );
  const selectedOpponent = useMemo(
    () => (camp?.opponents || []).find((boss) => boss.id === setup?.opponentId) || null,
    [camp, setup]
  );
  const selectedCost = selectedOpponent && setup?.minutes
    ? selectedOpponent.costs?.[setup.minutes]
    : null;

  async function runAction(task) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (err) {
      setError(err.message || 'Không thực hiện được.');
    } finally {
      setBusy(false);
    }
  }

  async function postJson(url, body) {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Yêu cầu thất bại.');
    if (data.balances) updateUserData({ peta: data.balances.peta, petagold: data.balances.petagold });
    return data;
  }

  function openSetup(slot) {
    setSetup({ slot: slot.index, petId: null, opponentId: null, minutes: 60 });
    setNotice('');
    setError('');
  }

  if (isLoading || !user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="tc-page"><p className="tc-muted">Đang tải...</p></div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="tc-page">
        <div className="tc-head">
          <button type="button" className="tc-back" onClick={() => navigate('/battle')}>Quay lại</button>
          <p>Mỗi phút tính như một trận thắng Arena. EXP dùng đúng công thức Arena và được tính lại khi pet lên cấp.</p>
        </div>

        {error && <p className="tc-error" role="alert">{error}</p>}
        {notice && <p className="tc-notice">{notice}</p>}
        {!camp && !error && <p className="tc-muted">Đang tải trại huấn luyện...</p>}

        <div className="tc-slots">
          {(camp?.slots || []).map((slot) => (
            <SlotCard
              key={slot.index}
              slot={slot}
              now={now}
              busy={busy}
              drafting={setup?.slot === slot.index ? setup : null}
              camp={camp}
              selectedCost={setup?.slot === slot.index ? selectedCost : null}
              onDraft={(patch) => setSetup((prev) => ({ ...prev, ...patch }))}
              onStart={() => setConfirmStart(true)}
              onCancelDraft={() => setSetup(null)}
              onArena={() => navigate('/battle/arena')}
              onSetup={() => openSetup(slot)}
              onUnlock={() => setUnlockSlot(slot)}
              onClaim={() => runAction(async () => {
                const petName = slot.session?.pet?.name;
                const result = await postJson(`/api/training-camp/sessions/${slot.session.id}/claim`);
                setClaimResult({ ...result, petName: result.petName || petName });
                await load();
              })}
            />
          ))}
        </div>

        <GameDialogModal
          isOpen={confirmStart}
          title="Xác nhận huấn luyện"
          confirmLabel={busy ? 'Đang xử lý…' : 'Trả phí và bắt đầu'}
          cancelLabel="Để sau"
          confirmDisabled={busy}
          onClose={() => !busy && setConfirmStart(false)}
          onCancel={() => setConfirmStart(false)}
          onConfirm={() => runAction(async () => {
            await postJson('/api/training-camp/sessions', {
              slot: setup.slot,
              petId: setup.petId,
              opponentId: setup.opponentId,
              durationMinutes: setup.minutes,
            });
            setConfirmStart(false);
            setSetup(null);
            setNotice('Đã bắt đầu huấn luyện. Không thể hủy giữa chừng.');
            await load();
          })}
        >
          <p>
            Gửi <strong>{selectedPet?.name}</strong> đánh <strong>{selectedOpponent?.name}</strong> trong{' '}
            <strong>{(setup?.minutes || 0) / 60} giờ</strong>.
          </p>
          <p>Phí {formatNum(selectedCost)} Peta. Pet sẽ bị khóa đến khi bạn nhận thưởng.</p>
        </GameDialogModal>

        <GameDialogModal
          isOpen={Boolean(unlockSlot)}
          title={unlockSlot ? `Mở ô #${unlockSlot.index}` : ''}
          confirmLabel={busy ? 'Đang xử lý…' : 'Mở vĩnh viễn'}
          cancelLabel="Để sau"
          confirmDisabled={busy}
          onClose={() => !busy && setUnlockSlot(null)}
          onCancel={() => setUnlockSlot(null)}
          onConfirm={() => runAction(async () => {
            const result = await postJson(`/api/training-camp/slots/${unlockSlot.index}/unlock`);
            setNotice(result.message);
            setUnlockSlot(null);
            await load();
          })}
        >
          {unlockSlot && (
            <p>
              Mở vĩnh viễn với <strong>{formatNum(unlockSlot.cost)} {unlockSlot.currency === 'petagold' ? 'Petagold' : 'Peta'}</strong>.
              {unlockSlot.vipLevel > 0 && ` Ô này cũng mở khi bạn đạt VIP ${unlockSlot.vipLevel}.`}
            </p>
          )}
        </GameDialogModal>

        <GameDialogModal
          isOpen={Boolean(claimResult)}
          title="Đã nhận thưởng"
          cancelLabel="Đóng"
          confirmLabel="Xem hồ sơ"
          confirmDisabled={!claimResult?.petUuid}
          onClose={() => setClaimResult(null)}
          onCancel={() => setClaimResult(null)}
          onConfirm={() => {
            const uuid = claimResult?.petUuid;
            setClaimResult(null);
            if (uuid) navigate(`/pet/${uuid}`);
          }}
        >
          {claimResult && (
            <>
              <p>
                Chúc mừng thú cưng <strong>{claimResult.petName}</strong> đã tăng đến level {formatNum(claimResult.endLevel)}.
              </p>
              <p>Tổng EXP: <strong>{formatNum(claimResult.expGained)}</strong></p>
            </>
          )}
        </GameDialogModal>
      </div>
    </TemplatePage>
  );
}

function SlotCard({
  slot, now, busy, onSetup, onUnlock, onClaim,
  drafting, camp, selectedCost, onDraft, onStart, onCancelDraft, onArena,
}) {
  const session = slot.session;
  if (!slot.unlocked && !session) {
    const vipOpen = slot.vipLevel > 0;
    return (
      <article className="tc-card is-locked">
        <h2>Ô #{slot.index}</h2>
        <p>{slot.label}</p>
        {vipOpen && <p className="tc-hint">VIP {slot.vipLevel} dùng được ô này mà không cần mua. Mua để giữ ô khi hết VIP.</p>}
        <button type="button" className="tc-primary" disabled={busy} onClick={onUnlock}>
          Mở với {formatNum(slot.cost)} {slot.currency === 'petagold' ? 'Petagold' : 'Peta'}
        </button>
      </article>
    );
  }

  if (!session && drafting && camp) {
    const unlocked = new Set(camp.petUnlocks?.[drafting.petId] || camp.petUnlocks?.[String(drafting.petId)] || []);
    const opponent = (camp.opponents || []).find((boss) => boss.id === drafting.opponentId);
    return (
      <article className="tc-card tc-card-draft">
        <div className="tc-setup-head">
          <h2>Ô #{slot.index}</h2>
          <button type="button" className="tc-text-btn" onClick={onCancelDraft}>Đóng</button>
        </div>
        <label className="tc-field">
          Pet
          <select
            value={drafting.petId || ''}
            onChange={(event) => onDraft({
              petId: event.target.value ? Number(event.target.value) : null,
              opponentId: null,
            })}
          >
            <option value="">Chọn pet</option>
            {(camp.pets || []).map((pet) => (
              <option key={pet.id} value={pet.id} disabled={!pet.canTrain}>
                {pet.name} — cấp {pet.level}{pet.reason ? ` (${pet.reason})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="tc-field">
          Đối thủ
          <select
            value={drafting.opponentId || ''}
            disabled={!drafting.petId}
            onChange={(event) => onDraft({
              opponentId: event.target.value ? Number(event.target.value) : null,
            })}
          >
            <option value="">{drafting.petId ? 'Chọn đối thủ' : 'Chọn pet trước'}</option>
            {(camp.opponents || []).map((boss) => {
              const open = unlocked.has(boss.id);
              return (
                <option key={boss.id} value={boss.id} disabled={!open}>
                  {boss.name} — cấp {boss.level}{open ? '' : ' (chưa mở)'}
                </option>
              );
            })}
          </select>
        </label>
        {!drafting.petId && <p className="tc-hint">Pet phải không Active, không đang đấu và không đang huấn luyện.</p>}
        {drafting.petId && unlocked.size === 0 && (
          <p className="tc-hint">Đánh bại đối thủ trong Arena với HP còn trên 50%.</p>
        )}
        <label className="tc-field">
          Thời gian
          <select
            value={drafting.minutes}
            onChange={(event) => onDraft({ minutes: Number(event.target.value) })}
          >
            {(camp.durations || []).map((row) => {
              const price = opponent ? opponent.costs[row.minutes] : null;
              return (
                <option key={row.minutes} value={row.minutes}>
                  {row.hours} giờ · {formatNum(row.battles)} trận
                  {price != null ? ` · ${formatNum(price)} Peta` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <p className="tc-hint">Phí trả một lần khi bắt đầu, không hủy giữa chừng.</p>
        <button type="button" className="tc-text-btn" onClick={onArena}>Đi đến Arena</button>
        <button
          type="button"
          className="tc-primary"
          disabled={busy || !drafting.petId || !drafting.opponentId || selectedCost == null}
          onClick={onStart}
        >
          Bắt đầu · {selectedCost != null ? `${formatNum(selectedCost)} Peta` : '—'}
        </button>
      </article>
    );
  }

  if (!session) {
    return (
      <article className="tc-card">
        <h2>Ô #{slot.index}</h2>
        <p className="tc-muted">Ô trống</p>
        {!slot.purchased && slot.index > 1 && (
          <p className="tc-hint">Ô đang mở nhờ VIP. Có thể mua vĩnh viễn để giữ khi hết VIP.</p>
        )}
        <button type="button" className="tc-primary" disabled={busy} onClick={onSetup}>Bắt đầu huấn luyện</button>
        {!slot.purchased && slot.index > 1 && (
          <button type="button" className="tc-text-btn" disabled={busy} onClick={onUnlock}>
            Mua vĩnh viễn · {formatNum(slot.cost)} {slot.currency === 'petagold' ? 'Petagold' : 'Peta'}
          </button>
        )}
      </article>
    );
  }

  const ticks = liveTicks(session, now);
  const remain = Math.max(0, new Date(session.endsAt).getTime() - now);
  const percent = session.totalTicks > 0 ? Math.min(100, Math.round((ticks / session.totalTicks) * 100)) : 0;
  const finished = remain <= 0 || session.status === 'COMPLETED';

  return (
    <article className="tc-card">
      <h2>Ô #{slot.index}</h2>
      <div className="tc-pair">
        <figure>
          <img src={mediaSrc(session.pet.image)} alt="" />
          <figcaption>{session.pet.name}<br />Cấp gửi {session.startLevel}</figcaption>
        </figure>
        <figure>
          <img src={mediaSrc(session.opponent.image)} alt="" />
          <figcaption>{session.opponent.name}<br />NPC cấp {session.opponent.level}</figcaption>
        </figure>
      </div>
      <p>{finished ? 'Đã hoàn thành' : `Còn ${formatRemain(remain)}`}</p>
      <p>Trận {formatNum(ticks)} / {formatNum(session.totalTicks)}</p>
      <div className="tc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={session.totalTicks} aria-valuenow={ticks}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <p>EXP chờ nhận: <strong>{formatNum(session.pendingExp)}</strong></p>
      <p>Cấp khi nhận: {session.startLevel} → {session.projectedLevel} (+{session.levelsGained})</p>
      <p className="tc-hint">Kết thúc: {formatWhen(session.endsAt)}</p>
      {finished && (
        <button type="button" className="tc-primary" disabled={busy} onClick={onClaim}>Nhận thưởng</button>
      )}
    </article>
  );
}

export default TrainingCampPage;
