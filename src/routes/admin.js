const express = require('express');
const { migrateFromPostgresToSqlite } = require('../utils/migrateToSqlite');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Accès refusé' });
  return next();
}

// Trigger migration via HTTP. Use JSON POST to bypass CSRF per global config.
router.post('/migrate-to-sqlite', requireAdmin, async (req, res) => {
  try {
    const result = await migrateFromPostgresToSqlite();
    return res.json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;

