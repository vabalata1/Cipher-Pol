const express = require('express');
const { getDatabase } = require('../config/database');
const router = express.Router();

// GET /cipher - Always require key; unlock is one-time for this user
router.get('/', async (req, res) => {
  const unlockedFor = req.session && req.session.cipherUnlockedFor;
  const oneTime = req.session && req.session.cipherUnlockOnce;
  const ok = oneTime && unlockedFor === req.user.id;
  if (!ok) {
    return res.render('cipher/lock', { title: 'Chiffrement' });
  }
  // consume one-time unlock
  delete req.session.cipherUnlockOnce;
  delete req.session.cipherUnlockedFor;

  // Load saved mapping if any
  let saved = null;
  try {
    const db = await getDatabase();
    const row = await db.get('SELECT value FROM app_settings WHERE key = ?', 'cipher_map');
    if (row && row.value) {
      try { saved = JSON.parse(row.value); } catch { saved = null; }
    }
  } catch {}
  return res.render('cipher/index', { title: 'Chiffrement', currentUser: req.user, savedCipherMap: saved });
});

// POST /cipher/unlock - Verify key (firstName)
router.post('/unlock', async (req, res) => {
  try {
    const db = await getDatabase();
    const me = await db.get('SELECT firstName FROM users WHERE id = ?', req.user.id);
    const stored = (me && me.firstName ? String(me.firstName) : '').trim().toLowerCase();
    const provided = (req.body && req.body.key ? String(req.body.key) : '').trim().toLowerCase();

    if (!stored) {
      return res.status(400).render('cipher/lock', { title: 'Chiffrement' });
    }
    if (!provided) {
      return res.status(400).render('cipher/lock', { title: 'Chiffrement', error: 'Veuillez entrer votre clé.' });
    }
    if (stored !== provided) {
      return res.status(401).render('cipher/lock', { title: 'Chiffrement', error: 'Prénom incorrecte' });
    }

    req.session.cipherUnlockOnce = true;
    req.session.cipherUnlockedFor = req.user.id;
    return res.redirect('/cipher');
  } catch (e) {
    console.error(e);
    return res.status(500).render('cipher/lock', { title: 'Chiffrement', error: 'Erreur serveur' });
  }
});

// POST /cipher/shuffle - Save new mapping (MR.0/MR.1 only)
router.post('/shuffle', async (req, res) => {
  try {
    const user = req.user;
    if (!(user && (user.code === 'MR.0' || user.code === 'MR.1'))) {
      return res.status(403).send('Accès refusé');
    }
    const body = req.body || {};
    const mapping = body.mapping && typeof body.mapping === 'string' ? body.mapping : '';
    if (!mapping) return res.status(400).send('Mapping manquant');
    const db = await getDatabase();
    // Upsert
    await db.run('DELETE FROM app_settings WHERE key = ?', 'cipher_map');
    await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['cipher_map', mapping]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
