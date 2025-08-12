const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const { getDatabase } = require('../config/database');

// List missions
router.get('/', async (req, res) => {
  const db = await getDatabase();
  const { status, difficulty, priority, zone, tag, sort } = req.query || {};
  const clauses = [];
  const params = [];
  if (status) { clauses.push('m.status = ?'); params.push(String(status)); }
  if (difficulty) { clauses.push('m.difficulty = ?'); params.push(String(difficulty)); }
  if (priority) { clauses.push('m.priority = ?'); params.push(String(priority)); }
  if (zone) { clauses.push('m.zone = ?'); params.push(String(zone)); }
  if (tag) { clauses.push('(m.tags LIKE ? OR m.tags LIKE ? OR m.tags = ?)'); params.push('%,'+tag+',%','%,'+tag, tag+',%'); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  let order = 'm.id DESC';
  if (sort === 'priority') order = "CASE m.priority WHEN 'alpha' THEN 1 WHEN 'haute' THEN 2 WHEN 'normale' THEN 3 ELSE 4 END, m.id DESC";
  if (sort === 'deadline') order = "m.deadlineAt IS NULL, m.deadlineAt ASC";
  const missions = await db.all(`
    SELECT m.id, m.title, m.status, m.createdAt, m.difficulty, m.priority, m.zone, m.tags, m.deadlineAt,
           substr(m.content, 1, 160) AS excerpt,
           COALESCE(r.cnt, 0) AS responsesCount
    FROM missions m
    LEFT JOIN (
      SELECT missionId, COUNT(*) as cnt
      FROM mission_responses
      GROUP BY missionId
    ) r ON r.missionId = m.id
    ${where}
    ORDER BY ${order}
  `, ...params);
  res.render('missions/index', { title: 'Mandats codés', missions });
});

// Create mission (MR.0 only -> isAdmin)
router.get('/new', (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).send('Accès refusé');
  res.render('missions/new', { title: 'Nouvelle mission' });
});

router.post('/', async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).send('Accès refusé');
  const { title, content, status, difficulty, priority, zone, tags, deadlineAt } = req.body;
  if (!title || !content) return res.redirect('/missions');
  const db = await getDatabase();
  const stmt = await db.prepare('INSERT INTO missions (title, content, status, difficulty, priority, zone, tags, deadlineAt, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  await stmt.run(title.trim(), content.trim(), (status||'active').toLowerCase(), difficulty||null, priority||null, zone||null, tags ? (','+tags.replace(/\s+/g, '')+',') : null, deadlineAt||null, req.user.id, dayjs().toISOString());
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

// Admins MR.0/MR.1 can update status
router.post('/:id/status', async (req, res) => {
  try {
    const user = req.user;
    if (!(user && (user.isAdmin || user.code === 'MR.0' || user.code === 'MR.1'))) {
      return res.status(403).send('Accès refusé');
    }
    const allowed = ['active', 'en_cours', 'verrouille', 'terminee', 'archivee'];
    const status = (req.body.status || '').toString().toLowerCase();
    if (!allowed.includes(status)) {
      return res.redirect(`/missions/${req.params.id}`);
    }
    const db = await getDatabase();
    await db.run('UPDATE missions SET status = ? WHERE id = ?', [status, req.params.id]);
    return res.redirect(`/missions/${req.params.id}`);
  } catch (e) {
    return res.redirect(`/missions/${req.params.id}`);
  }
});

// Delete mission (admin only)
router.post('/:id/delete', async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).send('Accès refusé');
  const db = await getDatabase();
  await db.run('DELETE FROM missions WHERE id = ?', req.params.id);
  res.redirect('/missions');
});

module.exports = router;


