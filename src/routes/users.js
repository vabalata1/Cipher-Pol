const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../config/database');

const router = express.Router();

// Admin guard
function requireAdmin(req, res, next) {
  if (req.user && req.user.isAdmin) return next();
  return res.status(403).send('Accès refusé');
}

// GET /users - Liste des MR.X avec formulaires de gestion
router.get('/', requireAdmin, async (req, res) => {
  const db = await getDatabase();
  const users = await db.all('SELECT id, code, role, isAdmin, firstName FROM users ORDER BY code ASC');
  res.render('users/index', { title: 'Utilisateurs', users });
});

// POST /users/:id/password - Définir un nouveau mot de passe pour un utilisateur
router.post('/:id/password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const raw = (password ?? '').toString();
    const effectivePassword = raw.length === 0 ? 'change_me_now' : raw;
    const db = await getDatabase();
    const user = await db.get('SELECT id, code FROM users WHERE id = ?', id);
    if (!user) return res.status(404).send("Utilisateur introuvable");

    const hash = await bcrypt.hash(effectivePassword, 10);
    await db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [hash, id]);

    return res.redirect('/users');
  } catch (e) {
    console.error(e);
    return res.status(500).send('Erreur serveur');
  }
});

// POST /users/:id/firstname - Définir/mettre à jour la clé (prénom)
router.post('/:id/firstname', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName } = req.body;
    const db = await getDatabase();
    const user = await db.get('SELECT id, code FROM users WHERE id = ?', id);
    if (!user) return res.status(404).send('Utilisateur introuvable');

    const value = (firstName || '').trim();
    await db.run('UPDATE users SET firstName = ? WHERE id = ?', [value || null, id]);

    return res.redirect('/users');
  } catch (e) {
    console.error(e);
    return res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
