const bcrypt = require('bcryptjs');
const { getDatabase } = require('../src/config/database');

function parseNum(code) {
  const m = /^MR\.(\d+)$/.exec(code || '');
  return m ? parseInt(m[1], 10) : null;
}

async function addUser(code, role = 'Agent', isAdmin) {
  if (!/^MR\.\d+$/.test(code)) throw new Error('Code invalide, attendu format MR.x');
  const db = await getDatabase();
  const existing = await db.get('SELECT id FROM users WHERE code = ?', code);
  if (existing) {
    console.log(code, 'existe déjà. Rien à faire.');
    return;
  }
  const n = parseNum(code);
  const contactCode = (n !== null && n > 0) ? `MR.${n - 1}` : null;
  const adminFlag = typeof isAdmin === 'number' ? isAdmin : (code === 'MR.0' ? 1 : 0);
  const defaultPassword = process.env.NEW_USER_DEFAULT_PASSWORD || 'change_me_now';
  const hash = await bcrypt.hash(defaultPassword.toLowerCase(), 10);

  const stmt = await db.prepare('INSERT INTO users (code, role, isAdmin, passwordHash, contactCode) VALUES (?, ?, ?, ?, ?)');
  await stmt.run(code, role, adminFlag, hash, contactCode);
  await stmt.finalize();
  console.log(`Utilisateur ${code} ajouté. Mot de passe par défaut: ${defaultPassword}`);
}

(async () => {
  try {
    const code = process.argv[2] || 'MR.9';
    const role = process.argv[3] || 'Agent';
    const isAdmin = process.argv[4] !== undefined ? Number(process.argv[4]) : undefined; // 1 ou 0 optionnel
    await addUser(code, role, isAdmin);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
