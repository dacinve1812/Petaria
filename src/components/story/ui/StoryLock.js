import { useEffect } from 'react';
import { useChapter0 } from '../Chapter0/Chapter0Context';

/**
 * Khóa màn hình quanh đúng nút cần bấm.
 * Khi hộp thoại đang mở thì chỉ tô sáng, không chặn chữ.
 */
export default function StoryLock() {
  const { story, scene } = useChapter0();
  const lock = scene ? null : (story?.guidance?.lock || null);
  const markKey = (story?.guidance?.marks || []).join('|');

  useEffect(() => {
    const marked = new Set();
    const paint = () => {
      marked.forEach((node) => node.classList.remove('story-hot'));
      marked.clear();
      const marks = markKey ? markKey.split('|') : [];
      if (!lock) {
        marks.forEach((id) => {
          document.querySelectorAll(`[data-story-target="${id}"]`).forEach((node) => marked.add(node));
        });
      } else if (lock === 'nav-features') {
        const node = document.querySelector('[data-story-target="nav-sub"]')
          || document.querySelector('[data-story-target="nav-features"]');
        if (node) marked.add(node);
      } else {
        const node = document.querySelector(`[data-story-target="${lock}"]`);
        if (node) marked.add(node);
      }
      const cover = document.querySelector('.inventory-item-modal-overlay, .game-dialog-overlay');
      if (cover) {
        document.body.classList.remove('story-lock');
        return;
      }
      if (lock && marked.size > 0) document.body.classList.add('story-lock');
      else document.body.classList.remove('story-lock');
      marked.forEach((node) => node.classList.add('story-hot'));
    };

    if (!lock && !markKey) {
      document.body.classList.remove('story-lock');
      return undefined;
    }
    paint();
    const timer = window.setInterval(paint, 50);
    return () => {
      window.clearInterval(timer);
      document.body.classList.remove('story-lock');
      marked.forEach((node) => node.classList.remove('story-hot'));
    };
  }, [lock, markKey]);

  return null;
}
