const path = require('path');
const fs = require('fs');

const DISABLE_DB = process.env.DISABLE_DB === '1' || process.env.DISABLE_DB === 'true';
const USE_PG = !!process.env.DATABASE_URL;

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbPromise;

async function getSqliteDatabase() {
  const sqlite3 = require('sqlite3').verbose();
  const { open } = require('sqlite');
  const db = await open({ filename: path.join(DATA_DIR, 'app.sqlite'), driver: sqlite3.Database });
  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      isAdmin INTEGER NOT NULL DEFAULT 0,
      passwordHash TEXT NOT NULL,
      contactCode TEXT
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
      FOREIGN KEY(createdBy) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS mission_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      missionId INTEGER NOT NULL,
      code TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(missionId) REFERENCES missions(id) ON DELETE CASCADE
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
      createdAt TEXT NOT NULL
    );
  `);
  // Optional migrations
  try {
    const info = await db.all("PRAGMA table_info(files)");
    if (!info.some((c) => c.name === 'description')) {
      await db.exec('ALTER TABLE files ADD COLUMN description TEXT');
    }
  } catch {}
  try {
    const uinfo = await db.all("PRAGMA table_info(users)");
    if (!uinfo.some((c) => c.name === 'firstName')) {
      await db.exec('ALTER TABLE users ADD COLUMN firstName TEXT');
    }
  } catch {}
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromCode TEXT NOT NULL,
        toCode TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
  } catch {}
  try {
    const finfo = await db.all("PRAGMA table_info(files)");
    if (!finfo.some((c) => c.name === 'blob')) {
      await db.exec('ALTER TABLE files ADD COLUMN blob BLOB');
    }
  } catch {}
  return db;
}

async function getPostgresDatabase() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '0' ? false : { rejectUnauthorized: false } });

  // Create tables if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      isAdmin BOOLEAN NOT NULL DEFAULT FALSE,
      passwordHash TEXT NOT NULL,
      contactCode TEXT,
      firstName TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS missions (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdBy INTEGER,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mission_responses (
      id SERIAL PRIMARY KEY,
      missionId INTEGER NOT NULL,
      code TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rumors (
      id SERIAL PRIMARY KEY,
      codeTag TEXT NOT NULL,
      content TEXT NOT NULL,
      credibility TEXT NOT NULL CHECK (credibility IN ('Verifie', 'Potentiellement faux', 'Rumeur')),
      createdAt TEXT NOT NULL,
      code TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      codeTag TEXT NOT NULL,
      uploaderCode TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      description TEXT,
      blob BYTEA
    );
    CREATE TABLE IF NOT EXISTS direct_messages (
      id SERIAL PRIMARY KEY,
      fromCode TEXT NOT NULL,
      toCode TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  const normalizeRow = (row) => {
    if (!row) return row;
    const map = {
      passwordhash: 'passwordHash',
      isadmin: 'isAdmin',
      createdat: 'createdAt',
      originalname: 'originalName',
      codetag: 'codeTag',
      uploadercode: 'uploaderCode',
      contactcode: 'contactCode',
      firstname: 'firstName',
      fromcode: 'fromCode',
      tocode: 'toCode',
    };
    const out = {};
    for (const k of Object.keys(row)) {
      const nk = map[k] || k;
      out[nk] = row[k];
    }
    return out;
  };

  const adapter = {
    async all(sql, ...params) {
      const { rows } = await pool.query(toPgQuery(sql), params);
      return rows.map(normalizeRow);
    },
    async get(sql, ...params) {
      const { rows } = await pool.query(toPgQuery(sql), params);
      return normalizeRow(rows[0]) || null;
    },
    async run(sql, params) {
      const q = toPgQuery(sql);
      if (params === undefined) {
        await pool.query(q);
      } else if (Array.isArray(params)) {
        await pool.query(q, params);
      } else {
        await pool.query(q, [params]);
      }
      return { changes: 1 };
    },
    async prepare(sql) {
      return {
        async run(...params) {
          await pool.query(toPgQuery(sql), params);
          return { lastID: null };
        },
        async finalize() {}
      };
    }
  };
  return adapter;
}

function toPgQuery(sql) {
  // Convert SQLite placeholders ? to $1, $2, ...
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function getDatabase() {
  if (DISABLE_DB) throw new Error('Database is disabled via DISABLE_DB');
  if (!dbPromise) {
    dbPromise = USE_PG ? getPostgresDatabase() : getSqliteDatabase();
  }
  return dbPromise;
}

module.exports = { getDatabase };


