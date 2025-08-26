const bcrypt = require('bcryptjs');
const { getDatabase } = require('../src/config/database');

async function changePassword(userCode, newPassword) {
  const db = await getDatabase();
  const normalized = (newPassword ?? '').toString().toLowerCase();
  const hash = await bcrypt.hash(normalized, 10);
  
  await db.run('UPDATE users SET passwordHash = ? WHERE code = ?', [hash, userCode]);
  console.log(`Password changed for ${userCode}`);
}

// Usage: node scripts/change_password.js MR.0 nouveau_mot_de_passe
const userCode = process.argv[2];
const newPassword = process.argv[3];

if (!userCode || !newPassword) {
  console.log('Usage: node scripts/change_password.js <USER_CODE> <NEW_PASSWORD>');
  console.log('Example: node scripts/change_password.js MR.0 mon_nouveau_mdp');
  process.exit(1);
}

changePassword(userCode, newPassword).then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
