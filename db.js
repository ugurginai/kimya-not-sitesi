const { Pool } = require('pg');

let pool;

function init() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  createTables();
  return pool;
}

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
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
        lastActive BIGINT DEFAULT 0,
        todayActive INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS progress (
        username TEXT NOT NULL,
        type TEXT NOT NULL,
        topic_index INTEGER NOT NULL,
        PRIMARY KEY (username, type, topic_index)
      );
      CREATE TABLE IF NOT EXISTS calendar (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        date TEXT NOT NULL,
        active INTEGER DEFAULT 0,
        topics TEXT DEFAULT '[]',
        plan TEXT DEFAULT '[]',
        UNIQUE(username, date)
      );
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        topic_type TEXT NOT NULL,
        topic_index INTEGER NOT NULL,
        note_type TEXT DEFAULT 'not',
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('PostgreSQL tablolari olusturuldu.');
  } finally {
    client.release();
  }
}

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function loadUsers() {
  const result = await query('SELECT * FROM users');
  const users = {};
  for (const row of result.rows) {
    users[row.username] = { password: row.password, name: row.name || '', surname: row.surname || '', role: row.role || 'user' };
  }
  return users;
}

async function saveUsers(users) {
  const existing = await query('SELECT username FROM users');
  const existingSet = new Set(existing.rows.map(r => r.username));
  for (const username of existingSet) {
    if (!users[username]) await query('DELETE FROM users WHERE username = $1', [username]);
  }
  for (const [username, data] of Object.entries(users)) {
    await query(
      'INSERT INTO users (username, password, name, surname, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO UPDATE SET password = $2, name = $3, surname = $4, role = $5',
      [username, data.password || '', data.name || '', data.surname || '', data.role || 'user']
    );
  }
}

async function loadStars() {
  const result = await query('SELECT * FROM stars');
  const stars = {};
  for (const row of result.rows) {
    stars[row.username] = {
      stars: row.stars || 0,
      online: !!row.online,
      lastActive: row.lastactive || 0,
      todayActive: row.todayactive || 0,
    };
  }
  return stars;
}

async function saveStars(data) {
  for (const [username, d] of Object.entries(data)) {
    await query(
      'INSERT INTO stars (username, stars, online, lastActive, todayActive) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO UPDATE SET stars = $2, online = $3, lastActive = $4, todayActive = $5',
      [username, d.stars || 0, d.online ? 1 : 0, d.lastActive || 0, d.todayActive || 0]
    );
  }
}

async function loadProgress() {
  const result = await query('SELECT * FROM progress ORDER BY type, topic_index');
  const progress = {};
  for (const row of result.rows) {
    if (!progress[row.username]) progress[row.username] = { tyt: [], ayt: [] };
    progress[row.username][row.type].push(row.topic_index);
  }
  return progress;
}

async function saveProgress(data) {
  for (const [username, d] of Object.entries(data)) {
    await query('DELETE FROM progress WHERE username = $1', [username]);
    if (d.tyt) {
      for (const i of d.tyt) {
        await query('INSERT INTO progress (username, type, topic_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [username, 'tyt', i]);
      }
    }
    if (d.ayt) {
      for (const i of d.ayt) {
        await query('INSERT INTO progress (username, type, topic_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [username, 'ayt', i]);
      }
    }
  }
}

async function loadCalendar() {
  const result = await query('SELECT * FROM calendar');
  const calendar = {};
  for (const row of result.rows) {
    if (!calendar[row.username]) calendar[row.username] = {};
    calendar[row.username][row.date] = {
      active: row.active || 0,
      topics: safeParse(row.topics, []),
      plan: safeParse(row.plan, []),
    };
  }
  return calendar;
}

async function saveCalendar(data) {
  for (const [username, dates] of Object.entries(data)) {
    for (const [date, d] of Object.entries(dates)) {
      await query(
        'INSERT INTO calendar (username, date, active, topics, plan) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username, date) DO UPDATE SET active = $3, topics = $4, plan = $5',
        [username, date, d.active || 0, JSON.stringify(d.topics || []), JSON.stringify(d.plan || [])]
      );
    }
  }
}

function safeParse(str, def) {
  try { return JSON.parse(str); } catch { return def; }
}

async function loadNotes(topicType, topicIndex) {
  let queryText = 'SELECT * FROM notes';
  const params = [];
  const conditions = [];
  if (topicType) {
    const types = topicType.split(',').map(t => t.trim()).filter(Boolean);
    if (types.length === 1) {
      conditions.push('topic_type = $' + (params.length + 1));
      params.push(types[0]);
    } else {
      const placeholders = types.map(t => '$' + (params.length + 1)).join(',');
      params.push(...types);
      conditions.push('topic_type IN (' + placeholders + ')');
    }
  }
  if (topicIndex !== undefined && topicIndex !== null && topicIndex !== '') {
    conditions.push('topic_index = $' + (params.length + 1));
    params.push(parseInt(topicIndex));
  }
  if (conditions.length) queryText += ' WHERE ' + conditions.join(' AND ');
  queryText += ' ORDER BY created_at DESC';
  const result = await query(queryText, params);
  return result.rows;
}

async function createNote(data) {
  const result = await query(
    'INSERT INTO notes (title, description, topic_type, topic_index, note_type, filename, original_name, file_size, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
    [data.title, data.description || '', data.topic_type, data.topic_index, data.note_type || 'not', data.filename, data.original_name, data.file_size || 0, data.created_by]
  );
  return result.rows[0];
}

async function deleteNote(id) {
  const result = await query('DELETE FROM notes WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

module.exports = { init, loadUsers, saveUsers, loadStars, saveStars, loadProgress, saveProgress, loadCalendar, saveCalendar, loadNotes, createNote, deleteNote };
