﻿﻿﻿﻿﻿const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const db = require("./db");
db.init();
const { loadUsers, saveUsers, loadStars, saveStars, loadProgress, saveProgress, loadCalendar, saveCalendar } = db;

const app = express();
const PORT = 3000;

const NOTLAR_PATH = "C:\\Users\\Uğur\\Desktop\\KİMYA_NOT";


const ADMIN_USERNAME = "Kimya_not";
const ADMIN_PASSWORD = "191435U.g";

const TYT_TOPICS = ["Kimya Bilimi","Atom ve Periyodik Tablo","Kimyasal TÃ¼rlerarasÄ± EtkileÅŸimler","Maddenin Halleri","DoÄŸa ve Kimya","KimyanÄ±n Temel KanunlarÄ±","Kimyasal Hesaplamalar","KarÄ±ÅŸÄ±mlar","Asit Baz Tuz","Kimya Her Yerde"];
const AYT_TOPICS = ["Modern Atom Teorisi","Gazlar","SÄ±vÄ± Ã‡Ã¶zeltiler","Kimyasal Tepkimelerde Entalpi","Kimyasal Tepkimelerde HÄ±z","Kimyasal Tepkimelerde Denge","Asit Baz Dengesi","Ã‡Ã¶zÃ¼nÃ¼rlÃ¼k Dengesi","Elektrokimya","Karbon KimyasÄ±na GiriÅŸ","Organik Kimya"];

const WATCH_FOLDER = "C:\\Users\\Uğur\\Desktop\\PDF Ekle";
if (!fs.existsSync(WATCH_FOLDER)) fs.mkdirSync(WATCH_FOLDER, { recursive: true });
let recentUploads = [];

if (fs.existsSync(NOTLAR_PATH)) {
  try {
    fs.watch(WATCH_FOLDER, { recursive: true }, (eventType, filename) => {
      if (!filename || !filename.toLowerCase().endsWith('.pdf')) return;
      if (eventType !== 'rename') return;
      const src = path.join(WATCH_FOLDER, filename);
      const rel = path.dirname(filename);
      const destDir = rel === '.' ? NOTLAR_PATH : path.join(NOTLAR_PATH, rel);
      const dest = path.join(destDir, path.basename(filename));
      setTimeout(() => {
        try {
          if (fs.existsSync(src)) {
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(src, dest);
            recentUploads.unshift({ name: filename, time: Date.now() });
            if (recentUploads.length > 50) recentUploads.pop();
            console.log(`âœ“ Yeni not eklendi: ${filename}`);
          }
        } catch (e) {}
      }, 1500);
    });
    console.log(`  Ä°zleme: ${WATCH_FOLDER} (alt klasÃ¶rler dahil)`);
  } catch (e) { console.log(`  Ä°zleme hatasÄ±: ${e.message}`); }
}





function ensureAdmin() {
  const users = loadUsers();
  if (!users[ADMIN_USERNAME]) {
    users[ADMIN_USERNAME] = { password: ADMIN_PASSWORD, name: "Admin", surname: "", role: "admin" };
    saveUsers(users);
    console.log("Admin hesabÄ± oluÅŸturuldu.");
  }
}
ensureAdmin();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: "kimya-not-sitesi-gizli-anahtar-2026",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  if (req.path.startsWith("/api/") || req.path.startsWith("/files/")) return res.status(401).json({ error: "GiriÅŸ yapmalÄ±sÄ±nÄ±z" });
  res.redirect("/login.html");
}
function requireAdmin(req, res, next) {
  const users = loadUsers();
  if (users[req.session.userId]?.role === "admin") return next();
  res.status(403).json({ error: "Yetkiniz yok" });
}

app.get("/api/me", (req, res) => {
  if (req.session.userId) {
    const users = loadUsers();
    const u = users[req.session.userId];
    res.json({ user: req.session.userId, name: u?.name || req.session.userId, surname: u?.surname || "", role: u?.role || "user" });
  } else {
    res.json({ user: null });
  }
});

app.post("/api/kayit", (req, res) => {
  const { username, password, name, surname } = req.body;
  if (!username || !password || username.length < 3 || password.length < 3) return res.status(400).json({ error: "KullanÄ±cÄ± adÄ± ve ÅŸifre en az 3 karakter olmalÄ±" });
  if (!name || !surname) return res.status(400).json({ error: "Ad ve soyad zorunludur" });
  const users = loadUsers();
  if (users[username]) return res.status(400).json({ error: "Bu kullanÄ±cÄ± adÄ± zaten alÄ±nmÄ±ÅŸ" });
  users[username] = { password, name, surname, role: "user" };
  saveUsers(users);
  req.session.userId = username;
  res.json({ success: true, user: username, name, surname });
});

app.post("/api/giris", (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  if (!users[username] || users[username].password !== password) return res.status(401).json({ error: "KullanÄ±cÄ± adÄ± veya ÅŸifre hatalÄ±" });
  req.session.userId = username;
  res.json({ success: true, user: username });
});

app.post("/api/cikis", (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const users = loadUsers();
  const stars = loadStars();
  const progress = loadProgress();
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

app.post("/api/admin/users/add", requireAuth, requireAdmin, (req, res) => {
  const { username, password, name, surname } = req.body;
  if (!username || !password || username.length < 3) return res.status(400).json({ error: "GeÃ§ersiz bilgiler" });
  const users = loadUsers();
  if (users[username]) return res.status(400).json({ error: "Bu kullanÄ±cÄ± adÄ± zaten var" });
  users[username] = { password, name: name || "", surname: surname || "", role: "user" };
  saveUsers(users);
  res.json({ success: true });
});

app.post("/api/admin/users/delete", requireAuth, requireAdmin, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "KullanÄ±cÄ± adÄ± gerekli" });
  const users = loadUsers();
  if (!users[username]) return res.status(404).json({ error: "KullanÄ±cÄ± bulunamadÄ±" });
  if (username === ADMIN_USERNAME) return res.status(403).json({ error: "Admin silinemez" });
  delete users[username];
  saveUsers(users);
  const stars = loadStars();
  delete stars[username];
  saveStars(stars);
  const prog = loadProgress();
  delete prog[username];
  saveProgress(prog);
  res.json({ success: true });
});

app.post("/api/admin/users/reset-password", requireAuth, requireAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 3) return res.status(400).json({ error: "GeÃ§ersiz ÅŸifre" });
  const users = loadUsers();
  if (!users[username]) return res.status(404).json({ error: "KullanÄ±cÄ± bulunamadÄ±" });
  users[username].password = password;
  saveUsers(users);
  res.json({ success: true });
});

app.get("/api/leaderboard", requireAuth, (req, res) => {
  const users = loadUsers();
  const stars = loadStars();
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



app.get("/api/progress", requireAuth, (req, res) => {
  const p = loadProgress();
  res.json(p[req.session.userId] || { tyt: [], ayt: [] });
});

app.post("/api/progress", requireAuth, (req, res) => {
  const { tyt, ayt } = req.body;
  const p = loadProgress();
  p[req.session.userId] = { tyt: tyt || [], ayt: ayt || [] };
  saveProgress(p);
  res.json({ success: true });
});

app.get("/api/calendar", requireAuth, (req, res) => {
  const cal = loadCalendar();
  res.json(cal[req.session.userId] || {});
});

app.post("/api/calendar/log", requireAuth, (req, res) => {
  const { topicIdx, type } = req.body;
  const cal = loadCalendar();
  const today = new Date().toISOString().split("T")[0];
  if (!cal[req.session.userId]) cal[req.session.userId] = {};
  if (!cal[req.session.userId][today]) cal[req.session.userId][today] = { active: 0, topics: [], plan: [] };
  const day = cal[req.session.userId][today];
  const idx = day.topics.indexOf(topicIdx);
  if (type === "add" && idx === -1) day.topics.push(topicIdx);
  if (type === "remove" && idx !== -1) day.topics.splice(idx, 1);
  if (!day.topics.length && !day.active && !day.plan?.length) delete cal[req.session.userId][today];
  saveCalendar(cal);
  res.json({ success: true });
});

app.post("/api/calendar/plan", requireAuth, (req, res) => {
  const { date, plan } = req.body;
  if (!date) return res.status(400).json({ error: "Tarih gerekli" });
  const cal = loadCalendar();
  if (!cal[req.session.userId]) cal[req.session.userId] = {};
  if (!cal[req.session.userId][date]) cal[req.session.userId][date] = { active: 0, topics: [], plan: [] };
  cal[req.session.userId][date].plan = (plan || []).map(p => ({
    ...p,
    createdBy: p.createdBy || "student",
    id: p.id || Date.now().toString(36) + Math.random().toString(36).substr(2,5)
  }));
  if (!cal[req.session.userId][date].plan.length && !cal[req.session.userId][date].topics.length && !cal[req.session.userId][date].active) {
    delete cal[req.session.userId][date];
  }
  saveCalendar(cal);
  res.json({ success: true });
});

app.post("/api/calendar/plan/admin", requireAuth, requireAdmin, (req, res) => {
  const { username, date, planItem } = req.body;
  if (!username || !date || !planItem) return res.status(400).json({ error: "Eksik bilgi" });
  const users = loadUsers();
  if (!users[username]) return res.status(404).json({ error: "KullanÄ±cÄ± bulunamadÄ±" });
  if (!planItem.topicName) return res.status(400).json({ error: "Konu adÄ± gerekli" });
  const cal = loadCalendar();
  if (!cal[username]) cal[username] = {};
  if (!cal[username][date]) cal[username][date] = { active: 0, topics: [], plan: [] };
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
  cal[username][date].plan.push(newItem);
  saveCalendar(cal);
  res.json({ success: true, planItem: newItem });
});

app.get("/api/calendar/admin/:username", requireAuth, requireAdmin, (req, res) => {
  const cal = loadCalendar();
  res.json(cal[req.params.username] || {});
});

app.get("/api/calendar/admin-all", requireAuth, requireAdmin, (req, res) => {
  const users = loadUsers();
  const cal = loadCalendar();
  const result = {};
  Object.keys(users).forEach(id => {
    if (id === ADMIN_USERNAME) return;
    const userCal = cal[id] || {};
    Object.keys(userCal).forEach(date => {
      if (!result[date]) result[date] = [];
      result[date].push({ username: id, name: users[id].name||"", surname: users[id].surname||"", ...userCal[date] });
    });
  });
  res.json(result);
});

app.get("/api/report/:username", requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const users = loadUsers();
  const stars = loadStars();
  const progress = loadProgress();
  const calendar = loadCalendar();
  const u = users[username];
  if (!u) return res.status(404).json({ error: "KullanÄ±cÄ± bulunamadÄ±" });
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

app.get("/api/progress/all", requireAuth, requireAdmin, (req, res) => {
  const users = loadUsers();
  const stars = loadStars();
  const progress = loadProgress();
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

app.get("/api/admin/user/detail", requireAuth, requireAdmin, (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "KullanÄ±cÄ± adÄ± gerekli" });
  const users = loadUsers();
  const stars = loadStars();
  const progress = loadProgress();
  const u = users[username];
  if (!u) return res.status(404).json({ error: "KullanÄ±cÄ± bulunamadÄ±" });
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

app.post("/api/stars/sync", requireAuth, (req, res) => {
  const { stars } = req.body;
  const d = loadStars();
  if (!d[req.session.userId]) d[req.session.userId] = { stars: 0, online: false };
  d[req.session.userId].stars = Math.max(stars || 0, d[req.session.userId].stars || 0);
  saveStars(d);
  res.json({ success: true });
});

app.post("/api/heartbeat", requireAuth, (req, res) => {
  const d = loadStars();
  if (!d[req.session.userId]) d[req.session.userId] = { stars: 0, online: false };
  d[req.session.userId].online = true;
  d[req.session.userId].lastActive = Date.now();
  d[req.session.userId].todayActive = (d[req.session.userId].todayActive || 0) + 30;
  saveStars(d);
  const cal = loadCalendar();
  const today = new Date().toISOString().split("T")[0];
  if (!cal[req.session.userId]) cal[req.session.userId] = {};
  if (!cal[req.session.userId][today]) cal[req.session.userId][today] = { active: 0, topics: [], plan: [] };
  cal[req.session.userId][today].active = (cal[req.session.userId][today].active || 0) + 30;
  saveCalendar(cal);
  res.json({ success: true });
});

app.post("/api/stars/online", requireAuth, (req, res) => {
  const { online } = req.body;
  const d = loadStars();
  if (!d[req.session.userId]) d[req.session.userId] = { stars: 0, online: false };
  d[req.session.userId].online = !!online;
  if (!online) d[req.session.userId].lastActive = 0;
  saveStars(d);
  res.json({ success: true });
});

app.post("/api/search", requireAuth, (req, res) => {
  const { q } = req.body;
  if (!q || q.length < 2) return res.json([]);
  const results = [];
  function walk(dir, prefix) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const full = path.join(dir, e.name);
        const rel = prefix ? path.join(prefix, e.name) : e.name;
        if (e.name.toLowerCase().includes(q.toLowerCase())) {
          results.push({ name: e.name, path: rel, isDirectory: e.isDirectory() });
        }
        if (e.isDirectory() && results.length < 30) walk(full, rel);
      }
    } catch {}
  }
  walk(NOTLAR_PATH, "");
  res.json(results.slice(0, 30));
});

app.get("/api/recent-uploads", requireAuth, (req, res) => {
  res.json(recentUploads);
});

app.get("/view/*", requireAuth, (req, res) => {
  const fp = path.join(NOTLAR_PATH, req.params[0]);
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return res.status(404).send("Dosya bulunamadÄ±");
  const ext = path.extname(fp).toLowerCase();
  if (ext === ".pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const stream = fs.createReadStream(fp);
    stream.pipe(res);
  } else if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".mp4") {
    res.sendFile(fp);
  } else {
    res.status(403).send("Bu dosya tÃ¼rÃ¼ gÃ¶rÃ¼ntÃ¼lenemez");
  }
});

app.get("/api/files", requireAuth, (req, res) => {
  const dirPath = req.query.path ? path.join(NOTLAR_PATH, req.query.path) : NOTLAR_PATH;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = entries.filter((e) => !e.name.startsWith(".")).map((e) => {
      const full = path.join(dirPath, e.name);
      const rel = req.query.path ? path.join(req.query.path, e.name) : e.name;
      const s = fs.statSync(full);
      return { name: e.name, path: rel, isDirectory: e.isDirectory(), size: e.isFile() ? s.size : null, mtime: s.mtime };
    }).sort((a, b) => { if (a.isDirectory && !b.isDirectory) return -1; if (!a.isDirectory && b.isDirectory) return 1; return a.name.localeCompare(b.name, "tr"); });
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/", (req, res) => {
  if (req.session.userId) return res.sendFile(path.join(__dirname, "public", "index.html"));
  res.redirect("/login.html");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kimya Not Sitesi Ã§alÄ±ÅŸÄ±yor:`);
  console.log(`  Yerel: http://localhost:${PORT}`);
  const ip = getLocalIP();
  if (ip) console.log(`  AÄŸ:    http://${ip}:${PORT}`);
  console.log(`  Notlar: ${NOTLAR_PATH}`);
});

function getLocalIP() {
  const os = require("os");
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) for (const iface of ifaces[name]) if (iface.family === "IPv4" && !iface.internal) return iface.address;
  return null;
}

