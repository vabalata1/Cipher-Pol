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
    let mapping = body.mapping;
    if (!mapping) return res.status(400).send('Mapping manquant');
    const db = await getDatabase();
    // Upsert
    await db.run('DELETE FROM app_settings WHERE key = ?', 'cipher_map');
    const val = (typeof mapping === 'string') ? mapping : JSON.stringify(mapping);
    await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['cipher_map', val]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).send('Erreur serveur');
  }
});

// GET /cipher/map - return saved mapping JSON
router.get('/map', async (req, res) => {
  try {
    const db = await getDatabase();
    const row = await db.get('SELECT value FROM app_settings WHERE key = ?', 'cipher_map');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    if (!row || !row.value) return res.json(null);
    try { return res.json(JSON.parse(row.value)); } catch { return res.json(null); }
  } catch (e) {
    return res.status(500).json(null);
  }
});

// GET /cipher/key - show current mapping to MR.0/MR.1 only
router.get('/key', async (req, res) => {
  try {
    const user = req.user;
    if (!(user && (user.code === 'MR.0' || user.code === 'MR.1'))) {
      return res.status(403).send('Accès refusé');
    }
    const defaultMap = {
      'A': 'Ⱏ', 'B': 'Ⰸ', 'C': 'Ⱃ', 'D': 'Ⰻ', 'E': 'Ⱁ', 'F': 'Ⰽ', 'G': 'Ⱌ',
      'H': 'Ⰵ', 'I': 'Ⱒ', 'J': 'Ⱅ', 'K': 'Ⰱ', 'L': 'Ⰾ', 'M': 'Ⱇ', 'N': 'Ⱋ',
      'O': 'Ⰴ', 'P': 'Ⱈ', 'Q': 'Ⰿ', 'R': 'Ⱀ', 'S': 'Ⱄ', 'T': 'Ⰳ', 'U': 'Ⱆ',
      'V': 'Ⰲ', 'W': 'Ⱂ', 'X': 'Ⰰ', 'Y': 'Ⰹ', 'Z': 'Ⱌ'
    };
    // For the MR key page, always use the canonical mapping provided
    const mapping = defaultMap;
    return res.render('cipher/key', { title: 'Clé de chiffrement', mapping });
  } catch (e) {
    return res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
