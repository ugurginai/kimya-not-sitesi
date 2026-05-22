const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data.db');
let db;

function init() {
  const exists = fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  if (!exists) {
    createTables();
    migrateFromJson();
  }
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      name TEXT DEFAULT '',
      surname TEXT DEFAULT '',
      role TEXT DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS stars (
      username TEXT PRIMARY KEY,
      stars INTEGER DEFAULT 0,
      online INTEGER DEFAULT 0,
      lastActive INTEGER DEFAULT 0,
      todayActive INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS progress (
      username TEXT NOT NULL,
      type TEXT NOT NULL,
      topic_index INTEGER NOT NULL,
      PRIMARY KEY (username, type, topic_index)
    );
    CREATE TABLE IF NOT EXISTS calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      date TEXT NOT NULL,
      active INTEGER DEFAULT 0,
      topics TEXT DEFAULT '[]',
      plan TEXT DEFAULT '[]',
      UNIQUE(username, date)
    );
  `);
}

function migrateFromJson() {
  const usersFile = path.join(__dirname, 'users.json');
  const starsFile = path.join(__dirname, 'stars.json');
  const progressFile = path.join(__dirname, 'progress.json');
  const calendarFile = path.join(__dirname, 'calendar.json');

  try {
    if (fs.existsSync(usersFile)) {
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
      const insert = db.prepare('INSERT OR IGNORE INTO users (username, password, name, surname, role) VALUES (?, ?, ?, ?, ?)');
      for (const [username, data] of Object.entries(users)) {
        insert.run(username, data.password || '', data.name || '', data.surname || '', data.role || 'user');
      }
    }
    if (fs.existsSync(starsFile)) {
      const stars = JSON.parse(fs.readFileSync(starsFile, 'utf-8'));
      const insert = db.prepare('INSERT OR IGNORE INTO stars (username, stars, online, lastActive, todayActive) VALUES (?, ?, ?, ?, ?)');
      for (const [username, data] of Object.entries(stars)) {
        insert.run(username, data.stars || 0, data.online ? 1 : 0, data.lastActive || 0, data.todayActive || 0);
      }
    }
    if (fs.existsSync(progressFile)) {
      const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      const insert = db.prepare('INSERT OR IGNORE INTO progress (username, type, topic_index) VALUES (?, ?, ?)');
      for (const [username, data] of Object.entries(progress)) {
        if (data.tyt) data.tyt.forEach(i => insert.run(username, 'tyt', i));
        if (data.ayt) data.ayt.forEach(i => insert.run(username, 'ayt', i));
      }
    }
    if (fs.existsSync(calendarFile)) {
      const calendar = JSON.parse(fs.readFileSync(calendarFile, 'utf-8'));
      const insert = db.prepare('INSERT OR IGNORE INTO calendar (username, date, active, topics, plan) VALUES (?, ?, ?, ?, ?)');
      for (const [username, dates] of Object.entries(calendar)) {
        for (const [date, data] of Object.entries(dates)) {
          insert.run(username, date, data.active || 0, JSON.stringify(data.topics || []), JSON.stringify(data.plan || []));
        }
      }
    }
    console.log('JSON verileri SQLite\'a aktarıldı.');
  } catch (e) {
    console.error('Migrasyon hatası:', e.message);
  }
}

// --- Users ---
function loadUsers() {
  const rows = db.prepare('SELECT * FROM users').all();
  const users = {};
  for (const row of rows) {
    users[row.username] = { password: row.password, name: row.name || '', surname: row.surname || '', role: row.role || 'user' };
  }
  return users;
}

function saveUsers(users) {
  const upsert = db.prepare('INSERT OR REPLACE INTO users (username, password, name, surname, role) VALUES (?, ?, ?, ?, ?)');
  const del = db.prepare('DELETE FROM users WHERE username = ?');
  const txn = db.transaction(() => {
    const existing = new Set(db.prepare('SELECT username FROM users').all().map(r => r.username));
    for (const username of existing) {
      if (!users[username]) del.run(username);
    }
    for (const [username, data] of Object.entries(users)) {
      upsert.run(username, data.password || '', data.name || '', data.surname || '', data.role || 'user');
    }
  });
  txn();
}

// --- Stars ---
function loadStars() {
  const rows = db.prepare('SELECT * FROM stars').all();
  const stars = {};
  for (const row of rows) {
    stars[row.username] = {
      stars: row.stars || 0,
      online: !!row.online,
      lastActive: row.lastActive || 0,
      todayActive: row.todayActive || 0,
    };
  }
  return stars;
}

function saveStars(data) {
  const upsert = db.prepare('INSERT OR REPLACE INTO stars (username, stars, online, lastActive, todayActive) VALUES (?, ?, ?, ?, ?)');
  const txn = db.transaction(() => {
    for (const [username, d] of Object.entries(data)) {
      upsert.run(username, d.stars || 0, d.online ? 1 : 0, d.lastActive || 0, d.todayActive || 0);
    }
  });
  txn();
}

// --- Progress ---
function loadProgress() {
  const rows = db.prepare('SELECT * FROM progress ORDER BY type, topic_index').all();
  const progress = {};
  for (const row of rows) {
    if (!progress[row.username]) progress[row.username] = { tyt: [], ayt: [] };
    progress[row.username][row.type].push(row.topic_index);
  }
  return progress;
}

function saveProgress(data) {
  const del = db.prepare('DELETE FROM progress WHERE username = ?');
  const insert = db.prepare('INSERT OR IGNORE INTO progress (username, type, topic_index) VALUES (?, ?, ?)');
  const txn = db.transaction(() => {
    for (const [username, d] of Object.entries(data)) {
      del.run(username);
      if (d.tyt) d.tyt.forEach(i => insert.run(username, 'tyt', i));
      if (d.ayt) d.ayt.forEach(i => insert.run(username, 'ayt', i));
    }
  });
  txn();
}

// --- Calendar ---
function loadCalendar() {
  const rows = db.prepare('SELECT * FROM calendar').all();
  const calendar = {};
  for (const row of rows) {
    if (!calendar[row.username]) calendar[row.username] = {};
    calendar[row.username][row.date] = {
      active: row.active || 0,
      topics: safeParse(row.topics, []),
      plan: safeParse(row.plan, []),
    };
  }
  return calendar;
}

function saveCalendar(data) {
  const del = db.prepare('DELETE FROM calendar WHERE username = ? AND date = ?');
  const insert = db.prepare('INSERT OR REPLACE INTO calendar (username, date, active, topics, plan) VALUES (?, ?, ?, ?, ?)');
  const txn = db.transaction(() => {
    for (const [username, dates] of Object.entries(data)) {
      for (const [date, d] of Object.entries(dates)) {
        insert.run(username, date, d.active || 0, JSON.stringify(d.topics || []), JSON.stringify(d.plan || []));
      }
    }
  });
  txn();
}

function safeParse(str, def) {
  try { return JSON.parse(str); } catch { return def; }
}

module.exports = { init, loadUsers, saveUsers, loadStars, saveStars, loadProgress, saveProgress, loadCalendar, saveCalendar };
