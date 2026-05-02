const express = require('express');
const {
  listAuctionLogFiles,
  readAuctionLogDay,
  pruneAuctionAdminLogs,
} = require('../services/auctionAdminLog');

/** @param {Function} checkAdminRole Express middleware (admin JWT) */
function createAuctionLogAdminRouter(checkAdminRole) {
  const router = express.Router();
  router.use(checkAdminRole);

  router.get('/files', async (req, res) => {
    try {
      await pruneAuctionAdminLogs();
      const files = await listAuctionLogFiles();
      res.json({ files });
    } catch (e) {
      console.error('GET /api/admin/auction-logs/files', e);
      res.status(500).json({ error: 'Không đọc được danh sách log' });
    }
  });

  router.get('/day/:date', async (req, res) => {
    try {
      const content = await readAuctionLogDay(req.params.date);
      res.json({ date: req.params.date, content });
    } catch (e) {
      console.error('GET /api/admin/auction-logs/day', e);
      res.status(500).json({ error: 'Không đọc được nội dung log' });
    }
  });

  return router;
}

module.exports = createAuctionLogAdminRouter;
