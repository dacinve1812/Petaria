import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ENTERTAINMENT_GAMES } from './entertainmentGamesConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const Ctx = createContext({
  config: null,
  loading: true,
  error: null,
  reload: async () => {},
  hubGames: ENTERTAINMENT_GAMES,
});

export function GameCenterConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/game-center/config`);
      if (!res.ok) throw new Error('Không tải được cấu hình');
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      setError(e);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hubGames = useMemo(() => {
    if (config?.hubGames?.length) return config.hubGames;
    return ENTERTAINMENT_GAMES;
  }, [config]);

  const value = useMemo(
    () => ({
      config,
      loading,
      error,
      reload: load,
      hubGames,
    }),
    [config, loading, error, load, hubGames],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGameCenterConfig() {
  return useContext(Ctx);
}
