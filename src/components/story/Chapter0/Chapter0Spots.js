import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChapter0 } from './Chapter0Context';
import '../ui/storySpotlight.css';

export function storyButtonClass(active) {
  return active ? ' regionmap-button--story' : '';
}

export function Chapter0CapitalSpots({ naturalWidth, naturalHeight, isMobile }) {
  const { story, postEvent } = useChapter0();
  const location = useLocation();
  const navigate = useNavigate();
  const capital = story?.guidance?.capital;
  const spot = capital ? story?.spotlights?.[capital] : null;
  const box = spot ? (isMobile ? spot.mobile : spot.desktop) : null;
  const spotRef = useRef(null);
  const boxKey = Array.isArray(box) ? box.join(',') : '';
  useEffect(() => {
    if (!isMobile || !spotRef.current) return undefined;
    spotRef.current.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    return undefined;
  }, [isMobile, capital, boxKey]);
  if (!box || !naturalWidth || !naturalHeight) return null;
  const [x1, y1, x2, y2] = box;
  const style = {
    left: `${(Math.min(x1, x2) / naturalWidth) * 100}%`,
    top: `${(Math.min(y1, y2) / naturalHeight) * 100}%`,
    width: `${(Math.abs(x2 - x1) / naturalWidth) * 100}%`,
    height: `${(Math.abs(y2 - y1) / naturalHeight) * 100}%`,
  };
  const go = () => {
    if (capital === 'CAPITAL_PORT') {
      postEvent({ type: 'PORT_ARM', path: location.pathname });
      return;
    }
    if (spot?.route) navigate(spot.route);
  };
  if (isMobile || capital === 'CAPITAL_PORT') {
    return (
      <button
        type="button"
        ref={spotRef}
        className="ch0-spot ch0-spot--port"
        style={style}
        data-story-target={
          isMobile && String(story?.guidance?.lock || '').startsWith('capital-')
            ? story.guidance.lock
            : undefined
        }
        aria-label={capital || 'Điểm trên bản đồ'}
        onClick={go}
      />
    );
  }
  return <div className="ch0-spot" style={style} aria-hidden />;
}
