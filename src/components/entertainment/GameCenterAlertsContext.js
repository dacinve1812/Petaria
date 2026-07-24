import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../../UserContext';
import {
  GAME_CENTER_ALERTS_REFRESH_EVENT,
  hasSeenMysteryBoxThisPeriod,
} from '../../utils/gameCenterAlertEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const GameCenterAlertsContext = createContext({
  loading: false,
  periodKey: null,
  featureAlerts: {},
  hasAnyAlert: false,
  showFeatureAlert: () => false,
  refresh: () => {},
});

function applyMysteryBoxVisit(alerts, userId, periodKey) {
  const next = { ...(alerts || {}) };
  if (next['mystery-box']) {
    next['mystery-box'] = !hasSeenMysteryBoxThisPeriod(userId, periodKey);
  }
  return next;
}

export function GameCenterAlertsProvider({ children }) {
  const { user } = useUser();
  const location = useLocation();
  const token = user?.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const userId = user?.userId ?? null;

  const [loading, setLoading] = useState(false);
  const [periodKey, setPeriodKey] = useState(null);
  const [featureAlerts, setFeatureAlerts] = useState({});

  const refresh = useCallback(async () => {
    if (!token) {
      setPeriodKey(null);
      setFeatureAlerts({});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/game-center/playable-alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setFeatureAlerts({});
        setPeriodKey(null);
        return;
      }
      const data = await res.json();
      const pk = data?.periodKey != null ? String(data.periodKey) : null;
      setPeriodKey(pk);
      const uid = userId ?? (() => {
        try {
          return JSON.parse(atob(token.split('.')[1])).userId;
        } catch {
          return null;
        }
      })();
      setFeatureAlerts(applyMysteryBoxVisit(data?.alerts || {}, uid, pk));
    } catch {
      setFeatureAlerts({});
      setPeriodKey(null);
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);

  useEffect(() => {
    const onRefresh = () => refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(GAME_CENTER_ALERTS_REFRESH_EVENT, onRefresh);
    document.addEventListener('visibilitychange', onVis);
    const id = window.setInterval(onRefresh, 60000);
    return () => {
      window.removeEventListener(GAME_CENTER_ALERTS_REFRESH_EVENT, onRefresh);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(id);
    };
  }, [refresh]);

  const showFeatureAlert = useCallback(
    (featureId) => !!featureAlerts[featureId],
    [featureAlerts],
  );

  const hasAnyAlert = useMemo(
    () => Object.values(featureAlerts).some(Boolean),
    [featureAlerts],
  );

  const value = useMemo(
    () => ({
      loading,
      periodKey,
      featureAlerts,
      hasAnyAlert,
      showFeatureAlert,
      refresh,
    }),
    [loading, periodKey, featureAlerts, hasAnyAlert, showFeatureAlert, refresh],
  );

  return (
    <GameCenterAlertsContext.Provider value={value}>{children}</GameCenterAlertsContext.Provider>
  );
}

export function useGameCenterAlerts() {
  return useContext(GameCenterAlertsContext);
}
