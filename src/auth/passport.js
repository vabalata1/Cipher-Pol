const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../config/database');

module.exports = function initPassport(passportInstance) {
  passportInstance.use(
    new LocalStrategy({ usernameField: 'code', passwordField: 'password' }, async (code, password, done) => {
      try {
        const db = await getDatabase();
        const user = await db.get('SELECT * FROM users WHERE code = ?', code);
        if (!user) return done(null, false, { message: 'Identifiants invalides' });
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return done(null, false, { message: 'Identifiants invalides' });
        const isAdmin = !!user.isAdmin || user.code === 'MR.0' || user.code === 'MR.1';
        return done(null, { id: user.id, code: user.code, role: user.role, isAdmin });
      } catch (e) {
        return done(e);
      }
    })
  );

  passportInstance.serializeUser((user, done) => {
    done(null, user.id);
  });

  passportInstance.deserializeUser(async (id, done) => {
    try {
      const db = await getDatabase();
      const user = await db.get('SELECT id, code, role, isAdmin FROM users WHERE id = ?', id);
      if (!user) return done(null, false);
      const isAdmin = !!user.isAdmin || user.code === 'MR.0' || user.code === 'MR.1';
      done(null, { id: user.id, code: user.code, role: user.role, isAdmin });
    } catch (e) {
      done(e);
    }
  });
};


