import React, { useEffect, useState } from 'react';
import {
  getBattleFxById,
  getBattleFxByNumId,
  getHydratedBattleFxCatalog,
  loadBattleFxCatalogAsync,
  resolveBattleFxImageUrl,
  cssBackgroundUrl,
  keyNearBlackToTransparent,
} from '../../data/battleFxCatalog';

function resolveEntry(fxId, fxNumId, catalog) {
  if (fxNumId != null && String(fxNumId).trim() !== '') {
    return getBattleFxByNumId(fxNumId, catalog, {
      fallback: Number(fxNumId) === 1,
    });
  }
  if (fxId) return getBattleFxById(fxId, catalog);
  return null;
}

async function prepareFxUrl(entry) {
  const raw = resolveBattleFxImageUrl(entry) || '';
  if (!raw) return '';
  // Sheet nền đen (Mugen/AI): luôn key → alpha; screen trên sàn tối vẫn sạch
  const keyed = await keyNearBlackToTransparent(raw, 36);
  return keyed || raw;
}

/**
 * Runtime sprite-sheet FX overlay — resolve theo numId (battle / skills.animation_id).
 * Áp blendMode từ catalog; xóa nền đen → alpha trước khi vẽ.
 */
export default function BattleFxOverlay({ fxId, fxNumId, token, className = '' }) {
  const boot = () => {
    const cfg = getHydratedBattleFxCatalog();
    const e = resolveEntry(fxId, fxNumId, cfg || undefined);
    return { entry: e, url: resolveBattleFxImageUrl(e) || '' };
  };

  const [entry, setEntry] = useState(() => boot().entry);
  const [readyUrl, setReadyUrl] = useState('');
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setReadyUrl('');

    const apply = async (e) => {
      if (cancelled) return;
      setEntry(e);
      const url = await prepareFxUrl(e);
      if (!cancelled) setReadyUrl(url);
    };

    const cached = boot();
    if (cached.entry) apply(cached.entry);
    else setEntry(null);

    loadBattleFxCatalogAsync()
      .then((cfg) => {
        if (cancelled) return;
        return apply(resolveEntry(fxId, fxNumId, cfg));
      })
      .catch(() => {
        if (cancelled) return;
        return apply(resolveEntry(fxId, fxNumId));
      });

    return () => {
      cancelled = true;
    };
  }, [fxId, fxNumId, token]);

  useEffect(() => {
    const onCfg = (e) => {
      const ent = resolveEntry(fxId, fxNumId, e.detail);
      setEntry(ent);
      prepareFxUrl(ent).then((url) => setReadyUrl(url));
    };
    window.addEventListener('petaria-battle-fx-catalog', onCfg);
    return () => window.removeEventListener('petaria-battle-fx-catalog', onCfg);
  }, [fxId, fxNumId]);

  useEffect(() => {
    if (!entry || !token || !readyUrl) return undefined;
    const cols = entry.cols || 1;
    const rows = entry.rows || 1;
    const count = Math.min(entry.frameCount || cols * rows, cols * rows);
    const per = Math.max(16, Math.round((entry.durationMs || 550) / count));
    let i = 0;
    setFrame(0);
    let intervalId = null;
    const delayId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        i += 1;
        if (i >= count) {
          window.clearInterval(intervalId);
          setFrame(count - 1);
          return;
        }
        setFrame(i);
      }, per);
    }, entry.delayMs || 0);
    return () => {
      window.clearTimeout(delayId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [entry, token, readyUrl]);

  if (!entry || !token || !readyUrl) return null;

  const cols = entry.cols || 1;
  const rows = entry.rows || 1;
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  const posX = cols <= 1 ? 0 : (col / (cols - 1)) * 100;
  const posY = rows <= 1 ? 0 : (row / (rows - 1)) * 100;
  const blend = entry.blendMode === 'normal' ? 'normal' : entry.blendMode || 'normal';

  return (
    <span
      className={`abm-battle-fx ${className}`.trim()}
      aria-hidden
      data-blend={blend}
      style={{
        backgroundImage: cssBackgroundUrl(readyUrl),
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${posX}% ${posY}%`,
        mixBlendMode: blend,
      }}
    />
  );
}
