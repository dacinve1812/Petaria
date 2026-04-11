import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import regionMapsData from '../config/region-maps.json';
import { fetchPublicHuntingMapList } from '../api/huntingMapsApi';
import { loadAllCustomMaps } from '../utils/huntingMapsStorage';
import { mergeRemoteAndLocalHuntingCatalog } from '../game/map/huntingMapCatalog';
import './HuntConfirmPage.css';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getSpotList(region) {
  const fromAreas = (Array.isArray(region?.originalCoordinates) ? region.originalCoordinates : []).map(
    (item) => ({
      ...item,
      spotName: item.name || '',
      sourceType: 'area',
    })
  );
  const fromButtons = (Array.isArray(region?.mapButtons) ? region.mapButtons : []).map((item) => ({
    ...item,
    spotName: item.name || item.label || '',
    sourceType: 'button',
  }));
  return [...fromAreas, ...fromButtons];
}

function extractMapIdFromPath(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  const m = raw.match(/\/hunting-world\/map\/([^/?#]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  try {
    const url = new URL(raw, window.location.origin);
    return url.searchParams.get('mapId') || '';
  } catch {
    return '';
  }
}

function HuntConfirmPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [balance, setBalance] = useState({ peta: 0, petagold: 0 });
  const [balanceLoading, setBalanceLoading] = useState(true);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const regionId = searchParams.get('regionId') || '';
  const spotId = searchParams.get('spotId') || '';
  const spotName = searchParams.get('spotName') || '';
  const mapIdFromQuery = searchParams.get('mapId') || '';

  const region = useMemo(
    () => (regionMapsData.regions || []).find((item) => item.id === regionId) || null,
    [regionId]
  );

  const spot = useMemo(() => {
    if (!region) return null;
    const spots = getSpotList(region);
    const spotNameNorm = normalizeText(spotName);
    const byBoth = spots.find(
      (item) =>
        String(item.id ?? '') === String(spotId) &&
        spotNameNorm &&
        normalizeText(item.spotName) === spotNameNorm
    );
    if (byBoth) return byBoth;
    const byName = spots.find((item) => spotNameNorm && normalizeText(item.spotName) === spotNameNorm);
    if (byName) return byName;
    const byId = spots.find((item) => String(item.id ?? '') === String(spotId));
    return byId || null;
  }, [region, spotId, spotName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const remote = await fetchPublicHuntingMapList();
        const local = loadAllCustomMaps();
        if (!cancelled) {
          setCatalog(mergeRemoteAndLocalHuntingCatalog(remote, local).filter((m) => !m.builtIn));
        }
      } catch {
        const local = loadAllCustomMaps();
        if (!cancelled) {
          setCatalog(mergeRemoteAndLocalHuntingCatalog([], local).filter((m) => !m.builtIn));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user?.userId) {
      setBalance({ peta: 0, petagold: 0 });
      setBalanceLoading(false);
      return;
    }
    setBalanceLoading(true);
    fetch(`${API_BASE_URL}/users/${user.userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setBalance({
          peta: Number(data.peta ?? 0),
          petagold: Number(data.petagold ?? 0),
        });
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, user?.userId]);

  const resolvedMap = useMemo(() => {
    const byId = (id) => catalog.find((m) => String(m.id) === String(id));
    const byName = (name) =>
      catalog.find((m) => normalizeText(m.name) === normalizeText(name));

    const idCandidates = [
      mapIdFromQuery,
      spot?.huntingMapId,
      extractMapIdFromPath(spot?.path),
    ].filter(Boolean);

    for (const id of idCandidates) {
      const hit = byId(id);
      if (hit) return hit;
    }

    if (spot?.spotName) {
      const hitByName = byName(spot.spotName);
      if (hitByName) return hitByName;
    }
    return null;
  }, [catalog, mapIdFromQuery, spot]);

  const displayName = resolvedMap?.name || spot?.spotName || 'Khu săn chưa cấu hình';
  const displayCurrency = resolvedMap?.currency || spot?.currency || 'peta';
  const displayEntryFee = Number(resolvedMap?.entryFee ?? spot?.entryFee ?? 0) || 0;
  const displayMaxSteps = resolvedMap?.maxSteps ?? spot?.maxSteps ?? null;
  const balanceValue = displayCurrency === 'petagold' ? balance.petagold : balance.peta;
  const canAfford = balanceValue >= displayEntryFee;
  const canEnter = Boolean(resolvedMap?.id) && canAfford;
  const previewImage =
    resolvedMap?.thumb || spot?.thumb || region?.imageSrc || '/images/icons/background.png';

  const handleConfirm = () => {
    if (!resolvedMap?.id) return;
    navigate(`/hunting-world/map/${encodeURIComponent(resolvedMap.id)}`);
  };

  return (
    <div className="hunt-confirm-page">
      <div className="hunt-confirm-card">
        <h2 className="hunt-confirm-title">Xác nhận vào săn</h2>

        <div className="hunt-confirm-preview">
          <img src={previewImage} alt={displayName} />
          <div className="hunt-confirm-preview-name">{displayName}</div>
        </div>

        <div className="hunt-confirm-meta">
          <p>
            Số bước tối đa:{' '}
            <strong>{displayMaxSteps == null || displayMaxSteps === 0 ? 'Không giới hạn' : displayMaxSteps}</strong>
          </p>
          <p>
            Phí vào săn: <strong>{displayEntryFee}</strong> {displayCurrency}
          </p>
          <p>
            Số dư hiện tại:{' '}
            <strong>{balanceLoading ? '...' : balanceValue}</strong> {displayCurrency}
          </p>
        </div>

        {!catalogLoading && !resolvedMap && (
          <p className="hunt-confirm-warning">Chưa cấu hình map săn cho địa điểm này.</p>
        )}
        {!balanceLoading && resolvedMap && !canAfford && (
          <p className="hunt-confirm-error">Bạn không đủ tiền để vào săn.</p>
        )}

        <div className="hunt-confirm-actions">
          <button
            type="button"
            className="hunt-confirm-btn hunt-confirm-btn--primary"
            disabled={!canEnter}
            onClick={handleConfirm}
          >
            Xác nhận vào săn
          </button>
          <button
            type="button"
            className="hunt-confirm-btn"
            onClick={() => navigate(-1)}
          >
            Quay lại
          </button>
          <button
            type="button"
            className="hunt-confirm-btn"
            onClick={() => navigate('/hunting-world')}
          >
            Về thế giới săn
          </button>
        </div>
      </div>
    </div>
  );
}

export default HuntConfirmPage;
