const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const { getDatabase } = require('../config/database');
const PDFDocument = require('pdfkit');

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
  res.render('missions/index', { title: 'Mandats codés', missions, filters: { status, difficulty, priority, zone, tag, sort } });
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

// Show mission + extended details
router.get('/:id', async (req, res) => {
  const db = await getDatabase();
  const mission = await db.get('SELECT * FROM missions WHERE id = ?', req.params.id);
  if (!mission) return res.status(404).send('Introuvable');
  const responses = await db.all('SELECT * FROM mission_responses WHERE missionId = ? ORDER BY id DESC', req.params.id);
  const milestones = await db.all("SELECT * FROM mission_milestones WHERE missionId = ? ORDER BY (doneAt IS NULL) DESC, COALESCE(dueAt, '9999-12-31T23:59:59Z') ASC, id ASC", req.params.id);
  const assignments = await db.all('SELECT code FROM mission_assignments WHERE missionId = ? ORDER BY id ASC', req.params.id);
  const binomes = await db.all('SELECT codeA, codeB FROM mission_binomes WHERE missionId = ? ORDER BY id ASC', req.params.id);
  const deps = await db.all('SELECT d.dependsOnId as id, m.title FROM mission_dependencies d JOIN missions m ON m.id = d.dependsOnId WHERE d.missionId = ?', req.params.id);
  const subs = await db.all('SELECT d.missionId as id, m.title FROM mission_dependencies d JOIN missions m ON m.id = d.missionId WHERE d.dependsOnId = ?', req.params.id);
  const votes = await db.all('SELECT code, value FROM mission_priority_votes WHERE missionId = ?', req.params.id);
  const precedence = { alpha: 1, haute: 2, normale: 3, basse: 4 };
  let votedPriority = null;
  for (const v of votes) { const val = String(v.value||'').toLowerCase(); if (!votedPriority || precedence[val] < precedence[votedPriority]) votedPriority = val; }
  res.render('missions/show', { title: mission.title, mission, responses, milestones, assignments, binomes, deps, subs, votes, votedPriority });
});

// Add milestone
router.post('/:id/milestones', async (req, res) => {
  try {
    const user = req.user; if (!(user && (user.isAdmin || user.code==='MR.0' || user.code==='MR.1'))) return res.status(403).send('Accès refusé');
    const { title, dueAt } = req.body || {}; if (!title) return res.redirect('back');
    const db = await getDatabase();
    const st = await db.prepare('INSERT INTO mission_milestones (missionId, title, dueAt) VALUES (?, ?, ?)');
    await st.run(req.params.id, title.trim(), dueAt || null); await st.finalize();
    return res.redirect(`/missions/${req.params.id}`);
  } catch { return res.redirect('back'); }
});
// Complete milestone
router.post('/:id/milestones/:mid/done', async (req, res) => {
  try {
    const user = req.user; if (!(user && (user.isAdmin || user.code==='MR.0' || user.code==='MR.1'))) return res.status(403).send('Accès refusé');
    const db = await getDatabase(); await db.run('UPDATE mission_milestones SET doneAt = ? WHERE id = ? AND missionId = ?', [dayjs().toISOString(), req.params.mid, req.params.id]);
    return res.redirect(`/missions/${req.params.id}`);
  } catch { return res.redirect('back'); }
});

// Add assignment
router.post('/:id/assign', async (req, res) => {
  try {
    const user = req.user; if (!(user && (user.isAdmin || user.code==='MR.0' || user.code==='MR.1'))) return res.status(403).send('Accès refusé');
    const { code } = req.body || {}; if (!code) return res.redirect('back');
    const db = await getDatabase();
    const st = await db.prepare('INSERT INTO mission_assignments (missionId, code) VALUES (?, ?)');
    await st.run(req.params.id, code.trim()); await st.finalize();
    return res.redirect(`/missions/${req.params.id}`);
  } catch { return res.redirect('back'); }
});

// Add binome pair
router.post('/:id/binomes', async (req, res) => {
  try {
    const user = req.user; if (!(user && (user.isAdmin || user.code==='MR.0' || user.code==='MR.1'))) return res.status(403).send('Accès refusé');
    const { codeA, codeB } = req.body || {}; if (!codeA || !codeB) return res.redirect('back');
    const db = await getDatabase();
    const st = await db.prepare('INSERT INTO mission_binomes (missionId, codeA, codeB) VALUES (?, ?, ?)');
    await st.run(req.params.id, codeA.trim(), codeB.trim()); await st.finalize();
    return res.redirect(`/missions/${req.params.id}`);
  } catch { return res.redirect('back'); }
});

// Add dependency (prerequisite mission)
router.post('/:id/dependencies', async (req, res) => {
  try {
    const user = req.user; if (!(user && (user.isAdmin || user.code==='MR.0' || user.code==='MR.1'))) return res.status(403).send('Accès refusé');
    const { dependsOnId } = req.body || {}; if (!dependsOnId) return res.redirect('back');
    const db = await getDatabase();
    const st = await db.prepare('INSERT INTO mission_dependencies (missionId, dependsOnId) VALUES (?, ?)');
    await st.run(req.params.id, Number(dependsOnId)); await st.finalize();
    return res.redirect(`/missions/${req.params.id}`);
  } catch { return res.redirect('back'); }
});

// Quick create sub-mission under this mission
router.post('/:id/submissions', async (req, res) => {
  try {
    const user = req.user; if (!(user && (user.isAdmin || user.code==='MR.0' || user.code==='MR.1'))) return res.status(403).send('Accès refusé');
    const { title, content } = req.body || {}; if (!title) return res.redirect('back');
    const db = await getDatabase();
    const st = await db.prepare('INSERT INTO missions (title, content, status, createdBy, createdAt) VALUES (?, ?, ?, ?, ?)');
    const now = dayjs().toISOString();
    await st.run(title.trim(), (content||`Sous-mission de ${req.params.id}`).trim(), 'active', user.id, now); await st.finalize();
    const child = await db.get('SELECT last_insert_rowid() as id');
    const dep = await db.prepare('INSERT INTO mission_dependencies (missionId, dependsOnId) VALUES (?, ?)');
    await dep.run(child.id || child.lastID || child.rowid, Number(req.params.id)); await dep.finalize();
    return res.redirect(`/missions/${req.params.id}`);
  } catch { return res.redirect('back'); }
});

// Priority vote (MR.0 / MR.1)
router.post('/:id/vote', async (req, res) => {
  try {
    const user = req.user; if (!(user && (user.code==='MR.0' || user.code==='MR.1'))) return res.status(403).send('Accès refusé');
    const { value } = req.body || {}; const allowed = ['alpha','haute','normale','basse'];
    const v = String(value||'').toLowerCase(); if (!allowed.includes(v)) return res.redirect('back');
    const db = await getDatabase();
    // Upsert simplistic: delete previous vote from this code, insert new
    await db.run('DELETE FROM mission_priority_votes WHERE missionId = ? AND code = ?', [req.params.id, user.code]);
    const st = await db.prepare('INSERT INTO mission_priority_votes (missionId, code, value, createdAt) VALUES (?, ?, ?, ?)');
    await st.run(req.params.id, user.code, v, dayjs().toISOString()); await st.finalize();
    return res.redirect(`/missions/${req.params.id}`);
  } catch { return res.redirect('back'); }
});

// PDF Report
router.get('/:id/report.pdf', async (req, res) => {
  try {
    const db = await getDatabase();
    const mission = await db.get('SELECT * FROM missions WHERE id = ?', req.params.id);
    if (!mission) return res.status(404).send('Introuvable');
    const milestones = await db.all('SELECT * FROM mission_milestones WHERE missionId = ? ORDER BY id ASC', req.params.id);
    const assignments = await db.all('SELECT code FROM mission_assignments WHERE missionId = ? ORDER BY id ASC', req.params.id);
    const deps = await db.all('SELECT m.title FROM mission_dependencies d JOIN missions m ON m.id = d.dependsOnId WHERE d.missionId = ?', req.params.id);
    const responses = await db.all('SELECT code, content, createdAt FROM mission_responses WHERE missionId = ? ORDER BY id ASC', req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="mission-${req.params.id}.pdf"`);
    const doc = new PDFDocument({ margin: 36 });
    doc.pipe(res);
    doc.fontSize(18).text(`Dossier Opération #${req.params.id}: ${mission.title}`, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Statut: ${mission.status} | Priorité: ${mission.priority||'-'} | Difficulté: ${mission.difficulty||'-'}`);
    if (mission.zone) doc.text(`Zone: ${mission.zone}`);
    if (mission.deadlineAt) doc.text(`Échéance: ${mission.deadlineAt}`);
    doc.moveDown();
    doc.fontSize(12).text('Brief:', { bold: true });
    doc.moveDown(0.2);
    doc.font('Courier').fontSize(11).text(mission.content || '(vide)');
    doc.font('Helvetica');
    doc.moveDown();
    if (deps.length) { doc.text('Dépendances:'); deps.forEach(d => doc.text(` - ${d.title}`)); doc.moveDown(); }
    if (assignments.length) { doc.text('Assignations:'); assignments.forEach(a => doc.text(` - ${a.code}`)); doc.moveDown(); }
    if (milestones.length) { doc.text('Jalons:'); milestones.forEach(m => doc.text(` - ${m.title} ${m.doneAt?'(fait)':''}`)); doc.moveDown(); }
    if (responses.length) { doc.text('Réponses:'); responses.forEach(r => doc.text(` - ${r.code}: ${r.content}`)); doc.moveDown(); }
    doc.end();
  } catch (e) { return res.status(500).send('Erreur génération PDF'); }
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


