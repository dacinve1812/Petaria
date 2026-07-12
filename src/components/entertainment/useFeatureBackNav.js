import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Nút back cho trang feature trong game-center (từ region / hub / history).
 * RegionMapPage truyền state: { from: 'region', regionId, regionName }
 * Hub truyền: { from: 'game-center' }
 */
export function useFeatureBackNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state && typeof location.state === 'object' ? location.state : null;

  return useMemo(() => {
    const regionId = state?.regionId ? String(state.regionId) : '';
    const regionName = state?.regionName ? String(state.regionName).trim() : '';
    if (state?.from === 'region' && regionId) {
      return {
        kind: 'link',
        to: `/region/${encodeURIComponent(regionId)}`,
        label: regionName ? `Trở lại ${regionName}` : 'Trở lại vùng trước',
      };
    }
    if (state?.from === 'game-center') {
      return {
        kind: 'link',
        to: '/game-center',
        label: 'Trở lại Trung tâm giải trí',
      };
    }
    return {
      kind: 'history',
      label: 'Trở lại sau',
      go: () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          navigate(-1);
          return;
        }
        navigate('/game-center');
      },
    };
  }, [state, navigate]);
}

export default useFeatureBackNav;
