const express = require('express');
const trainingCamp = require('../services/trainingCamp');

function createTrainingCampRouter({ db, getRedis, matchPrefix }) {
  const router = express.Router();

  async function battleIds(userId) {
    return trainingCamp.loadBattlePetIds(getRedis, matchPrefix, userId);
  }

  function fail(res, err) {
    const status = err && err.status ? err.status : 500;
    if (status >= 500) console.error('training camp:', err);
    res.status(status).json({
      message: status >= 500 ? 'Không thể xử lý Trại huấn luyện.' : (err.message || 'Yêu cầu không hợp lệ.'),
    });
  }

  router.get('/', async (req, res) => {
    try {
      const state = await trainingCamp.getCampState(db, req.classicUserId, await battleIds(req.classicUserId));
      res.json(state);
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/slots/:index/unlock', async (req, res) => {
    try {
      const result = await trainingCamp.unlockSlot(db, req.classicUserId, req.params.index);
      res.json(result);
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/sessions', async (req, res) => {
    try {
      const result = await trainingCamp.startSession(
        db,
        req.classicUserId,
        req.body || {},
        await battleIds(req.classicUserId)
      );
      res.json(result);
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/sessions/:id/claim', async (req, res) => {
    try {
      const result = await trainingCamp.claimSession(db, req.classicUserId, req.params.id);
      res.json(result);
    } catch (err) {
      fail(res, err);
    }
  });

  return router;
}

module.exports = { createTrainingCampRouter };
