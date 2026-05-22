const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const multer = require("multer");
const db = require("./db");

const UPLOADS_DIR = path.join(__dirname, "uploads", "notes");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
const PORT = 3000;

const ADMIN_USERNAME = "Kimya_not";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "191435U.g";

const TYT_TOPICS = ["Kimya Bilimi","Atom ve Periyodik Tablo","Kimyasal Türlerarası Etkileşimler","Maddenin Halleri","Doğa ve Kimya","Kimyanın Temel Kanunları","Kimyasal Hesaplamalar","Karışımlar","Asit Baz Tuz","Kimya Her Yerde"];
const AYT_TOPICS = ["Modern Atom Teorisi","Gazlar","Sıvı Çözeltiler","Kimyasal Tepkimelerde Entalpi","Kimyasal Tepkimelerde Hız","Kimyasal Tepkimelerde Denge","Asit Baz Dengesi","Çözünürlük Dengesi","Elektrokimya","Karbon Kimyasına Giriş","Organik Kimya"];

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get("/health", (req, res) => res.json({ ok: true, time: Date.now() }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "kimya-not-sitesi-gizli-anahtar-2026",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  if (req.path.startsWith("/api/") || req.path.startsWith("/files/")) return res.status(401).json({ error: "Giriş yapmalısınız" });
  res.redirect("/login.html");
}
async function requireAdmin(req, res, next) {
  try {
    const users = await db.loadUsers();
    if (users && users[req.session.userId]?.role === "admin") return next();
  } catch {}
  res.status(403).json({ error: "Yetkiniz yok" });
}

async function loadAll() {
  const [users, stars, progress, calendar] = await Promise.all([
    db.loadUsers(), db.loadStars(), db.loadProgress(), db.loadCalendar()
  ]);
  return { users, stars, progress, calendar };
}

app.get("/api/me", async (req, res) => {
  if (req.session.userId) {
    const { users } = await loadAll();
    const u = users[req.session.userId];
    res.json({ user: req.session.userId, name: u?.name || req.session.userId, surname: u?.surname || "", role: u?.role || "user" });
  } else {
    res.json({ user: null });
  }
});

app.post("/api/kayit", async (req, res) => {
  const { username, password, name, surname } = req.body;
  if (!username || !password || username.length < 3 || password.length < 3) return res.status(400).json({ error: "Kullanıcı adı ve şifre en az 3 karakter olmalı" });
  if (!name || !surname) return res.status(400).json({ error: "Ad ve soyad zorunludur" });
  const { users } = await loadAll();
  if (users[username]) return res.status(400).json({ error: "Bu kullanıcı adı zaten alınmış" });
  users[username] = { password, name, surname, role: "user" };
  await db.saveUsers(users);
  req.session.userId = username;
  res.json({ success: true, user: username, name, surname });
});

app.post("/api/giris", async (req, res) => {
  const { username, password } = req.body;
  const { users } = await loadAll();
  if (!users[username] || users[username].password !== password) return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı" });
  req.session.userId = username;
  res.json({ success: true, user: username });
});

app.post("/api/cikis", (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const { users, stars, progress } = await loadAll();
  const list = Object.entries(users).filter(([id]) => id !== ADMIN_USERNAME).map(([id, d]) => {
    const p = progress[id] || { tyt: [], ayt: [] };
    return {
      username: id, name: d.name || "", surname: d.surname || "", role: d.role || "user",
      stars: stars[id]?.stars || 0, online: stars[id]?.online || false,
      tytDone: (p.tyt || []).length, tytTotal: 10,
      aytDone: (p.ayt || []).length, aytTotal: 11,
      tytList: p.tyt || [],
      aytList: p.ayt || [],
    };
  });
  res.json({ total: list.length, users: list });
});

app.post("/api/admin/users/add", requireAuth, requireAdmin, async (req, res) => {
  const { username, password, name, surname } = req.body;
  if (!username || !password || username.length < 3) return res.status(400).json({ error: "Geçersiz bilgiler" });
  const { users } = await loadAll();
  if (users[username]) return res.status(400).json({ error: "Bu kullanıcı adı zaten var" });
  users[username] = { password, name: name || "", surname: surname || "", role: "user" };
  await db.saveUsers(users);
  res.json({ success: true });
});

app.post("/api/admin/users/delete", requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Kullanıcı adı gerekli" });
  const { users } = await loadAll();
  if (!users[username]) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  if (username === ADMIN_USERNAME) return res.status(403).json({ error: "Admin silinemez" });
  delete users[username];
  await db.saveUsers(users);
  const { stars } = await loadAll();
  delete stars[username];
  await db.saveStars(stars);
  const { progress } = await loadAll();
  delete progress[username];
  await db.saveProgress(progress);
  res.json({ success: true });
});

app.post("/api/admin/users/reset-password", requireAuth, requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 3) return res.status(400).json({ error: "Geçersiz şifre" });
  const { users } = await loadAll();
  if (!users[username]) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  users[username].password = password;
  await db.saveUsers(users);
  res.json({ success: true });
});

app.get("/api/leaderboard", requireAuth, async (req, res) => {
  const { users, stars } = await loadAll();
  const now = Date.now();
  let onlineCount = 0;
  const list = Object.entries(users).filter(([id]) => id !== ADMIN_USERNAME).map(([id, d]) => {
    const s = stars[id] || {};
    const lastActive = s.lastActive || 0;
    const online = s.online && (now - lastActive < 70000);
    if (online) onlineCount++;
    return { username: id, name: d.name || "", surname: d.surname || "", stars: s.stars || 0, online, lastActive };
  }).sort((a, b) => b.stars - a.stars);
  res.json({ users: list, onlineCount });
});

app.get("/api/progress", requireAuth, async (req, res) => {
  const { progress } = await loadAll();
  res.json(progress[req.session.userId] || { tyt: [], ayt: [] });
});

app.post("/api/progress", requireAuth, async (req, res) => {
  const { tyt, ayt } = req.body;
  const { progress } = await loadAll();
  progress[req.session.userId] = { tyt: tyt || [], ayt: ayt || [] };
  await db.saveProgress(progress);
  res.json({ success: true });
});

app.get("/api/calendar", requireAuth, async (req, res) => {
  const { calendar } = await loadAll();
  res.json(calendar[req.session.userId] || {});
});

app.post("/api/calendar/log", requireAuth, async (req, res) => {
  const { topicIdx, type } = req.body;
  const { calendar } = await loadAll();
  const today = new Date().toISOString().split("T")[0];
  if (!calendar[req.session.userId]) calendar[req.session.userId] = {};
  if (!calendar[req.session.userId][today]) calendar[req.session.userId][today] = { active: 0, topics: [], plan: [] };
  const day = calendar[req.session.userId][today];
  const idx = day.topics.indexOf(topicIdx);
  if (type === "add" && idx === -1) day.topics.push(topicIdx);
  if (type === "remove" && idx !== -1) day.topics.splice(idx, 1);
  if (!day.topics.length && !day.active && !day.plan?.length) delete calendar[req.session.userId][today];
  await db.saveCalendar(calendar);
  res.json({ success: true });
});

app.post("/api/calendar/plan", requireAuth, async (req, res) => {
  const { date, plan } = req.body;
  if (!date) return res.status(400).json({ error: "Tarih gerekli" });
  const { calendar } = await loadAll();
  if (!calendar[req.session.userId]) calendar[req.session.userId] = {};
  if (!calendar[req.session.userId][date]) calendar[req.session.userId][date] = { active: 0, topics: [], plan: [] };
  calendar[req.session.userId][date].plan = (plan || []).map(p => ({
    ...p,
    createdBy: p.createdBy || "student",
    id: p.id || Date.now().toString(36) + Math.random().toString(36).substr(2,5)
  }));
  if (!calendar[req.session.userId][date].plan.length && !calendar[req.session.userId][date].topics.length && !calendar[req.session.userId][date].active) {
    delete calendar[req.session.userId][date];
  }
  await db.saveCalendar(calendar);
  res.json({ success: true });
});

app.post("/api/calendar/plan/admin", requireAuth, requireAdmin, async (req, res) => {
  const { username, date, planItem } = req.body;
  if (!username || !date || !planItem) return res.status(400).json({ error: "Eksik bilgi" });
  const { users, calendar } = await loadAll();
  if (!users[username]) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  if (!planItem.topicName) return res.status(400).json({ error: "Konu adı gerekli" });
  if (!calendar[username]) calendar[username] = {};
  if (!calendar[username][date]) calendar[username][date] = { active: 0, topics: [], plan: [] };
  const newItem = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2,5),
    topicIdx: planItem.topicIdx || 0,
    type: planItem.type || "tyt",
    topicName: planItem.topicName,
    status: planItem.status || "planned",
    note: planItem.note || "",
    createdBy: "admin",
    studentId: username,
    studentName: (users[username].name || "") + " " + (users[username].surname || "")
  };
  calendar[username][date].plan.push(newItem);
  await db.saveCalendar(calendar);
  res.json({ success: true, planItem: newItem });
});

app.get("/api/calendar/admin/:username", requireAuth, requireAdmin, async (req, res) => {
  const { calendar } = await loadAll();
  res.json(calendar[req.params.username] || {});
});

app.get("/api/calendar/admin-all", requireAuth, requireAdmin, async (req, res) => {
  const { users, calendar } = await loadAll();
  const result = {};
  Object.keys(users).forEach(id => {
    if (id === ADMIN_USERNAME) return;
    const userCal = calendar[id] || {};
    Object.keys(userCal).forEach(date => {
      if (!result[date]) result[date] = [];
      result[date].push({ username: id, name: users[id].name||"", surname: users[id].surname||"", ...userCal[date] });
    });
  });
  res.json(result);
});

app.get("/api/report/:username", requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.params;
  const { users, stars, progress, calendar } = await loadAll();
  const u = users[username];
  if (!u) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  const p = progress[username] || { tyt: [], ayt: [] };
  const s = stars[username] || {};
  const cal = calendar[username] || {};
  const dates = Object.keys(cal).sort();
  const last7 = dates.slice(-7);
  const weekActive = last7.reduce((sum, d) => sum + (cal[d].active || 0), 0);
  const totalDays = dates.length;
  const streak = (() => { let c=0; const t=new Date(); for(let i=0;i<365;i++){ const d=t.toISOString().split("T")[0]; if(cal[d]) c++; else break; t.setDate(t.getDate()-1); } return c; })();
  const tytPct = Math.round(((p.tyt||[]).length/10)*100);
  const aytPct = Math.round(((p.ayt||[]).length/11)*100);
  const genPct = Math.round((((p.tyt||[]).length+(p.ayt||[]).length)/21)*100);
  const weeklyChart = last7.map(d => ({ date: d, active: cal[d]?.active||0, topics: cal[d]?.topics?.length||0 }));
  const weeklyPlan = last7.map(d => ({ date: d, plan: cal[d]?.plan||[] }));
  const missingTyt = TYT_TOPICS.filter((_,i) => !(p.tyt||[]).includes(i));
  const missingAyt = AYT_TOPICS.filter((_,i) => !(p.ayt||[]).includes(i));
  res.json({
    name: u.name||"", surname: u.surname||"", username,
    stars: s.stars||0, online: s.online||false, lastActive: s.lastActive||0,
    tytPct, aytPct, genPct, todayActive: s.todayActive||0,
    tytDone: (p.tyt||[]).length, tytTotal: 10,
    aytDone: (p.ayt||[]).length, aytTotal: 11,
    tytTopics: (p.tyt||[]).map(i => TYT_TOPICS[i]).filter(Boolean),
    aytTopics: (p.ayt||[]).map(i => AYT_TOPICS[i]).filter(Boolean),
    missingTyt, missingAyt, weekActive, totalDays, streak, weeklyChart, weeklyPlan,
  });
});

app.get("/api/progress/all", requireAuth, requireAdmin, async (req, res) => {
  const { users, stars, progress } = await loadAll();
  const list = Object.entries(users).filter(([id]) => id !== ADMIN_USERNAME).map(([id, d]) => {
    const p = progress[id] || { tyt: [], ayt: [] };
    const s = stars[id] || {};
    return {
      username: id, name: d.name || "", surname: d.surname || "",
      stars: s.stars || 0, online: s.online || false,
      tytDone: (p.tyt || []).length, tytTotal: 10,
      aytDone: (p.ayt || []).length, aytTotal: 11,
    };
  });
  res.json({ users: list });
});

app.get("/api/admin/user/detail", requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Kullanıcı adı gerekli" });
  const { users, stars, progress } = await loadAll();
  const u = users[username];
  if (!u) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  const p = progress[username] || { tyt: [], ayt: [] };
  const s = stars[username] || {};
  res.json({
    username, name: u.name || "", surname: u.surname || "",
    stars: s.stars || 0, online: s.online || false,
    lastActive: s.lastActive || 0, todayActive: s.todayActive || 0,
    tytDone: (p.tyt || []).length, tytTotal: 10, tytList: p.tyt || [],
    aytDone: (p.ayt || []).length, aytTotal: 11, aytList: p.ayt || [],
  });
});

app.post("/api/stars/sync", requireAuth, async (req, res) => {
  const { stars } = req.body;
  const d = await db.loadStars();
  if (!d[req.session.userId]) d[req.session.userId] = { stars: 0, online: false };
  d[req.session.userId].stars = Math.max(stars || 0, d[req.session.userId].stars || 0);
  await db.saveStars(d);
  res.json({ success: true });
});

app.post("/api/heartbeat", requireAuth, async (req, res) => {
  const d = await db.loadStars();
  if (!d[req.session.userId]) d[req.session.userId] = { stars: 0, online: false };
  d[req.session.userId].online = true;
  d[req.session.userId].lastActive = Date.now();
  d[req.session.userId].todayActive = (d[req.session.userId].todayActive || 0) + 30;
  await db.saveStars(d);
  const cal = await db.loadCalendar();
  const today = new Date().toISOString().split("T")[0];
  if (!cal[req.session.userId]) cal[req.session.userId] = {};
  if (!cal[req.session.userId][today]) cal[req.session.userId][today] = { active: 0, topics: [], plan: [] };
  cal[req.session.userId][today].active = (cal[req.session.userId][today].active || 0) + 30;
  await db.saveCalendar(cal);
  res.json({ success: true });
});

app.post("/api/stars/online", requireAuth, async (req, res) => {
  const { online } = req.body;
  const d = await db.loadStars();
  if (!d[req.session.userId]) d[req.session.userId] = { stars: 0, online: false };
  d[req.session.userId].online = !!online;
  if (!online) d[req.session.userId].lastActive = 0;
  await db.saveStars(d);
  res.json({ success: true });
});

app.use("/uploads/notes", express.static(UPLOADS_DIR));

app.get("/api/notes", async (req, res) => {
  try {
    const notes = await db.loadNotes(req.query.type, req.query.topic);
    res.json({ notes });
  } catch (err) {
    console.error("Notes list error:", err);
    res.status(500).json({ error: "Notlar yüklenemedi" });
  }
});

app.post("/api/notes/upload", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Dosya gerekli" });
    const { title, description, topic_type, topic_index, note_type } = req.body;
    if (!title || !topic_type || topic_index === undefined || topic_index === null) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Başlık, konu türü ve konu indeksi gerekli" });
    }
    if (!["tyt", "ayt", "deneme"].includes(topic_type)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Geçersiz konu türü (tyt/ayt/deneme)" });
    }
    if (topic_type !== "deneme" && note_type && !["not", "slayt", "infografik"].includes(note_type)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Geçersiz not türü (not/slayt/infografik)" });
    }
    const note = await db.createNote({
      title,
      description: description || "",
      topic_type,
      topic_index: parseInt(topic_index),
      note_type: topic_type !== "deneme" ? (note_type || "not") : "not",
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_size: req.file.size,
      created_by: req.session.userId,
    });
    res.json({ success: true, note });
  } catch (err) {
    console.error("Upload error:", err);
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: "Not yüklenemedi" });
  }
});

app.delete("/api/notes/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const note = await db.deleteNote(req.params.id);
    if (!note) return res.status(404).json({ error: "Not bulunamadı" });
    const filePath = path.join(UPLOADS_DIR, note.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete note error:", err);
    res.status(500).json({ error: "Not silinemedi" });
  }
});

app.get("/", (req, res) => {
  if (req.session.userId) return res.sendFile(path.join(__dirname, "public", "index.html"));
  res.redirect("/login.html");
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: "Dosya yükleme hatası: " + err.message });
  }
  if (err) {
    console.error("Express error:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
  next();
});

async function start() {
  await db.init();
  const users = await db.loadUsers();
  if (!users[ADMIN_USERNAME]) {
    users[ADMIN_USERNAME] = { password: ADMIN_PASSWORD, name: "Admin", surname: "", role: "admin" };
    await db.saveUsers(users);
    console.log("Admin hesabı oluşturuldu.");
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Kimya Not Sitesi çalışıyor: http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error("Başlatma hatası:", err);
  process.exit(1);
});
