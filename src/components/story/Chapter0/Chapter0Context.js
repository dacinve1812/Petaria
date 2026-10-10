import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Chapter0Context = createContext(null);
const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

async function storyRequest(path, options) {
  const token = localStorage.getItem('token');
  if (!token) return null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options && options.headers),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Không tải được Chương 0.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function Chapter0Provider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [tick, setTick] = useState(0);
  const [hiddenSceneId, setHiddenSceneId] = useState(null);
  const [orphanageTalkArmed, setOrphanageTalkArmed] = useState(false);
  const pathname = location.pathname;

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener('petaria-story-refresh', onRefresh);
    return () => window.removeEventListener('petaria-story-refresh', onRefresh);
  }, [refresh]);

  useEffect(() => {
    setHiddenSceneId(null);
  }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith('/orphanage')) setOrphanageTalkArmed(false);
  }, [pathname]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!localStorage.getItem('token')) {
        if (!cancel) setStory(null);
        return;
      }
      try {
        const params = new URLSearchParams(location.search);
        if (params.get('ch0') === '1') {
          await storyRequest('/api/story/chapter0/event', {
            method: 'POST',
            body: JSON.stringify({ type: 'ENROLL', path: pathname }),
          });
          params.delete('ch0');
          navigate({ pathname, search: params.toString() }, { replace: true });
          return;
        }
        let data = await storyRequest(`/api/story/chapter0?path=${encodeURIComponent(pathname)}`);
        if (data?.enrolled && /^\/pet\/[^/]+$/.test(pathname) && !data.flags?.PET_PROFILE_VIEWED && data.flags?.STARTER_ADOPTED) {
          data = await storyRequest('/api/story/chapter0/event', {
            method: 'POST',
            body: JSON.stringify({ type: 'PET_PROFILE_VIEWED', path: pathname }),
          });
        }
        if (
          data?.enrolled
          && pathname.startsWith('/region/3-1')
          && data.flags?.LETTER_QUEST_ACCEPTED
          && !data.flags?.FLOWER_REGION_ENTERED
        ) {
          data = await storyRequest('/api/story/chapter0/event', {
            method: 'POST',
            body: JSON.stringify({ type: 'FLOWER_REGION_ENTERED', regionId: '3-1', path: pathname }),
          });
        }
        if (data?.enrolled && pathname.startsWith('/myhome') && data.flags?.STARTER_ADOPTED && !data.flags?.HOME_RETURNED) {
          data = await storyRequest('/api/story/chapter0/event', {
            method: 'POST',
            body: JSON.stringify({ type: 'HOME_RETURNED', path: pathname }),
          });
        }
        if (data?.enrolled && (pathname === '/home-ver2' || pathname === '/') && data.guidance?.lock === 'logo') {
          data = await storyRequest('/api/story/chapter0/event', {
            method: 'POST',
            body: JSON.stringify({ type: 'LOGO_HOME', path: pathname }),
          });
        }
        if (data?.enrolled && pathname.startsWith('/inventory/equipment') && data.flags?.STARTER_SUPPLIES_CLAIMED && !data.flags?.EQUIP_TAB_OPENED) {
          data = await storyRequest('/api/story/chapter0/event', {
            method: 'POST',
            body: JSON.stringify({ type: 'EQUIP_TAB_OPENED', path: pathname }),
          });
        }
        if (!cancel) setStory(data);
      } catch (err) {
        if (!cancel) setStory(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [pathname, location.search, tick, navigate]);

  const postEvent = useCallback(async (body) => {
    const data = await storyRequest('/api/story/chapter0/event', {
      method: 'POST',
      body: JSON.stringify({ ...body, path: pathname }),
    });
    setStory(data);
    return data;
  }, [pathname]);

  const armOrphanageTalk = useCallback(() => {
    setOrphanageTalkArmed(true);
  }, []);

  const snoozeScene = useCallback((sceneId) => {
    setHiddenSceneId(sceneId);
  }, []);

  const rawScene = story?.scene && story.scene.id !== hiddenSceneId ? story.scene : null;
  const scene = rawScene?.id === 'CH0_ELINA_INTRO' && !orphanageTalkArmed ? null : rawScene;

  const value = useMemo(
    () => ({ story, scene, postEvent, refresh, snoozeScene, armOrphanageTalk, orphanageTalkArmed }),
    [story, scene, postEvent, refresh, snoozeScene, armOrphanageTalk, orphanageTalkArmed]
  );

  return <Chapter0Context.Provider value={value}>{children}</Chapter0Context.Provider>;
}

export function useChapter0() {
  const context = useContext(Chapter0Context);
  if (!context) {
    throw new Error('useChapter0 must be used within Chapter0Provider');
  }
  return context;
}

export function useChapter0Optional() {
  return useContext(Chapter0Context);
}

export function dispatchStoryRefresh() {
  window.dispatchEvent(new Event('petaria-story-refresh'));
}
