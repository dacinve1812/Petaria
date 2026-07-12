import { useMemo } from 'react';
import { useGameCenterConfig } from './GameCenterConfigContext';

/**
 * Background của trang game-center (ec-page-surface), không phải nền NarrativeScene.
 * Lấy từ hubGames[].pageBackgroundSrc (Admin → Game center → Hub).
 */
export function useGamePageBackground(gameIdOrPath) {
  const { hubGames } = useGameCenterConfig();
  const key = String(gameIdOrPath || '').trim();

  const src = useMemo(() => {
    if (!key) return '';
    const g = (hubGames || []).find(
      (x) => String(x.id) === key || String(x.path) === key,
    );
    return String(g?.pageBackgroundSrc || '').trim();
  }, [hubGames, key]);

  return useMemo(() => {
    if (!src) {
      return { src: '', className: '', style: undefined };
    }
    return {
      src,
      className: 'ec-page-surface--has-bg',
      style: {
        backgroundImage: `url(${src})`,
      },
    };
  }, [src]);
}

/** Map pathname /game-center/beggar-king → hub path segment */
export function gameCenterPathSegment(pathname) {
  const p = String(pathname || '').replace(/\/$/, '');
  if (!p.startsWith('/game-center')) return '';
  const rest = p.slice('/game-center'.length).replace(/^\//, '');
  return rest.split('/')[0] || '';
}

export default useGamePageBackground;
