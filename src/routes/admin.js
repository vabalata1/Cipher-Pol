const express = require('express');
const { migrateFromPostgresToSqlite } = require('../utils/migrateToSqlite');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Accès refusé' });
  return next();
}

// Trigger migration via HTTP (POST or GET).
router.post('/migrate-to-sqlite', requireAdmin, async (req, res) => {
  try {
    const wipe = String(req.query.wipe || req.body?.wipe || '1') !== '0';
    const result = await migrateFromPostgresToSqlite({ wipe, root: '/var/data' });
    return res.json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/migrate-to-sqlite', requireAdmin, async (req, res) => {
  try {
    const wipe = String(req.query.wipe || '1') !== '0';
    const result = await migrateFromPostgresToSqlite({ wipe, root: '/var/data' });
    const html = `<!doctype html><meta charset="utf-8" /><title>Migration OK</title><pre>${
      JSON.stringify({ ok: true, ...result }, null, 2)
    }</pre>`;
    return res.type('text/html').send(html);
  } catch (e) {
    const html = `<!doctype html><meta charset="utf-8" /><title>Migration FAILED</title><pre>${
      e.message
    }</pre>`;
    return res.status(500).type('text/html').send(html);
  }
});

module.exports = router;

