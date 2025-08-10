const express = require('express');
const { getDatabase } = require('../config/database');

const router = express.Router();

function parseNum(code) {
  const m = /^MR\.(\d+)$/.exec(code || '');
  return m ? parseInt(m[1], 10) : null;
}

function computeAllowed(meCode, users) {
  const meNum = parseNum(meCode);
  const codeSet = new Set(users.map(u => u.code));
  const allowedCodes = new Set();
  if (meCode === 'MR.0' || meCode === 'MR.1') {
    users.forEach(u => { if (u.code !== meCode) allowedCodes.add(u.code); });
  } else if (meNum !== null) {
    const prev = `MR.${meNum - 1}`;
    const next = `MR.${meNum + 1}`;
    if (codeSet.has(prev)) allowedCodes.add(prev);
    if (codeSet.has(next)) allowedCodes.add(next);
    if (codeSet.has('MR.1')) allowedCodes.add('MR.1');
  }
  return allowedCodes;
}

// Page UI
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const users = await db.all('SELECT id, code, role FROM users ORDER BY code ASC');
    const allowedCodes = computeAllowed(req.user.code, users);
    const allowedUsers = users.filter(u => allowedCodes.has(u.code));
    res.render('communications/index', { title: 'Communications', allowedUsers });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erreur serveur');
  }
});

// API: list messages with a peer
router.get('/messages', async (req, res) => {
  try {
    const peer = (req.query.peer || '').toString();
    const db = await getDatabase();
    const users = await db.all('SELECT code FROM users');
    const allowed = computeAllowed(req.user.code, users);
    if (!allowed.has(peer)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const me = req.user.code;
    const rows = await db.all(
      `SELECT id, fromCode, toCode, content, createdAt
       FROM direct_messages
       WHERE (fromCode = ? AND toCode = ?) OR (fromCode = ? AND toCode = ?)
       ORDER BY datetime(createdAt) ASC`,
      me, peer, peer, me
    );
    res.json({ messages: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// API: send message to a peer
router.post('/messages', async (req, res) => {
  try {
    const { toCode, content } = req.body || {};
    const text = (content || '').toString().trim();
    if (!toCode || !text) return res.status(400).json({ error: 'Invalid payload' });

    const db = await getDatabase();
    const users = await db.all('SELECT code FROM users');
    const allowed = computeAllowed(req.user.code, users);
    if (!allowed.has(toCode)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const createdAt = new Date().toISOString();
    await db.run(
      'INSERT INTO direct_messages (fromCode, toCode, content, createdAt) VALUES (?, ?, ?, ?)',
      [req.user.code, toCode, text, createdAt]
    );
    return res.json({ ok: true, message: { fromCode: req.user.code, toCode, content: text, createdAt } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin-only: clear all direct messages
router.post('/clear', async (req, res) => {
  try {
    if (!(req.user && (req.user.code === 'MR.0' || req.user.code === 'MR.1'))) {
      return res.status(403).send('Accès refusé');
    }
    const db = await getDatabase();
    await db.run('DELETE FROM direct_messages');
    return res.redirect('/communications');
  } catch (e) {
    console.error(e);
    return res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
