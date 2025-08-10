const path = require('path');
const fs = require('fs');

const DISABLE_DB = process.env.DISABLE_DB === '1' || process.env.DISABLE_DB === 'true';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbPromise;

async function getDatabase() {
  if (DISABLE_DB) {
    throw new Error('Database is disabled via DISABLE_DB');
  }
  if (!dbPromise) {
    const sqlite3 = require('sqlite3').verbose();
    const { open } = require('sqlite');
    dbPromise = open({ filename: path.join(DATA_DIR, 'app.sqlite'), driver: sqlite3.Database });
    await (await dbPromise).exec(`
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
    // Migration: add description column to files if missing
    try {
      const info = await (await dbPromise).all("PRAGMA table_info(files)");
      const hasDescription = info.some((c) => c.name === 'description');
      if (!hasDescription) {
        await (await dbPromise).exec('ALTER TABLE files ADD COLUMN description TEXT');
      }
    } catch (_) {
      // ignore
    }

    // Migration: add firstName column to users if missing (used as cipher key)
    try {
      const uinfo = await (await dbPromise).all("PRAGMA table_info(users)");
      const hasFirstName = uinfo.some((c) => c.name === 'firstName');
      if (!hasFirstName) {
        await (await dbPromise).exec('ALTER TABLE users ADD COLUMN firstName TEXT');
      }
    } catch (_) {
      // ignore
    }

    // Create direct_messages table if missing (for private communications)
    try {
      await (await dbPromise).exec(`
        CREATE TABLE IF NOT EXISTS direct_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fromCode TEXT NOT NULL,
          toCode TEXT NOT NULL,
          content TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
      `);
    } catch (_) {
      // ignore
    }

    // Migration: add blob column to files for inline storage fallback
    try {
      const finfo = await (await dbPromise).all("PRAGMA table_info(files)");
      const hasBlob = finfo.some((c) => c.name === 'blob');
      if (!hasBlob) {
        await (await dbPromise).exec('ALTER TABLE files ADD COLUMN blob BLOB');
      }
    } catch (_) {
      // ignore
    }
  }
  return dbPromise;
}

module.exports = { getDatabase };


