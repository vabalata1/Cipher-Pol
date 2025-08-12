const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

const DISABLE_DB = process.env.DISABLE_DB === '1' || process.env.DISABLE_DB === 'true';

router.get('/', async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect('/login');
  if (DISABLE_DB) {
    return res.render('home', {
      title: 'Salle de Contrôle',
      missions: [],
      rumors: [],
      files: [],
    });
  }
  const db = await getDatabase();
  const missions = await db.all('SELECT id, title, status, createdAt, substr(content, 1, 140) as excerpt FROM missions ORDER BY id DESC LIMIT 5');
  const rumors = await db.all('SELECT id, codeTag, credibility, substr(content, 1, 80) as excerpt, createdAt FROM rumors ORDER BY id DESC LIMIT 5');
  const files = await db.all('SELECT id, originalName, codeTag, uploaderCode, createdAt, description FROM files ORDER BY id DESC LIMIT 6');

  res.render('home', {
    title: 'Salle de Contrôle',
    missions,
    rumors,
    files,
  });
});

module.exports = router;


