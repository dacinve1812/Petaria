const express = require('express');
const db = require('../config/database');
const {
  getTemplateCatalog,
  upsertTemplates,
  normalizeLocale,
} = require('../services/auctionMailTemplateService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const locale = normalizeLocale(req.query.locale);
    const data = await getTemplateCatalog(db, locale);
    res.json(data);
  } catch (e) {
    console.error('GET /api/admin/site/auction-mail-templates', e);
    res.status(500).json({ error: 'Không tải được template' });
  }
});

router.put('/', async (req, res) => {
  try {
    const { locale, templates } = req.body || {};
    const loc = normalizeLocale(locale);
    await upsertTemplates(db, loc, templates);
    res.json({ success: true, locale: loc });
  } catch (e) {
    console.error('PUT /api/admin/site/auction-mail-templates', e);
    res.status(500).json({ error: 'Không lưu được template', details: e.message });
  }
});

module.exports = router;
