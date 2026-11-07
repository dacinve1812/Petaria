import { useEffect, useState } from 'react';

export default function useMapImageReady(src) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!src) return undefined;
    let cancelled = false;
    const img = new Image();
    const done = () => {
      if (!cancelled) setReady(true);
    };
    img.onload = done;
    img.onerror = done;
    img.src = src;
    if (img.complete) done();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return ready;
}
