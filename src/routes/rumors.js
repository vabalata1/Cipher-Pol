const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const { getDatabase } = require('../config/database');

router.get('/', async (req, res) => {
  const db = await getDatabase();
  const rumors = await db.all('SELECT * FROM rumors ORDER BY id DESC');
  res.render('rumors/index', { title: 'Tableau des échos', rumors });
});

router.get('/new', (req, res) => {
  res.render('rumors/new', { title: 'Nouvelle info/rumeur' });
});

router.post('/', async (req, res) => {
  const { codeTag, content, credibility } = req.body;
  if (!codeTag || !content || !credibility) return res.redirect('/rumors');
  const db = await getDatabase();
  const stmt = await db.prepare('INSERT INTO rumors (codeTag, content, credibility, createdAt, code) VALUES (?, ?, ?, ?, ?)');
  await stmt.run(codeTag.trim(), content.trim(), credibility, dayjs().toISOString(), req.user.code);
  await stmt.finalize();
  res.redirect('/rumors');
});

// Delete rumor (admin only)
router.post('/delete/:id', async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).send('Accès refusé');
  const db = await getDatabase();
  await db.run('DELETE FROM rumors WHERE id = ?', req.params.id);
  res.redirect('/rumors');
});

module.exports = router;


