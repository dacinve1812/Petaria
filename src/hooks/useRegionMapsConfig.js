import { useCallback, useEffect, useState } from 'react';
import fallbackRegionMaps from '../config/region-maps.json';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * Load region-maps config từ API (admin có thể sửa path/huntingMapId).
 * Fallback JSON local nếu API lỗi.
 */
export function useRegionMapsConfig() {
  const [config, setConfig] = useState(fallbackRegionMaps);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/region-maps/config`);
      if (!r.ok) throw new Error('Không tải được region maps');
      const data = await r.json();
      if (data && Array.isArray(data.regions)) {
        setConfig(data);
      } else {
        setConfig(fallbackRegionMaps);
      }
    } catch (e) {
      setError(e);
      setConfig(fallbackRegionMaps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, loading, error, reload, regions: config?.regions || [] };
}

export default useRegionMapsConfig;
