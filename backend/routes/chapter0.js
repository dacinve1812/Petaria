const express = require('express');
const story = require('../services/chapter0Story');

function createChapter0Router({ db }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const state = await story.loadState(db, req.classicUserId);
      if (!state) return res.status(404).json({ message: 'Không tìm thấy người chơi.' });
      const pathname = String(req.query.path || '/');
      res.json(story.publicView(state, pathname));
    } catch (err) {
      console.error('chapter0 get:', err);
      res.status(500).json({ message: 'Không tải được Chương 0.' });
    }
  });

  router.post('/event', async (req, res) => {
    try {
      const state = await story.applyEvent(db, req.classicUserId, req.body || {});
      const pathname = String(req.body?.path || '/');
      res.json(story.publicView(state, pathname));
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('chapter0 event:', err);
      res.status(status).json({ message: err.message || 'Không lưu được tiến độ Chương 0.' });
    }
  });

  return router;
}

module.exports = { createChapter0Router };
