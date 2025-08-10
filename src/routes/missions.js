const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const { getDatabase } = require('../config/database');

// List missions
router.get('/', async (req, res) => {
  const db = await getDatabase();
  const missions = await db.all('SELECT * FROM missions ORDER BY id DESC');
  res.render('missions/index', { title: 'Mandats codés', missions });
});

// Create mission (MR.0 only -> isAdmin)
router.get('/new', (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).send('Accès refusé');
  res.render('missions/new', { title: 'Nouvelle mission' });
});

router.post('/', async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).send('Accès refusé');
  const { title, content } = req.body;
  if (!title || !content) return res.redirect('/missions');
  const db = await getDatabase();
  const stmt = await db.prepare('INSERT INTO missions (title, content, createdBy, createdAt) VALUES (?, ?, ?, ?)');
  await stmt.run(title.trim(), content.trim(), req.user.id, dayjs().toISOString());
  await stmt.finalize();
  res.redirect('/missions');
});

// Show mission + responses
router.get('/:id', async (req, res) => {
  const db = await getDatabase();
  const mission = await db.get('SELECT * FROM missions WHERE id = ?', req.params.id);
  if (!mission) return res.status(404).send('Introuvable');
  const responses = await db.all('SELECT * FROM mission_responses WHERE missionId = ? ORDER BY id DESC', req.params.id);
  res.render('missions/show', { title: mission.title, mission, responses });
});

// Respond to mission
router.post('/:id/respond', async (req, res) => {
  const db = await getDatabase();
  const { content } = req.body;
  if (!content) return res.redirect(`/missions/${req.params.id}`);
  const stmt = await db.prepare('INSERT INTO mission_responses (missionId, code, content, createdAt) VALUES (?, ?, ?, ?)');
  await stmt.run(req.params.id, req.user.code, content.trim(), dayjs().toISOString());
  await stmt.finalize();
  res.redirect(`/missions/${req.params.id}`);
});

// Delete mission (admin only)
router.post('/:id/delete', async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).send('Accès refusé');
  const db = await getDatabase();
  await db.run('DELETE FROM missions WHERE id = ?', req.params.id);
  res.redirect('/missions');
});

module.exports = router;


