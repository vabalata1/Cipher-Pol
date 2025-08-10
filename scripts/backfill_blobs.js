const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../src/config/database');

async function backfill() {
  const db = await getDatabase();
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
  const rows = await db.all('SELECT id, filename, originalName FROM files WHERE blob IS NULL');
  let updated = 0;
  for (const row of rows) {
    const full = path.resolve(uploadDir, row.filename);
    if (fs.existsSync(full)) {
      try {
        const buf = fs.readFileSync(full);
        await db.run('UPDATE files SET blob = ? WHERE id = ?', buf, row.id);
        updated++;
        console.log(`Backfilled blob for id=${row.id} (${row.originalName})`);
      } catch (e) {
        console.error(`Failed to backfill id=${row.id}:`, e.message);
      }
    } else {
      console.warn(`Missing on disk: id=${row.id} (${row.originalName})`);
    }
  }
  console.log(`Done. Updated ${updated}/${rows.length} rows.`);
}

backfill().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });