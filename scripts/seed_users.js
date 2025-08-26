const bcrypt = require('bcryptjs');
const { getDatabase } = require('../src/config/database');

async function run() {
  const db = await getDatabase();
  const existing = await db.get('SELECT COUNT(1) as c FROM users');
  if (existing.c > 0) {
    console.log('Users already seeded.');
    process.exit(0);
  }

  // MR.0 is admin but not directly usable by autres; we store as code 'MR.0' and isAdmin=1
  const users = [
    { code: 'MR.0', role: '???', isAdmin: 1 },
    { code: 'MR.1', role: 'Agent', isAdmin: 0 },
    { code: 'MR.2', role: 'Agent', isAdmin: 0 },
    { code: 'MR.3', role: 'Agent', isAdmin: 0 },
    { code: 'MR.4', role: 'Agent', isAdmin: 0 },
    { code: 'MR.5', role: 'Agent', isAdmin: 0 },
    { code: 'MR.6', role: 'Agent', isAdmin: 0 },
    { code: 'MR.7', role: 'Agent', isAdmin: 0 },
    { code: 'MR.8', role: 'Agent', isAdmin: 0 },
    { code: 'MR.9', role: 'Agent', isAdmin: 0 },
  ];

  // chaines de contact: MR.8->MR.7->...->MR.1 (MR.0 connu seulement par MR.1 selon le lore; ici on met contactCode en conséquence)
  const contactMap = {
    'MR.9': 'MR.8',
    'MR.8': 'MR.7',
    'MR.7': 'MR.6',
    'MR.6': 'MR.5',
    'MR.5': 'MR.4',
    'MR.4': 'MR.3',
    'MR.3': 'MR.2',
    'MR.2': 'MR.1',
    'MR.1': 'MR.0',
    'MR.0': null,
  };

  const defaultPassword = 'change_me_now';
  const hash = await bcrypt.hash(defaultPassword.toLowerCase(), 10);

  const stmt = await db.prepare('INSERT INTO users (code, role, isAdmin, passwordHash, contactCode) VALUES (?, ?, ?, ?, ?)');
  for (const u of users) {
    await stmt.run(u.code, u.role, u.isAdmin, hash, contactMap[u.code] || null);
  }
  await stmt.finalize();
  console.log('Seeded users with default password:', defaultPassword);
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});


