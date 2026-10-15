import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import './PageWipe.css';

function watchImages(root, signal) {
  return new Promise((resolve) => {
    const pending = new Set();
    let settleTimer = 0;
    let observer;

    const finish = () => {
      window.clearTimeout(settleTimer);
      observer?.disconnect();
      resolve();
    };

    const check = () => {
      window.clearTimeout(settleTimer);
      if (pending.size > 0) return;
      settleTimer = window.setTimeout(finish, 140);
    };

    const watch = (img) => {
      if (!(img instanceof HTMLImageElement) || pending.has(img)) return;
      if (img.complete) return;
      pending.add(img);
      const done = () => {
        pending.delete(img);
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        check();
      };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    };

    const scan = () => {
      root.querySelectorAll('img').forEach(watch);
      check();
    };

    observer = new MutationObserver(scan);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
    scan();

    const cap = window.setTimeout(finish, 8000);
    signal.addEventListener('abort', () => {
      window.clearTimeout(cap);
      window.clearTimeout(settleTimer);
      observer.disconnect();
      resolve();
    });
  });
}

/**
 * Tấm xám phủ cả navbar khi đổi trang.
 * Giữ đen cho đến khi ảnh trong trang chính tải xong, rồi fade.
 */
export default function PageWipe() {
  const location = useLocation();
  const [wipe, setWipe] = useState(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const controller = new AbortController();
    let showTimer = 0;
    let leaveTimer = 0;
    setWipe({ phase: 'hold', showLoader: false, ms: reduce ? 160 : 420 });
    showTimer = window.setTimeout(() => {
      setWipe((current) => (current && current.phase === 'hold' ? { ...current, showLoader: true } : current));
    }, 380);

    const run = async () => {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      const root = document.getElementById('peta-body') || document.body;
      await watchImages(root, controller.signal);
      if (controller.signal.aborted) return;
      window.clearTimeout(showTimer);
      const ms = reduce ? 160 : 420;
      setWipe({ phase: 'leave', showLoader: false, ms });
      leaveTimer = window.setTimeout(() => setWipe(null), ms);
    };
    void run();

    return () => {
      controller.abort();
      window.clearTimeout(showTimer);
      window.clearTimeout(leaveTimer);
    };
  }, [location.pathname]);

  if (!wipe) return null;

  return createPortal(
    <div
      className={`page-wipe${wipe.phase === 'leave' ? ' is-leave' : ''}`}
      style={{ '--wipe-ms': `${wipe.ms}ms` }}
      aria-hidden
    >
      {wipe.showLoader ? (
        <div className="page-wipe__status">
          <span className="page-wipe__spin" />
          <span className="page-wipe__label">Loading</span>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
