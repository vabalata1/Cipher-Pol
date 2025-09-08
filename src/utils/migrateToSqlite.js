const fs = require('fs');
const path = require('path');

async function migrateFromPostgresToSqlite(options = {}) {
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) {
    throw new Error('DATABASE_URL is required to migrate from Postgres');
  }

  const dataRoot = options.root || process.env.TARGET_ROOT || '/var/data';
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(dataRoot, 'data'));
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(dataRoot, 'uploads'));

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const { Pool } = require('pg');
  const sqlite3 = require('sqlite3').verbose();
  const { open } = require('sqlite');

  const pool = new Pool({ connectionString: pgUrl, ssl: process.env.PGSSL === '0' ? false : { rejectUnauthorized: false } });
  const db = await open({ filename: path.join(dataDir, 'app.sqlite'), driver: sqlite3.Database });

  const shouldWipe = options.wipe !== undefined ? !!options.wipe : process.env.MIGRATE_WIPE !== '0';
  if (shouldWipe) {
    await db.exec(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS mission_dependencies;
      DROP TABLE IF EXISTS mission_binomes;
      DROP TABLE IF EXISTS mission_attachments;
      DROP TABLE IF EXISTS mission_priority_votes;
      DROP TABLE IF EXISTS mission_assignments;
      DROP TABLE IF EXISTS mission_milestones;
      DROP TABLE IF EXISTS mission_responses;
      DROP TABLE IF EXISTS missions;
      DROP TABLE IF EXISTS direct_messages;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS rumors;
      DROP TABLE IF EXISTS files;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS app_settings;
      PRAGMA foreign_keys = ON;
    `);
  }

  // Ensure schema exists
  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      isAdmin INTEGER NOT NULL DEFAULT 0,
      passwordHash TEXT NOT NULL,
      contactCode TEXT,
      firstName TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdBy INTEGER,
      createdAt TEXT NOT NULL,
      difficulty TEXT,
      priority TEXT,
      zone TEXT,
      tags TEXT,
      deadlineAt TEXT,
      geo TEXT,
      points INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mission_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      missionId INTEGER NOT NULL,
      code TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rumors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codeTag TEXT NOT NULL,
      content TEXT NOT NULL,
      credibility TEXT NOT NULL CHECK (credibility IN ('Verifie', 'Potentiellement faux', 'Rumeur')),
      createdAt TEXT NOT NULL,
      code TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      codeTag TEXT NOT NULL,
      uploaderCode TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      description TEXT,
      blob BLOB
    );
    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromCode TEXT NOT NULL,
      toCode TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const copyTable = async (tableName, columns) => {
    const { rows } = await pool.query(`SELECT ${columns.join(', ')} FROM ${tableName}`);
    if (!rows.length) return 0;
    const placeholders = '(' + columns.map(() => '?').join(',') + ')';
    const stmt = await db.prepare(`INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${placeholders}`);
    let count = 0;
    for (const row of rows) {
      const values = columns.map((c) => row[c] ?? row[c.toLowerCase()]);
      await stmt.run(...values);
      count++;
    }
    await stmt.finalize();
    return count;
  };

  const totals = {};
  totals.users = await copyTable('users', ['id','code','role','isadmin','passwordhash','contactcode','firstname']);
  totals.messages = await copyTable('messages', ['id','code','content','createdat']);
  totals.missions = await copyTable('missions', ['id','title','content','status','createdby','createdat','difficulty','priority','zone','tags','deadlineat','geo','points']);
  totals.mission_responses = await copyTable('mission_responses', ['id','missionid','code','content','createdat']);
  totals.rumors = await copyTable('rumors', ['id','codetag','content','credibility','createdat','code']);
  totals.files = await copyTable('files', ['id','filename','originalname','codetag','uploadercode','createdat','description','blob']);
  totals.direct_messages = await copyTable('direct_messages', ['id','fromcode','tocode','content','createdat']);
  totals.app_settings = await copyTable('app_settings', ['key','value']);

  const files = await db.all('SELECT id, filename, originalName, blob FROM files');
  let extracted = 0;
  for (const f of files) {
    const full = path.resolve(uploadDir, f.filename);
    if (!fs.existsSync(full) && f.blob) {
      fs.writeFileSync(full, f.blob);
      extracted++;
    }
  }

  await db.close();
  await pool.end();

  return { totals, extracted, uploadDir, dataDir, wiped: shouldWipe };
}

module.exports = { migrateFromPostgresToSqlite };

