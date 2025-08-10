const express = require('express');
const multer = require('multer');
const path = require('path');
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/', async (req, res) => {
  const db = await getDatabase();
  const files = await db.all('SELECT * FROM files ORDER BY id DESC');
  res.render('files/index', { title: 'Archives secrètes', files });
});

router.post('/upload', upload.single('file'), async (req, res) => {
  const { codeTag, description } = req.body;
  if (!req.file || !codeTag) return res.redirect('/files');
  const db = await getDatabase();
  const stmt = await db.prepare('INSERT INTO files (filename, originalName, codeTag, uploaderCode, createdAt, description) VALUES (?, ?, ?, ?, ?, ?)');
  await stmt.run(
    req.file.filename,
    req.file.originalname,
    codeTag.trim(),
    req.user.code,
    dayjs().toISOString(),
    (description || '').trim()
  );
  await stmt.finalize();
  res.redirect('/files');
});

router.get('/download/:id', async (req, res) => {
  const db = await getDatabase();
  const file = await db.get('SELECT * FROM files WHERE id = ?', req.params.id);
  if (!file) return res.status(404).send('Introuvable');
  const full = path.join(UPLOAD_DIR, file.filename);
  res.download(full, file.originalName);
});

// Image raw preview (inline)
router.get('/raw/:id', async (req, res) => {
  const db = await getDatabase();
  const file = await db.get('SELECT * FROM files WHERE id = ?', req.params.id);
  if (!file) return res.status(404).send('Introuvable');
  const full = path.join(UPLOAD_DIR, file.filename);
  // Autoriser uniquement certains formats en preview
  const lower = (file.originalName || '').toLowerCase();
  const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => lower.endsWith(ext));
  if (!isImage) return res.status(415).send('Aperçu non supporté');
  res.sendFile(full);
});

  // Delete file (admin only)
router.post('/delete/:id', async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).send('Accès refusé');
  const db = await getDatabase();
  const file = await db.get('SELECT * FROM files WHERE id = ?', req.params.id);
  if (!file) return res.redirect('/files');
  await db.run('DELETE FROM files WHERE id = ?', req.params.id);
  try {
    const full = path.join(UPLOAD_DIR, file.filename);
    require('fs').unlinkSync(full);
  } catch (_) {}
  res.redirect('/files');
});

module.exports = router;


