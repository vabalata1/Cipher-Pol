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
  return res.render('cipher/index', { title: 'Chiffrement', currentUser: req.user });
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

module.exports = router;
