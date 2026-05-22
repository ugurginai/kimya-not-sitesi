const TYT_TOPICS = ["Kimya Bilimi","Atom ve Periyodik Tablo","Kimyasal Türlerarası Etkileşimler","Maddenin Halleri","Doğa ve Kimya","Kimyanın Temel Kanunları","Kimyasal Hesaplamalar","Karışımlar","Asit Baz Tuz","Kimya Her Yerde"];
const AYT_TOPICS = ["Modern Atom Teorisi","Gazlar","Sıvı Çözeltiler","Kimyasal Tepkimelerde Entalpi","Kimyasal Tepkimelerde Hız","Kimyasal Tepkimelerde Denge","Asit Baz Dengesi","Çözünürlük Dengesi","Elektrokimya","Karbon Kimyasına Giriş","Organik Kimya"];

let currentPath = "";
const fileList = document.getElementById("fileList");
const breadcrumb = document.getElementById("breadcrumb");
const userDisplay = document.getElementById("userDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const adminBtn = document.getElementById("adminBtn");
const adminModal = document.getElementById("adminModal");
const adminContent = document.getElementById("adminContent");
const closeAdmin = document.getElementById("closeAdmin");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const starToast = document.getElementById("starToast");
const lbContent = document.getElementById("lbContent");
const countdownSection = document.getElementById("countdownSection");
const topicSection = document.getElementById("topicSection");

let currentUser = null;
let searchTimer = null;
let starTimer = null;
let starCount = 0;
let tabActive = true;
let lbRefreshTimer = null;
let heartbeatTimer = null;
let progressData = { tyt: [], ayt: [] };
let progressLoadResolve = null;

const YKS_DATE = new Date("2026-06-20T10:15:00").getTime();
function startCountdown() {
  function tick() {
    const now = Date.now();
    let diff = YKS_DATE - now;
    if (diff < 0) diff = 0;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById("cdDays").textContent = String(d).padStart(2,"0");
    document.getElementById("cdHours").textContent = String(h).padStart(2,"0");
    document.getElementById("cdMins").textContent = String(m).padStart(2,"0");
    document.getElementById("cdSecs").textContent = String(s).padStart(2,"0");
    const card = document.querySelector(".countdown-card");
    if (d < 30 && card) card.classList.add("countdown-red");
  }
  tick();
  setInterval(tick, 1000);
}

function toggleAccordion(btn) {
  const sec = btn.closest(".ta-section");
  sec.classList.toggle("open");
}

fetch("/api/me").then(r => r.json()).then(data => {
  if (!data.user) { window.location.href = "/login.html"; return; }
  currentUser = data;
  if (userDisplay) userDisplay.textContent = data.name + " " + data.surname;
  if (data.role === "admin" && adminBtn) adminBtn.style.display = "inline-block";
  startCountdown();
  initOnlineSystem();
  initStarSystem();
  loadRecentUploads();
  loadCalendar();
  loadLeaderboard();
  if (data.role === "admin") {
    loadProgressLeaderboard();
    setInterval(loadProgressLeaderboard, 30000);
  } else {
    const plb = document.getElementById("progressLBSection");
    if (plb) plb.style.display = "none";
  }
  lbRefreshTimer = setInterval(loadLeaderboard, 15000);
  initTopicSystem();
}).catch(() => { window.location.href = "/login.html"; });

if (logoutBtn) logoutBtn.addEventListener("click", async () => { await fetch("/api/cikis", { method: "POST" }); window.location.href = "/login.html"; });
if (adminBtn) adminBtn.addEventListener("click", () => { adminModal.style.display = "flex"; loadAdminPanel(); });
if (closeAdmin) closeAdmin.addEventListener("click", () => adminModal.style.display = "none");
adminModal.addEventListener("click", (e) => { if (e.target === adminModal) adminModal.style.display = "none"; });

// Student detail modal
const studentModal = document.createElement("div");
studentModal.id = "studentModal";
studentModal.style.cssText = "display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);z-index:1100;align-items:center;justify-content:center";
studentModal.innerHTML = `<div style="background:white;border-radius:20px;padding:28px;max-width:500px;width:90%;max-height:85vh;overflow:auto;margin:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15)">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h2 style="font-size:1.15rem;font-weight:600;color:#1d1d1f">Öğrenci Analizi</h2>
    <button id="closeStudent" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#c0c0c5">&times;</button>
  </div>
  <div id="studentDetailContent" style="color:#1d1d1f">Yükleniyor...</div>
</div>`;
document.body.appendChild(studentModal);
document.getElementById("closeStudent").addEventListener("click", () => studentModal.style.display = "none");
studentModal.addEventListener("click", (e) => { if (e.target === studentModal) studentModal.style.display = "none"; });

async function loadAdminPanel(tab) {
  adminContent.innerHTML = "Yükleniyor...";
  try {
    if (tab === "takvim") { loadAdminCalendar(); return; }
    if (tab === "notlar") { loadAdminNotes(); return; }
    const res = await fetch("/api/admin/users"); const data = await res.json();
    if (data.error) { adminContent.innerHTML = `<div style="color:#d32f2f;text-align:center;padding:20px">${data.error}</div>`; return; }
    let html = `<div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="admin-tab active" data-tab="ogrenciler" style="flex:1;padding:8px;border:none;border-radius:10px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;background:#0056cc;color:white">👥 Öğrenciler</button>
      <button class="admin-tab" data-tab="takvim" style="flex:1;padding:8px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.82rem;font-weight:500;cursor:pointer;font-family:inherit;background:white;color:#555">📅 Takvim</button>
      <button class="admin-tab" data-tab="notlar" style="flex:1;padding:8px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.82rem;font-weight:500;cursor:pointer;font-family:inherit;background:white;color:#555">📄 Notlar</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <div style="font-size:0.85rem;font-weight:600;color:#0056cc">Toplam üye: ${data.total}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="adminSearch" type="text" placeholder="Öğrenci ara..." style="padding:7px 12px;border:1px solid #e0e0e5;border-radius:8px;font-size:0.78rem;font-family:inherit;width:150px">
        <button id="adminAddBtn" style="padding:7px 14px;background:#0056cc;color:white;border:none;border-radius:8px;font-size:0.78rem;font-weight:500;cursor:pointer;font-family:inherit">+ Öğrenci Ekle</button>
      </div>
    </div>`;
    if (!data.users.length) {
      html += '<div style="text-align:center;color:#8e8e93;padding:30px;font-size:0.85rem">Henüz öğrenci yok</div>';
    } else {
      html += '<div style="overflow-x:auto;border-radius:12px;border:1px solid #e8e8ed">';
      html += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;min-width:700px"><thead><tr style="background:#f5f6f8">';
      html += '<th style="padding:10px 12px;text-align:left;color:#555;font-weight:500">Ad Soyad</th>';
      html += '<th style="padding:10px 12px;text-align:left;color:#555;font-weight:500">Kullanıcı</th>';
      html += '<th style="padding:10px 12px;text-align:center;color:#555;font-weight:500">⭐</th>';
      html += '<th style="padding:10px 12px;text-align:center;color:#555;font-weight:500">Durum</th>';
      html += '<th style="padding:10px 12px;text-align:center;color:#555;font-weight:500">TYT</th>';
      html += '<th style="padding:10px 12px;text-align:center;color:#555;font-weight:500">AYT</th>';
      html += '<th style="padding:10px 12px;text-align:right;color:#555;font-weight:500">İşlem</th>';
      html += '</tr></thead><tbody id="adminTableBody">';
      data.users.forEach((u, i) => { html += renderAdminRow(u, i); });
      html += '</tbody></table></div>';
    }
    adminContent.innerHTML = html;
    document.querySelectorAll(".admin-tab").forEach(btn => btn.addEventListener("click", function() {
      document.querySelectorAll(".admin-tab").forEach(b => { b.style.background="white"; b.style.color="#555"; b.style.border="1px solid #e0e0e5"; b.style.fontWeight="500"; });
      this.style.background="#0056cc"; this.style.color="white"; this.style.border="none"; this.style.fontWeight="600";
      loadAdminPanel(this.dataset.tab);
    }));
    document.getElementById("adminSearch")?.addEventListener("input", function() {
      const q = this.value.toLowerCase();
      document.querySelectorAll("#adminTableBody tr").forEach(tr => { tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none"; });
    });
    document.getElementById("adminAddBtn")?.addEventListener("click", showAddStudentForm);
    document.querySelectorAll(".admin-delete").forEach(btn => btn.addEventListener("click", function() {
      const u = this.dataset.user;
      if (confirm(`"${this.dataset.name}" adlı öğrenciyi silmek istediğinize emin misiniz?`)) {
        fetch("/api/admin/users/delete", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:u}) })
          .then(r=>r.json()).then(d => { if(d.success) loadAdminPanel(); else alert(d.error); });
      }
    }));
    document.querySelectorAll(".admin-detail-btn").forEach(btn => btn.addEventListener("click", function() { showStudentDetailModal(this.dataset.user); }));
    document.querySelectorAll(".admin-report-btn").forEach(btn => btn.addEventListener("click", function() { generateReport(this.dataset.user); }));
    document.querySelectorAll(".admin-reset").forEach(btn => btn.addEventListener("click", function() {
      const pwd = prompt("Yeni şifreyi girin (en az 3 karakter):");
      if (pwd && pwd.length >= 3) {
        fetch("/api/admin/users/reset-password", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:this.dataset.user, password:pwd}) })
          .then(r=>r.json()).then(d => { if(d.success) alert("Şifre güncellendi!"); else alert(d.error); });
      }
    }));
    document.querySelectorAll("#adminTableBody tr td:first-child").forEach(td => {
      td.style.cursor = "pointer"; td.title = "Detay görmek için tıkla";
      td.addEventListener("click", function() {
        const tr = this.closest("tr");
        const username = tr.querySelector(".admin-detail-btn")?.dataset?.user;
        if (username) showStudentDetailModal(username);
      });
    });
  } catch (err) { adminContent.innerHTML = `<div style="color:#d32f2f;text-align:center;padding:20px">Hata: ${err.message}</div>`; }
}

function loadAdminCalendar() {
  const html = `<div style="display:flex;gap:8px;margin-bottom:16px">
    <button class="admin-tab" data-tab="ogrenciler" style="flex:1;padding:8px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.82rem;font-weight:500;cursor:pointer;font-family:inherit;background:white;color:#555">👥 Öğrenciler</button>
    <button class="admin-tab active" data-tab="takvim" style="flex:1;padding:8px;border:none;border-radius:10px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;background:#0056cc;color:white">📅 Takvim</button>
    <button class="admin-tab" data-tab="notlar" style="flex:1;padding:8px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.82rem;font-weight:500;cursor:pointer;font-family:inherit;background:white;color:#555">📄 Notlar</button>
  </div>
  <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
    <input id="adminCalSearch" type="text" placeholder="Öğrenci ara..." style="padding:7px 12px;border:1px solid #e0e0e5;border-radius:8px;font-size:0.78rem;font-family:inherit;flex:1;min-width:120px">
    <select id="adminCalFilter" style="padding:7px 12px;border:1px solid #e0e0e5;border-radius:8px;font-size:0.78rem;font-family:inherit;background:white">
      <option value="all">Tüm Konular</option>
      <option value="tyt">🧪 TYT</option>
      <option value="ayt">⚗️ AYT</option>
    </select>
  </div>
  <div id="adminCalContent"><div class="loading" style="padding:20px;font-size:0.82rem">Yükleniyor...</div></div>`;
  adminContent.innerHTML = html;
  
  document.querySelectorAll(".admin-tab").forEach(btn => btn.addEventListener("click", function() {
    document.querySelectorAll(".admin-tab").forEach(b => { b.style.background="white"; b.style.color="#555"; b.style.border="1px solid #e0e0e5"; b.style.fontWeight="500"; });
    this.style.background="#0056cc"; this.style.color="white"; this.style.border="none"; this.style.fontWeight="600";
    loadAdminPanel(this.dataset.tab);
  }));
  
  fetch("/api/calendar/admin-all").then(r=>r.json()).then(allData => {
    const container = document.getElementById("adminCalContent");
    if (!container) return;
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
    const filterEl = document.getElementById("adminCalFilter");
    const searchEl = document.getElementById("adminCalSearch");

    function renderCal() {
      const filter = filterEl?.value || "all";
      const search = (searchEl?.value || "").toLowerCase();
      const first = new Date(y,m,1).getDay();
      const daysInMonth = new Date(y,m+1,0).getDate();
      const days = ["Pzt","Sal","Çar","Per","Cu","Cmt","Paz"];
      let h = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:16px">';
      h += '<div></div>'+days.map(d=>'<div style="font-size:0.65rem;font-weight:600;color:#8e8e93;text-align:center;padding:4px 0">'+d+'</div>').join("");
      const adjust = first === 0 ? 6 : first - 1;
      for (let i=0;i<adjust;i++) h += '<div></div>';

      // Build list of all entries for detail view
      let allEntries = [];

      for (let d=1;d<=daysInMonth;d++) {
        const dateStr = y + "-" + String(m+1).padStart(2,"0") + "-" + String(d).padStart(2,"0");
        const entries = allData[dateStr] || [];
        let filtered = entries;
        if (filter === "tyt") filtered = entries.filter(e => (e.plan||[]).some(p => p.type === "tyt"));
        else if (filter === "ayt") filtered = entries.filter(e => (e.plan||[]).some(p => p.type === "ayt"));
        if (search) filtered = filtered.filter(e => (e.name+" "+e.surname).toLowerCase().includes(search));
        const todayStr = now.toISOString().split("T")[0];
        const cls = dateStr === todayStr ? "admin-cal-day today" : "admin-cal-day";
        h += '<div class="' + cls + '"><div style="font-size:0.65rem;font-weight:600;color:#666;margin-bottom:2px">' + d + '</div>';
        filtered.slice(0,2).forEach(function(e) {
          const planTopics = (e.plan||[]).filter(function(p) { return filter==="all" || p.type===filter; });
          const firstTopic = planTopics[0];
          const topicName = firstTopic ? (firstTopic.topicName || (firstTopic.type==="tyt"?TYT_TOPICS[firstTopic.topicIdx]:AYT_TOPICS[firstTopic.topicIdx])) : "";
          const shortName = (e.name||"").split(" ")[0] || e.username;
          const st = firstTopic ? (firstTopic.status==="completed"?"✅":firstTopic.status==="working"?"🟨":"🟦") : "📋";
          const creatorIcon = firstTopic?.createdBy === "admin" ? "👑" : "";
          h += '<div class="admin-cal-item" title="Öğrenci: ' + esc(e.name+" "+e.surname) + '\\nKonu: ' + esc(topicName) + '\\nTarih: ' + dateStr + '\\nDurum: ' + (firstTopic?firstTopic.status:"") + '\\nEkleyen: ' + (firstTopic?.createdBy || "öğrenci") + '">' +
            st + ' ' + creatorIcon + esc(shortName) + ': ' + esc(topicName.substring(0,12)) +
          '</div>';
        });
        if (filtered.length > 2) h += '<div style="font-size:0.5rem;color:#8e8e93;text-align:center">+' + (filtered.length-2) + ' kişi</div>';
        h += '</div>';

        // Collect for list view
        filtered.forEach(function(e) {
          (e.plan||[]).forEach(function(p) {
            if (filter==="all" || p.type===filter) {
              const topicName = p.topicName || (p.type==="tyt"?TYT_TOPICS[p.topicIdx]:AYT_TOPICS[p.topicIdx]);
              allEntries.push({ student: e.name+" "+e.surname, topic: topicName, date: dateStr, status: p.status, type: p.type, createdBy: p.createdBy || "student" });
            }
          });
        });
      }
      h += '</div>';

      // Detail list view
      h += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="adminCalToggleList" style="padding:6px 14px;background:#f5f8ff;border:1px solid #d0e4ff;border-radius:8px;font-size:0.78rem;font-weight:500;color:#0056cc;cursor:pointer;font-family:inherit">📋 Tüm Kayıtları Göster (' + allEntries.length + ')</button>' +
        '<button id="adminCalAddPlanBtn" style="padding:6px 14px;background:#e8f5e9;border:1px solid #c8e6c9;border-radius:8px;font-size:0.78rem;font-weight:500;color:#2e7d32;cursor:pointer;font-family:inherit">➕ Plan Ekle</button></div>';
      h += '<div id="adminCalDetailList" style="display:none;margin-top:10px"></div>';
      h += '<div id="adminCalAddPlanForm" style="display:none;margin-top:12px;padding:16px;background:#fafbfc;border-radius:14px;border:1px solid #e8e8ed"></div>';

      container.innerHTML = h;

      const listContainer = document.getElementById("adminCalDetailList");
      if (listContainer) {
        allEntries.sort(function(a,b) { return a.date.localeCompare(b.date); });
        listContainer.innerHTML = allEntries.map(function(e) {
          const st = e.status==="completed"?"✅":e.status==="working"?"🟨":"🟦";
          const creatorIcon = e.createdBy === "admin" ? "👑" : "👤";
          const creatorLabel = e.createdBy === "admin" ? "Admin" : "Öğrenci";
          const formattedDate = new Date(e.date).toLocaleDateString("tr-TR", {day:"numeric",month:"short",year:"numeric"});
          return '<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#fafbfc;border-radius:10px;border:1px solid #e8e8ed;margin-bottom:6px;flex-wrap:wrap">' +
            '<span style="font-size:0.78rem;font-weight:500;min-width:80px">' + creatorIcon + ' ' + esc(e.student) + '</span>' +
            '<span style="font-size:0.78rem;color:#0056cc;flex:1;min-width:120px">' + st + ' ' + (e.type==="tyt"?"🧪":"⚗️") + ' ' + esc(e.topic) + '</span>' +
            '<span style="font-size:0.65rem;color:#8e8e93">' + formattedDate + '</span>' +
            '<span style="font-size:0.6rem;color:#b0b0b5;background:#f0f0f5;padding:2px 6px;border-radius:6px">' + creatorLabel + '</span>' +
          '</div>';
        }).join("") || '<div style="text-align:center;color:#b0b0b5;padding:20px;font-size:0.82rem">Kayıt bulunamadı</div>';
      }

      document.getElementById("adminCalToggleList")?.addEventListener("click", function() {
        const list = document.getElementById("adminCalDetailList");
        if (list) {
          list.style.display = list.style.display === "none" ? "block" : "none";
          this.textContent = list.style.display === "none" ? "📋 Tüm Kayıtları Göster (" + allEntries.length + ")" : "📋 Gizle";
        }
      });

      document.getElementById("adminCalAddPlanBtn")?.addEventListener("click", function() {
        const form = document.getElementById("adminCalAddPlanForm");
        if (!form) return;
        const shown = form.style.display !== "none";
        form.style.display = shown ? "none" : "block";
        this.textContent = shown ? "➕ Plan Ekle" : "✖ Kapat";
        if (!shown) {
          fetch("/api/admin/users").then(r=>r.json()).then(data => {
            const studentList = (data.users||[]).filter(u => u.username !== "Kimya_not");
            form.innerHTML =
              '<div style="margin-bottom:10px;font-size:0.82rem;font-weight:600;color:#1d1d1f">Öğrenciye Plan Ekle</div>' +
              '<div style="display:flex;flex-direction:column;gap:8px">' +
                '<select id="adminPlanStudent" style="padding:8px 10px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.8rem;font-family:inherit;background:white">' +
                  '<option value="">Öğrenci seçin...</option>' +
                  studentList.map(u => '<option value="' + u.username + '">' + u.name + ' ' + u.surname + '</option>').join("") +
                '</select>' +
                '<input id="adminPlanDate" type="date" value="' + new Date().toISOString().split("T")[0] + '" style="padding:8px 10px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.8rem;font-family:inherit;background:white">' +
                '<div style="display:flex;gap:6px">' +
                  '<select id="adminPlanType" style="flex:1;padding:8px 10px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.8rem;font-family:inherit;background:white"><option value="tyt">🧪 TYT</option><option value="ayt">⚗️ AYT</option></select>' +
                  '<select id="adminPlanTopic" style="flex:2;padding:8px 10px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.8rem;font-family:inherit;background:white"></select>' +
                '</div>' +
                '<button id="adminPlanSubmit" style="padding:10px;background:#2e7d32;color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit">Planı Kaydet</button>' +
              '</div>';
            const typeSel = document.getElementById("adminPlanType");
            const topicSel = document.getElementById("adminPlanTopic");
            function upd() {
              const list2 = typeSel.value === "tyt" ? TYT_TOPICS : AYT_TOPICS;
              topicSel.innerHTML = list2.map(function(t,i) { return '<option value="' + i + '">' + t + '</option>'; }).join("");
              const st = typeSel.value === "tyt" ? "🧪 " : "⚗️ ";
              document.getElementById("adminPlanSubmit").textContent = st + "Planı Kaydet";
            }
            typeSel.addEventListener("change", upd);
            upd();
            document.getElementById("adminPlanSubmit").addEventListener("click", function() {
              const username = document.getElementById("adminPlanStudent").value;
              const date = document.getElementById("adminPlanDate").value;
              const type = document.getElementById("adminPlanType").value;
              const topicIdx = parseInt(document.getElementById("adminPlanTopic").value);
              const topicName = document.getElementById("adminPlanTopic").options[document.getElementById("adminPlanTopic").selectedIndex]?.text;
              if (!username || !topicName) { alert("Öğrenci ve konu seçin"); return; }
              fetch("/api/calendar/plan/admin", {
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({ username, date, planItem: { topicIdx, type, topicName, status: "planned" } })
              }).then(r=>r.json()).then(function(res) {
                if (res.success) {
                  document.getElementById("adminPlanStudent").value = "";
                  renderCal();
                  const btn = document.getElementById("adminCalAddPlanBtn");
                  if (btn) btn.textContent = "➕ Plan Ekle";
                } else {
                  alert("Hata: " + (res.error || "Kaydedilemedi"));
                }
              }).catch(function() { alert("Sunucu hatası"); });
            });
          }).catch(function() { form.innerHTML = '<div style="color:#d32f2f;font-size:0.8rem">Kullanıcı listesi alınamadı</div>'; });
        }
      });
    }
    renderCal();
    filterEl?.addEventListener("change", renderCal);
    searchEl?.addEventListener("input", renderCal);
  }).catch(() => { const c = document.getElementById("adminCalContent"); if(c) c.innerHTML = '<div style="text-align:center;color:#8e8e93;padding:20px;font-size:0.82rem">Veri alınamadı</div>'; });
}

function loadAdminNotes() {
  adminContent.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:16px">
    <button class="admin-tab" data-tab="ogrenciler" style="flex:1;padding:8px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.82rem;font-weight:500;cursor:pointer;font-family:inherit;background:white;color:#555">👥 Öğrenciler</button>
    <button class="admin-tab" data-tab="takvim" style="flex:1;padding:8px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.82rem;font-weight:500;cursor:pointer;font-family:inherit;background:white;color:#555">📅 Takvim</button>
    <button class="admin-tab active" data-tab="notlar" style="flex:1;padding:8px;border:none;border-radius:10px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;background:#0056cc;color:white">📄 Notlar</button>
  </div>
  <div id="adminNotesContent"><div class="loading" style="padding:20px;font-size:0.82rem">Yükleniyor...</div></div>`;

  document.querySelectorAll(".admin-tab").forEach(btn => btn.addEventListener("click", function() {
    document.querySelectorAll(".admin-tab").forEach(b => { b.style.background="white"; b.style.color="#555"; b.style.border="1px solid #e0e0e5"; b.style.fontWeight="500"; });
    this.style.background="#0056cc"; this.style.color="white"; this.style.border="none"; this.style.fontWeight="600";
    loadAdminPanel(this.dataset.tab);
  }));

  renderAdminNotes();
}

async function renderAdminNotes() {
  const container = document.getElementById("adminNotesContent");
  if (!container) return;

  try {
    const res = await fetch("/api/notes");
    const data = await res.json();
    let html = '<div style="margin-bottom:16px">' +
      '<button id="adminAddNoteBtn" style="padding:10px 20px;background:#2e7d32;color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit">📤 Yeni Not Ekle</button>' +
      '</div>';

    if (!data.notes || !data.notes.length) {
      html += '<div style="text-align:center;color:#8e8e93;padding:30px;font-size:0.85rem">Henüz not eklenmemiş</div>';
    } else {
      html += '<div style="overflow-x:auto;border-radius:12px;border:1px solid #e8e8ed">';
      html += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;min-width:500px"><thead><tr style="background:#f5f6f8">';
      html += '<th style="padding:10px 12px;text-align:left;color:#555;font-weight:500">Başlık</th>';
      html += '<th style="padding:10px 12px;text-align:left;color:#555;font-weight:500">Konu</th>';
      html += '<th style="padding:10px 12px;text-align:center;color:#555;font-weight:500">Dosya</th>';
      html += '<th style="padding:10px 12px;text-align:right;color:#555;font-weight:500">İşlem</th>';
      html += '</tr></thead><tbody>';
      data.notes.forEach(n => {
        let topicName, typeIcon;
        if (n.topic_type === "deneme") {
          typeIcon = "📋";
          topicName = n.topic_index == 0 ? "TYT Deneme" : "AYT Deneme";
        } else {
          topicName = n.topic_type === "tyt" ? TYT_TOPICS[n.topic_index] : AYT_TOPICS[n.topic_index];
          typeIcon = n.topic_type === "tyt" ? "🧪" : "⚗️";
        }
        const fileUrl = "/uploads/notes/" + encodeURIComponent(n.filename);
        html += '<tr>' +
          '<td style="padding:10px 12px;font-weight:500">' + esc(n.title) + (n.description ? '<br><span style="font-size:0.72rem;color:#8e8e93">' + esc(n.description) + '</span>' : '') + '</td>' +
          '<td style="padding:10px 12px">' + typeIcon + ' ' + esc(topicName || "Bilinmeyen") + '</td>' +
          '<td style="padding:10px 12px;text-align:center"><a href="' + fileUrl + '" target="_blank" style="color:#0056cc;text-decoration:none">📄 ' + esc(n.original_name) + '</a></td>' +
          '<td style="padding:10px 12px;text-align:right"><button class="admin-note-delete" data-id="' + n.id + '" data-title="' + esc(n.title) + '" style="padding:4px 10px;background:#fff0f0;color:#d32f2f;border:1px solid #ffd0d0;border-radius:6px;font-size:0.72rem;cursor:pointer;font-family:inherit">Sil</button></td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    container.innerHTML = html;

    document.getElementById("adminAddNoteBtn")?.addEventListener("click", showAddNoteForm);
    document.querySelectorAll(".admin-note-delete").forEach(btn => {
      btn.addEventListener("click", function() {
        if (confirm('"' + this.dataset.title + '" adlı notu silmek istediğinize emin misiniz?')) {
          fetch("/api/notes/" + this.dataset.id, { method: "DELETE" })
            .then(r => r.json()).then(d => { if (d.success) renderAdminNotes(); else alert(d.error); });
        }
      });
    });
  } catch (err) {
    container.innerHTML = '<div style="color:#d32f2f;text-align:center;padding:20px">Hata: ' + err.message + '</div>';
  }
}

function showAddNoteForm() {
  const overlay = document.createElement("div");
  overlay.innerHTML = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);z-index:1100;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">
    <div style="background:white;border-radius:20px;padding:28px;max-width:450px;width:90%;margin:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15)" onclick="event.stopPropagation()">
      <h3 style="font-size:1.1rem;font-weight:600;color:#1d1d1f;margin-bottom:16px">📤 Yeni Not Ekle</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        <input id="nf_title" placeholder="Not başlığı" style="padding:10px 12px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.85rem;font-family:inherit">
        <input id="nf_desc" placeholder="Açıklama (opsiyonel)" style="padding:10px 12px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.85rem;font-family:inherit">
        <div style="display:flex;gap:8px">
          <select id="nf_type" style="flex:1;padding:10px 12px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.85rem;font-family:inherit;background:white">
            <option value="tyt">🧪 TYT Kimya</option>
            <option value="ayt">⚗️ AYT Kimya</option>
            <option value="deneme">📋 Deneme</option>
          </select>
          <select id="nf_topic" style="flex:2;padding:10px 12px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.85rem;font-family:inherit;background:white"></select>
        </div>
        <div style="border:2px dashed #d0d0d5;border-radius:12px;padding:20px;text-align:center;cursor:pointer;color:#8e8e93;font-size:0.82rem;background:#fafbfc" id="nf_dropzone">
          📄 PDF dosyasını seçmek için tıkla
          <input id="nf_file" type="file" accept=".pdf,.png,.jpg,.jpeg" style="display:none">
        </div>
        <div id="nf_fileName" style="font-size:0.78rem;color:#2e7d32;display:none"></div>
        <div id="nf_error" style="color:#d32f2f;font-size:0.78rem;text-align:center"></div>
        <div style="display:flex;gap:10px;margin-top:4px">
          <button onclick="this.closest('div[style*=\\'fixed\\']').remove()" style="flex:1;padding:10px;background:#f5f6f8;border:none;border-radius:10px;font-size:0.85rem;font-weight:500;cursor:pointer;font-family:inherit">İptal</button>
          <button id="nf_save" style="flex:1;padding:10px;background:#2e7d32;color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit">Notu Yükle</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const typeSel = overlay.querySelector("#nf_type");
  const topicSel = overlay.querySelector("#nf_topic");
  function updateTopics() {
    const val = typeSel.value;
    if (val === "deneme") {
      topicSel.innerHTML = '<option value="0">🧪 TYT Deneme</option><option value="1">⚗️ AYT Deneme</option>';
    } else {
      const list = val === "tyt" ? TYT_TOPICS : AYT_TOPICS;
      topicSel.innerHTML = list.map((t, i) => '<option value="' + i + '">' + t + '</option>').join("");
    }
  }
  typeSel.addEventListener("change", updateTopics);
  updateTopics();

  const dropzone = overlay.querySelector("#nf_dropzone");
  const fileInput = overlay.querySelector("#nf_file");
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const fn = overlay.querySelector("#nf_fileName");
    if (fileInput.files[0]) {
      fn.textContent = "✅ " + fileInput.files[0].name + " (" + formatSize(fileInput.files[0].size) + ")";
      fn.style.display = "block";
    }
  });

  overlay.querySelector("#nf_save").addEventListener("click", async () => {
    const title = overlay.querySelector("#nf_title").value.trim();
    const desc = overlay.querySelector("#nf_desc").value.trim();
    const type = overlay.querySelector("#nf_type").value;
    const topic = overlay.querySelector("#nf_topic").value;
    const file = fileInput.files[0];
    const errorEl = overlay.querySelector("#nf_error");

    if (!title) { errorEl.textContent = "Başlık gerekli"; return; }
    if (!file) { errorEl.textContent = "Dosya seçin"; return; }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", desc);
    formData.append("topic_type", type);
    formData.append("topic_index", topic);
    formData.append("file", file);

    try {
      const res = await fetch("/api/notes/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { errorEl.textContent = data.error; return; }
      overlay.remove();
      renderAdminNotes();
    } catch (err) {
      errorEl.textContent = "Yükleme hatası: " + err.message;
    }
  });
}

function pctClass(pct) { if(pct>=80) return "admin-pct-green"; if(pct>=50) return "admin-pct-yellow"; return "admin-pct-red"; }
function pctColor(pct) { if(pct>=80) return "#2e7d32"; if(pct>=50) return "#f5a623"; return "#d32f2f"; }
function pctGradient(pct) {
  if(pct>=80) return "linear-gradient(90deg,#2e7d32,#66bb6a)";
  if(pct>=50) return "linear-gradient(90deg,#f5a623,#ffc107)";
  return "linear-gradient(90deg,#d32f2f,#ef5350)";
}

function renderAdminRow(u, i) {
  const dot = u.online ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2e7d32;margin-right:4px;box-shadow:0 0 5px rgba(46,125,50,0.5);animation:pulse 2s infinite"></span>' : '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#d0d0d5;margin-right:4px"></span>';
  const status = u.online ? '<span style="color:#2e7d32;font-size:0.72rem">Çevrimiçi</span>' : '<span style="color:#b0b0b5;font-size:0.72rem">Çevrimdışı</span>';
  const tytPct = u.tytTotal ? Math.round((u.tytDone/u.tytTotal)*100) : 0;
  const aytPct = u.aytTotal ? Math.round((u.aytDone/u.aytTotal)*100) : 0;
  const genTotal = u.tytTotal + u.aytTotal;
  const genDone = u.tytDone + u.aytDone;
  const genPct = genTotal ? Math.round((genDone/genTotal)*100) : 0;
  return `<tr data-user="${esc(u.username)}">
    <td style="padding:10px 12px">${dot}${esc(u.name)} ${esc(u.surname)}</td>
    <td style="padding:10px 12px;color:#666;font-size:0.78rem">${esc(u.username)}</td>
    <td style="padding:10px 12px;text-align:center">${u.stars}</td>
    <td style="padding:10px 12px;text-align:center">${status}</td>
    <td class="admin-progress-cell"><div class="admin-progress-bar"><div class="admin-progress-fill" style="width:${tytPct}%;background:${pctColor(tytPct)}"></div></div><span class="admin-pct-text ${pctClass(tytPct)}">%${tytPct} (${u.tytDone}/${u.tytTotal})</span></td>
    <td class="admin-progress-cell"><div class="admin-progress-bar"><div class="admin-progress-fill" style="width:${aytPct}%;background:${pctColor(aytPct)}"></div></div><span class="admin-pct-text ${pctClass(aytPct)}">%${aytPct} (${u.aytDone}/${u.aytTotal})</span></td>
    <td style="padding:10px 12px;text-align:right">
      <button class="admin-detail-btn" data-user="${esc(u.username)}" style="padding:4px 10px;background:#f0f7ff;color:#0056cc;border:1px solid #d0e4ff;border-radius:6px;font-size:0.72rem;cursor:pointer;font-family:inherit;margin-right:4px">Detay</button>
      <button class="admin-report-btn" data-user="${esc(u.username)}" style="padding:4px 10px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;border-radius:6px;font-size:0.72rem;cursor:pointer;font-family:inherit;margin-right:4px">📊 Rapor</button>
      <button class="admin-reset" data-user="${esc(u.username)}" style="padding:4px 10px;background:#f0f7ff;color:#0056cc;border:1px solid #d0e4ff;border-radius:6px;font-size:0.72rem;cursor:pointer;font-family:inherit;margin-right:4px">Şifre Sıfırla</button>
      <button class="admin-delete" data-user="${esc(u.username)}" data-name="${esc(u.name)} ${esc(u.surname)}" style="padding:4px 10px;background:#fff0f0;color:#d32f2f;border:1px solid #ffd0d0;border-radius:6px;font-size:0.72rem;cursor:pointer;font-family:inherit">Sil</button>
    </td>
  </tr>`;
}

function showAddStudentForm() {
  const panel = document.createElement("div");
  panel.innerHTML = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);z-index:1100;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">
    <div style="background:white;border-radius:20px;padding:28px;max-width:380px;width:90%;margin:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15)" onclick="event.stopPropagation()">
      <h3 style="font-size:1.1rem;font-weight:600;color:#1d1d1f;margin-bottom:16px">Öğrenci Ekle</h3>
      <div style="display:flex;gap:10px;margin-bottom:12px">
        <input id="af_name" placeholder="Ad" style="flex:1;padding:10px 12px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.85rem;font-family:inherit">
        <input id="af_surname" placeholder="Soyad" style="flex:1;padding:10px 12px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.85rem;font-family:inherit">
      </div>
      <input id="af_username" placeholder="Kullanıcı adı" style="width:100%;padding:10px 12px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.85rem;font-family:inherit;margin-bottom:12px">
      <input id="af_password" type="password" placeholder="Şifre" style="width:100%;padding:10px 12px;border:1px solid #e0e0e5;border-radius:10px;font-size:0.85rem;font-family:inherit;margin-bottom:16px">
      <div style="display:flex;gap:10px">
        <button onclick="this.closest('div[style]').remove()" style="flex:1;padding:10px;background:#f5f6f8;border:none;border-radius:10px;font-size:0.85rem;font-weight:500;cursor:pointer;font-family:inherit">İptal</button>
        <button id="af_save" style="flex:1;padding:10px;background:#0056cc;color:white;border:none;border-radius:10px;font-size:0.85rem;font-weight:500;cursor:pointer;font-family:inherit">Kaydet</button>
      </div>
      <div id="af_error" style="color:#d32f2f;font-size:0.78rem;margin-top:10px;text-align:center"></div>
    </div>
  </div>`;
  document.body.appendChild(panel);
  document.getElementById("af_save").addEventListener("click", async () => {
    const name = document.getElementById("af_name").value.trim();
    const surname = document.getElementById("af_surname").value.trim();
    const username = document.getElementById("af_username").value.trim();
    const password = document.getElementById("af_password").value.trim();
    if (!name || !surname || !username || !password) { document.getElementById("af_error").textContent = "Tüm alanlar zorunlu"; return; }
    if (username.length < 3 || password.length < 3) { document.getElementById("af_error").textContent = "Kullanıcı adı ve şifre en az 3 karakter"; return; }
    const res = await fetch("/api/admin/users/add", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username, password, name, surname}) });
    const data = await res.json();
    if (data.error) { document.getElementById("af_error").textContent = data.error; return; }
    panel.remove();
    loadAdminPanel();
  });
}
if (closeAdmin) closeAdmin.addEventListener("click", () => adminModal.style.display = "none");
adminModal.addEventListener("click", (e) => { if (e.target === adminModal) adminModal.style.display = "none"; });

const rootCards = [
  { name: "TYT", label: "TYT Notları", desc: "TYT kimya ders notları, konu anlatımları ve soru çözümleri", icon: "🧪" },
  { name: "AYT", label: "AYT Notları", desc: "AYT organik kimya ve ileri düzey konu anlatımları", icon: "⚗️" },
  { name: "Deneme", label: "Seri Denemeler", desc: "PDF denemeler, tarama sınavları ve analiz raporları", icon: "📋" },
];

function formatSize(b) { if (!b) return ""; if (b < 1024) return b + " B"; if (b < 1048576) return (b/1024).toFixed(1)+" KB"; return (b/1048576).toFixed(1)+" MB"; }
function formatDate(d) { return new Date(d).toLocaleDateString("tr-TR", { day:"numeric", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" }); }

function getBreadcrumbs(path) {
  const normalized = path.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  const crumbs = [{ name: "Ana Sayfa", path: "" }]; let a = "";
  for (const p of parts) { a = a ? a+"\\"+p : p; crumbs.push({ name: p, path: a }); }
  return crumbs;
}

function renderBreadcrumbs(path) {
  const crumbs = getBreadcrumbs(path);
  const backHtml = path ? '<span class="back-btn" id="backBtn" style="cursor:pointer;color:#0056cc;font-weight:500">← Geri</span><span class="separator" style="margin:0 4px">›</span>' : '';
  breadcrumb.innerHTML = backHtml + crumbs.map((c,i) => (i>0?'<span class="separator" style="margin:0 4px">›</span>':'')+(i===crumbs.length-1?`<span class="current">${c.name}</span>`:`<a href="#" data-path="${c.path}">${c.name}</a>`)).join("");
  if (path) document.getElementById("backBtn").addEventListener("click", () => { const p = crumbs.length > 1 ? crumbs[crumbs.length-2].path : ""; navigate(p); });
  breadcrumb.querySelectorAll("a").forEach(a => a.addEventListener("click", e => { e.preventDefault(); navigate(a.dataset.path); }));
}

function navigate(path) {
  currentPath = path; renderBreadcrumbs(path); loadFiles(path);
  window.history.replaceState(null, "", "#"+path);
  const show = !currentPath;
  document.getElementById("leaderboard").style.display = show ? "block" : "none";
  if (countdownSection) countdownSection.style.display = show ? "block" : "none";
  if (topicSection) topicSection.style.display = show ? "block" : "none";
  const plb = document.getElementById("progressLBSection");
  if (plb) plb.style.display = show && currentUser?.role === "admin" ? "block" : "none";
  const rec = document.getElementById("recentSection");
  if (rec) rec.style.display = show ? "block" : "none";
  const calSec = document.getElementById("calendarSection");
  if (calSec) calSec.style.display = show ? "block" : "none";
}

function loadFiles(path) {
  if (!path) {
    fileList.className = "file-list cards";
    fileList.innerHTML = rootCards.map(c => `<a class="card-item" href="#" data-path="${c.name}"><div class="card-icon">${c.icon}</div><div class="card-title">${c.label}</div><div class="card-desc">${c.desc}</div></a>`).join("");
    fileList.querySelectorAll(".card-item").forEach(a => a.addEventListener("click", e => { e.preventDefault(); navigate(a.dataset.path); }));
    return;
  }
  fileList.className = "file-list";
  fileList.innerHTML = '<div class="loading">Yükleniyor...</div>';
  const url = "/api/files"+(path?"?path="+encodeURIComponent(path):"");
  fetch(url).then(r=>r.json()).then(items => {
    if (!items.length) { fileList.innerHTML = '<div class="empty-state"><div class="icon">📂</div><div>Bu klasörde dosya bulunmuyor</div></div>'; return; }
    fileList.innerHTML = items.map(item => {
      const icon = item.isDirectory ? (item.name==="Konu Anlatımı"?"📖":item.name==="Sorular"?"✍️":item.name==="Slayt"?"🖥️":item.name==="Video"?"🎬":item.name==="İnografi"||item.name==="İnografik"?"📊":"📁") : (()=>{const e=item.name.split(".").pop().toLowerCase();return e==="pdf"?"📄":e==="png"||e==="jpg"||e==="jpeg"?"🖼️":e==="mp4"?"🎬":"📎"})();
      const size = item.size?formatSize(item.size):"";
      const date = item.mtime?formatDate(item.mtime):"";
      const meta = [size,date].filter(Boolean).join(" · ");
      const ep = item.path.replace(/\\/g,"/");
      if (item.isDirectory) return `<a class="file-item" href="#" data-path="${item.path}"><div class="file-icon">${icon}</div><div class="file-info"><div class="file-name">${esc(item.name)}</div><div class="file-meta">Klasör</div></div></a>`;
      const viewUrl = `/viewer.html?file=${encodeURIComponent(ep)}&name=${encodeURIComponent(item.name)}`;
      return `<a class="file-item" href="${viewUrl}" target="_blank"><div class="file-icon">${icon}</div><div class="file-info"><div class="file-name">${esc(item.name)}</div><div class="file-meta">${meta}</div></div></a>`;
    }).join("");
    fileList.querySelectorAll("a[data-path]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); navigate(a.dataset.path); }));
  }).catch(err => { fileList.innerHTML = `<div class="empty-state" style="color:#d32f2f">Hata: ${err.message}</div>`; });
}

function esc(t) { const d=document.createElement("div"); d.textContent=t; return d.innerHTML; }

async function loadDenemeNotes() {
  try {
    const res = await fetch("/api/notes?type=deneme");
    const data = await res.json();
    const el = document.getElementById("denemeNotes");
    if (!el) return;
    if (!data.notes || !data.notes.length) {
      el.innerHTML = '<div style="text-align:center;color:#b0b0b5;font-size:0.78rem;padding:12px">Henüz deneme eklenmemiş</div>';
      return;
    }
    const tytDeneme = data.notes.filter(n => parseInt(n.topic_index) === 0);
    const aytDeneme = data.notes.filter(n => parseInt(n.topic_index) === 1);
    let html = "";
    if (tytDeneme.length) {
      html += '<div style="font-size:0.8rem;font-weight:600;color:#1d1d1f;margin-bottom:6px">🧪 TYT Denemeleri</div>';
      html += tytDeneme.map(n => noteLinkHtml(n)).join("");
    }
    if (aytDeneme.length) {
      html += '<div style="font-size:0.8rem;font-weight:600;color:#1d1d1f;margin:10px 0 6px">⚗️ AYT Denemeleri</div>';
      html += aytDeneme.map(n => noteLinkHtml(n)).join("");
    }
    el.innerHTML = html;
  } catch (err) {
    console.error("Deneme notes load error:", err);
  }
}

function noteLinkHtml(n) {
  const fileUrl = "/uploads/notes/" + encodeURIComponent(n.filename);
  return '<a href="' + fileUrl + '" target="_blank" style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#f5f8ff;border-radius:8px;margin-bottom:4px;text-decoration:none;color:#1d1d1f;font-size:0.78rem">' +
    '<span>📄</span>' +
    '<span style="flex:1">' + esc(n.title) + '</span>' +
    (n.description ? '<span style="font-size:0.7rem;color:#8e8e93">' + esc(n.description) + '</span>' : '') +
    '</a>';
}

function initTopicSystem() {
  fetch("/api/progress").then(r=>r.json()).then(d => {
    progressData = { tyt: d.tyt||[], ayt: d.ayt||[] };
    renderTopics();
    loadDenemeNotes();
  });
}

async function loadNotesForTopic(type, topicIdx) {
  try {
    const res = await fetch("/api/notes?type=" + type + "&topic=" + topicIdx);
    const data = await res.json();
    const el = document.getElementById(type + "Notes");
    if (!el) return;
    if (!data.notes || !data.notes.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = '<div style="font-size:0.75rem;font-weight:600;color:#0056cc;margin-bottom:6px;border-top:1px solid #e8e8ed;padding-top:8px;margin-top:4px">📄 Bu Konuya Ait Notlar</div>' +
      data.notes.map(n => {
        const fileUrl = "/uploads/notes/" + encodeURIComponent(n.filename);
        return '<a href="' + fileUrl + '" target="_blank" style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#f5f8ff;border-radius:8px;margin-bottom:4px;text-decoration:none;color:#1d1d1f;font-size:0.78rem">' +
          '<span>📄</span>' +
          '<span style="flex:1">' + esc(n.title) + '</span>' +
          (n.description ? '<span style="font-size:0.7rem;color:#8e8e93">' + esc(n.description) + '</span>' : '') +
          '</a>';
      }).join("");
  } catch (err) {
    console.error("Notes load error:", err);
  }
}

function renderTopics() {
  const tytDone = progressData.tyt || [];
  const aytDone = progressData.ayt || [];
  const tytPct = Math.round((tytDone.length/TYT_TOPICS.length)*100);
  const aytPct = Math.round((aytDone.length/AYT_TOPICS.length)*100);
  document.getElementById("tytPct").textContent = "%"+tytPct;
  document.getElementById("aytPct").textContent = "%"+aytPct;
  document.getElementById("tytCount").textContent = "("+tytDone.length+"/10)";
  document.getElementById("aytCount").textContent = "("+aytDone.length+"/11)";
  document.getElementById("tytBar").style.width = tytPct+"%";
  document.getElementById("aytBar").style.width = aytPct+"%";
  document.getElementById("tytBar").style.background = pctGradient(tytPct);
  document.getElementById("aytBar").style.background = pctGradient(aytPct);
  document.getElementById("tytTopics").innerHTML = TYT_TOPICS.map((t,i) =>
    `<div class="topic-item${tytDone.includes(i)?" done":""}">
      <input type="checkbox" id="tyt_${i}"${tytDone.includes(i)?" checked":""} data-type="tyt" data-idx="${i}">
      <label for="tyt_${i}">${esc(t)}</label>
      <span class="topic-check">${tytDone.includes(i)?"✅":""}</span>
    </div>`
  ).join("");
  document.getElementById("aytTopics").innerHTML = AYT_TOPICS.map((t,i) =>
    `<div class="topic-item${aytDone.includes(i)?" done":""}">
      <input type="checkbox" id="ayt_${i}"${aytDone.includes(i)?" checked":""} data-type="ayt" data-idx="${i}">
      <label for="ayt_${i}">${esc(t)}</label>
      <span class="topic-check">${aytDone.includes(i)?"✅":""}</span>
    </div>`
  ).join("");
  document.querySelectorAll("#tytTopics input, #aytTopics input").forEach(cb => {
    cb.addEventListener("change", onTopicChange);
    const idx = parseInt(cb.dataset.idx);
    const type = cb.dataset.type;
    loadNotesForTopic(type, idx);
    cb.addEventListener("change", () => setTimeout(() => loadNotesForTopic(type, idx), 100));
  });
}

function onTopicChange() {
  const type = this.dataset.type;
  const idx = parseInt(this.dataset.idx);
  const list = progressData[type];
  if (this.checked) {
    if (!list.includes(idx)) list.push(idx);
    fetch("/api/calendar/log", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ topicIdx: type==="tyt"?idx:idx+100, type:"add" }) });
  } else {
    const p = list.indexOf(idx);
    if (p>-1) list.splice(p,1);
    fetch("/api/calendar/log", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ topicIdx: type==="tyt"?idx:idx+100, type:"remove" }) });
  }
  progressData[type] = list;
  renderTopics();
  fetch("/api/progress", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(progressData) });
}

document.addEventListener("click", (e) => { if (e.target !== searchInput) searchResults.classList.remove("show"); });
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.classList.remove("show"); return; }
  searchTimer = setTimeout(() => doSearch(q), 300);
});
searchInput.addEventListener("focus", () => { if (searchInput.value.trim().length >= 2) searchResults.classList.add("show"); });

function doSearch(q) {
  fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) })
    .then(r => r.json()).then(results => {
      searchResults.classList.add("show");
      if (!results.length) { searchResults.innerHTML = '<div class="search-empty">Sonuç bulunamadı</div>'; return; }
      searchResults.innerHTML = results.map(r => {
        const icon = r.isDirectory ? "📁" : (()=>{const e=r.name.split(".").pop().toLowerCase();return e==="pdf"?"📄":e==="png"||e==="jpg"||e==="jpeg"?"🖼️":e==="mp4"?"🎬":"📎"})();
        const href = r.isDirectory ? "#" : `/viewer.html?file=${encodeURIComponent(r.path.replace(/\\/g,"/"))}&name=${encodeURIComponent(r.name)}`;
        return `<a class="search-result-item" href="${href}" data-path="${r.path}"><span class="sr-icon">${icon}</span><div><div class="sr-name">${esc(r.name)}</div><div class="sr-path">${esc(r.path)}</div></div></a>`;
      }).join("");
      searchResults.querySelectorAll("a[data-path]").forEach(a => {
        a.addEventListener("click", e => {
          if (a.getAttribute("href") === "#") { e.preventDefault(); searchResults.classList.remove("show"); searchInput.value = ""; navigate(a.dataset.path); }
        });
      });
    });
}

function initOnlineSystem() {
  fetch("/api/heartbeat", { method: "POST" });
  heartbeatTimer = setInterval(() => {
    fetch("/api/heartbeat", { method: "POST" });
  }, 30000);

  document.addEventListener("visibilitychange", () => {
    const hidden = document.hidden;
    tabActive = !hidden;
    if (hidden) {
      navigator.sendBeacon("/api/stars/online", JSON.stringify({ online: false }));
    } else {
      fetch("/api/heartbeat", { method: "POST" });
    }
  });

  window.addEventListener("beforeunload", () => {
    navigator.sendBeacon("/api/stars/online", JSON.stringify({ online: false }));
  });
}

function initStarSystem() {
  const stored = localStorage.getItem("kimya_stars_"+currentUser.user);
  if (stored) starCount = parseInt(stored) || 0;
  fetch("/api/stars/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stars: starCount }) });
  starTimer = setInterval(() => {
    if (!tabActive) return;
    starCount++;
    localStorage.setItem("kimya_stars_"+currentUser.user, starCount);
    fetch("/api/stars/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stars: starCount }) });
    showStarToast("⭐ +1 yıldız kazandınız!");
    loadLeaderboard();
  }, 7200000);
}

function showStarToast(msg) {
  starToast.textContent = msg;
  starToast.classList.add("show");
  setTimeout(() => starToast.classList.remove("show"), 3000);
}

function loadRecentUploads() {
  fetch("/api/recent-uploads").then(r=>r.json()).then(list => {
    const el = document.getElementById("recentList");
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="recent-empty">Henüz not eklenmemiş. PDF\'leri masaüstündeki "PDF Ekle" klasörüne bırakın.</div>';
      return;
    }
    el.innerHTML = list.map(r => {
      const t = new Date(r.time);
      const ts = t.toLocaleDateString("tr-TR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
      const filePath = r.name.replace(/\\/g,"/");
      const url = `/viewer.html?file=${encodeURIComponent(filePath)}&name=${encodeURIComponent(r.name.split("/").pop()||r.name.split("\\").pop())}`;
      return `<a class="recent-item" href="${url}" target="_blank"><span class="recent-icon">📄</span><span class="recent-name">${esc(r.name)}</span><span class="recent-time">${ts}</span></a>`;
    }).join("");
  }).catch(() => {});
}

const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const DAYS = ["Pzt","Sal","Çar","Per","Cu","Cmt","Paz"];

let calendarData = {};

function openDayPlan(dateStr) {
  const dayData = calendarData[dateStr] || {};
  const dayNum = parseInt(dateStr.split("-")[2]);
  const monthName = MONTHS[parseInt(dateStr.split("-")[1])-1];
  const modalId = "planModal_" + dateStr.replace(/-/g,"_");
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = modalId;
  overlay.className = "plan-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);z-index:1200;display:flex;align-items:center;justify-content:center";
  overlay.addEventListener("click", function(e) { if (e.target === this) this.remove(); });

  function renderPlanList() {
    const p = calendarData[dateStr]?.plan || [];
    if (!p.length) return '<div style="text-align:center;color:#b0b0b5;padding:16px;font-size:0.82rem">Henüz plan yok. Konu ekleyin.</div>';
    return p.map(function(item, idx) {
      const topicName = item.topicName || (item.type === "tyt" ? TYT_TOPICS[item.topicIdx] : AYT_TOPICS[item.topicIdx]);
      const creatorLabel = item.createdBy === "admin" ? ' <span style="font-size:0.6rem;color:#8e8e93">👑</span>' : '';
      return '<div class="plan-item">' +
        '<span class="plan-item-name">' + (item.type==="tyt"?"🧪":"⚗️") + ' ' + esc(topicName||"") + creatorLabel + '</span>' +
        '<select class="plan-status" data-idx="' + idx + '">' +
          '<option value="planned"' + (item.status==="planned"?" selected":"") + '>🟦 Planlandı</option>' +
          '<option value="working"' + (item.status==="working"?" selected":"") + '>🟨 Çalışılıyor</option>' +
          '<option value="completed"' + (item.status==="completed"?" selected":"") + '>🟩 Tamamlandı</option>' +
        '</select>' +
        '<button class="plan-remove" data-idx="' + idx + '">&times;</button>' +
      '</div>';
    }).join("");
  }

  overlay.innerHTML = '<div class="plan-modal" onclick="event.stopPropagation()">' +
    '<div class="plan-modal-header">' +
      '<h3>📅 ' + dayNum + ' ' + monthName + ' Çalışma Planı</h3>' +
      '<button class="plan-close">&times;</button>' +
    '</div>' +
    '<div class="plan-meta">' + (dayData.active ? Math.round(dayData.active/60) + 'dk çalışma · ' : '') + (dayData.topics||[]).length + ' konu tamamlandı</div>' +
    '<div class="plan-list" id="planList_' + modalId + '">' + renderPlanList() + '</div>' +
    '<div class="plan-add-row">' +
      '<select id="planType_' + modalId + '"><option value="tyt">🧪 TYT</option><option value="ayt">⚗️ AYT</option></select>' +
      '<select id="planTopic_' + modalId + '"></select>' +
      '<button id="planAddBtn_' + modalId + '">+ Ekle</button>' +
    '</div>' +
  '</div>';

  document.body.appendChild(overlay);

  overlay.querySelector(".plan-close").addEventListener("click", function(e) { e.preventDefault(); overlay.remove(); });
  overlay.querySelector("#planAddBtn_" + modalId).addEventListener("click", function(e) {
    e.preventDefault();
    const typeSel = overlay.querySelector("#planType_" + modalId);
    const topicSel = overlay.querySelector("#planTopic_" + modalId);
    const type = typeSel.value;
    const topicIdx = parseInt(topicSel.value);
    const topicName = topicSel.options[topicSel.selectedIndex]?.text || "";
    if (!topicName) return;
    if (!calendarData[dateStr]) calendarData[dateStr] = { active: 0, topics: [], plan: [] };
    if (!calendarData[dateStr].plan) calendarData[dateStr].plan = [];
    calendarData[dateStr].plan.push({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2,5),
      topicIdx: topicIdx,
      type: type,
      topicName: topicName,
      status: "planned",
      createdBy: "student"
    });
    savePlan(dateStr);
    const listEl = overlay.querySelector("#planList_" + modalId);
    if (listEl) listEl.innerHTML = renderPlanList();
    bindPlanEvents(overlay, dateStr, modalId);
  });

  function bindPlanEvents(ov, ds, mid) {
    ov.querySelectorAll(".plan-status").forEach(function(sel) {
      sel.addEventListener("change", function() {
        const idx = parseInt(this.dataset.idx);
        if (calendarData[ds]?.plan?.[idx]) {
          calendarData[ds].plan[idx].status = this.value;
          savePlan(ds);
          loadCalendar();
        }
      });
    });
    ov.querySelectorAll(".plan-remove").forEach(function(btn) {
      btn.addEventListener("click", function() {
        const idx = parseInt(this.dataset.idx);
        if (calendarData[ds]?.plan) {
          calendarData[ds].plan.splice(idx, 1);
          savePlan(ds);
          loadCalendar();
          const listEl2 = ov.querySelector("#planList_" + mid);
          if (listEl2) listEl2.innerHTML = renderPlanList();
          bindPlanEvents(ov, ds, mid);
        }
      });
    });
  }

  bindPlanEvents(overlay, dateStr, modalId);

  const typeSel = overlay.querySelector("#planType_" + modalId);
  const topicSel = overlay.querySelector("#planTopic_" + modalId);
  function updateTopics() {
    const list = typeSel.value === "tyt" ? TYT_TOPICS : AYT_TOPICS;
    topicSel.innerHTML = list.map(function(t,i) { return '<option value="' + i + '">' + t + '</option>'; }).join("");
  }
  typeSel.addEventListener("change", updateTopics);
  updateTopics();
}

function savePlan(dateStr) {
  const plan = calendarData[dateStr]?.plan || [];
  fetch("/api/calendar/plan", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ date: dateStr, plan }) })
    .catch(err => console.error("Plan kaydedilemedi:", err));
}

function loadCalendar() {
  fetch("/api/calendar").then(r=>r.json()).then(data => {
    calendarData = data;
    const grid = document.getElementById("calGrid");
    const stats = document.getElementById("calStats");
    const weekly = document.getElementById("calWeekly");
    if (!grid) return;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y,m,1).getDay();
    const daysInMonth = new Date(y,m+1,0).getDate();
    const todayStr = now.toISOString().split("T")[0];
    let totalActive = 0, studyDays = 0;
    const weekBars = [];
    for (let i=0;i<7;i++) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      const ds = d.toISOString().split("T")[0];
      const dayData = data[ds];
      const active = dayData?.active || 0;
      totalActive += active;
      if (active > 0) studyDays++;
      weekBars.unshift({ date: ds, active, day: d.getDate(), topics: dayData?.topics?.length || 0 });
    }
    const streak = (() => { let c=0; const t=new Date(); for(let i=0;i<365;i++){ const d=t.toISOString().split("T")[0]; if(data[d]&&(data[d].active>0||(data[d].topics||[]).length>0)) c++; else break; t.setDate(t.getDate()-1); } return c; })();
    if (stats) stats.textContent = `🔥 ${streak} gün · ${studyDays}/7 gün aktif`;
    let html = '<div class="cal-day-label"></div>';
    for (let d=0;d<7;d++) html += `<div class="cal-day-label">${DAYS[d]}</div>`;
    const adjust = first === 0 ? 6 : first - 1;
    for (let i=0;i<adjust;i++) html += '<div></div>';
    for (let d=1;d<=daysInMonth;d++) {
      const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const dayData = data[dateStr];
      const active = dayData?.active || 0;
      const planCount = dayData?.plan?.length || 0;
      const completedPlans = (dayData?.plan||[]).filter(p=>p.status==="completed").length;
      const planTopics = (dayData?.plan||[]).map(p => {
        const n = p.topicName || (p.type === "tyt" ? TYT_TOPICS[p.topicIdx] : AYT_TOPICS[p.topicIdx]);
        return (p.status==="completed"?"✅":p.status==="working"?"🟨":"🟦") + " " + n;
      }).slice(0,3);
      const cls = ["cal-day"];
      if (dateStr === todayStr) cls.push("today");
      if (active > 120) cls.push("study-high");
      else if (active > 0) cls.push("study-mid");
      else if (planCount > 0) cls.push("has-plan");
      const topicLabel = planTopics.length ? '<div class="cal-day-topic" style="margin-top:1px;color:#666">' + planTopics[0] + '</div>' : '';
      const detail = planTopics.length ? "title=\"" + d + " " + MONTHS[m] + "\\n" + planTopics.join("\\n") + "\"" : "title=\"" + d + " " + MONTHS[m] + (active ? " - " + Math.round(active/60) + "dk" : "") + "\"";
      html += '<div class="' + cls.join(" ") + '" onclick="openDayPlan(\'' + dateStr + '\')" ' + detail + '>' + d +
        topicLabel +
        (planCount > 1 ? '<div style="font-size:0.4rem;opacity:0.5;line-height:1">+' + (planCount-1) + ' daha</div>' : '') +
      '</div>';
    }
    grid.innerHTML = html;
    if (weekly) {
      const maxActive = Math.max(...weekBars.map(w=>w.active), 1);
      weekly.innerHTML = `<div class="cal-weekly-title">📊 Bu Hafta - ${Math.round(totalActive/60)}dk toplam çalışma</div><div class="cal-weekly-bar">${
        weekBars.map(w => {
          const pct = maxActive > 0 ? (w.active/maxActive)*100 : 0;
          const h = Math.max(8, pct);
          const color = w.active > 120 ? '#2e7d32' : w.active > 0 ? '#0056cc' : '#e0e0e5';
          return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;height:100%"><div style="width:100%;border-radius:4px 4px 0 0;min-height:4px;height:${h}%;background:${color};transition:height 0.3s;margin-top:auto" title="${w.date}: ${Math.round(w.active/60)}dk"></div><div style="font-size:0.55rem;color:#8e8e93;text-align:center;margin-top:3px">${DAYS[new Date(w.date).getDay()===0?6:new Date(w.date).getDay()-1].charAt(0)}</div></div>`;
        }).join("")
      }</div>`;
    }
  }).catch(() => {});
}

function generateReport(username) {
  window.open(`/report.html?username=${encodeURIComponent(username)}`, "_blank", "width=800,height=900");
}

function loadLeaderboard() {
  fetch("/api/leaderboard").then(r => r.json()).then(res => {
    const list = res.users || [];
    const onlineCount = res.onlineCount || 0;
    const onlineSection = document.getElementById("onlineSection");
    const onlineUsers = list.filter(u => u.online);

    if (!list.length) {
      lbContent.innerHTML = '<div style="text-align:center;color:#b0b0b5;padding:16px;font-size:0.85rem">Henüz üye yok</div>';
      if (onlineSection) onlineSection.innerHTML = '';
      return;
    }

    if (onlineSection) {
      if (!onlineUsers.length) {
        onlineSection.innerHTML = '';
      } else {
        onlineSection.innerHTML = `<div style="font-size:0.85rem;font-weight:600;color:#1d1d1f;margin-bottom:10px">🟢 Şu Anda Çalışanlar (${onlineCount})</div><div style="display:flex;flex-wrap:wrap;gap:8px">` +
          onlineUsers.map(u => {
            const initial = (u.name.charAt(0)+u.surname.charAt(0)).toUpperCase() || u.username.charAt(0).toUpperCase();
            return `<div style="display:flex;align-items:center;gap:8px;background:#f0f7ff;border:1px solid #d0e4ff;border-radius:12px;padding:8px 12px;box-shadow:0 0 12px rgba(0,86,204,0.06)"><div style="width:28px;height:28px;border-radius:50%;background:#0056cc;color:white;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:600;flex-shrink:0">${initial}</div><div><div style="font-size:0.78rem;font-weight:500;color:#1d1d1f">${esc(u.name)} ${esc(u.surname)}</div><div style="font-size:0.7rem;color:#8e8e93">⭐ ${u.stars} · @${esc(u.username)}</div></div><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2e7d32;box-shadow:0 0 6px rgba(46,125,50,0.6);animation:pulse 2s infinite;margin-left:auto;flex-shrink:0"></span></div>`;
          }).join('') + '</div>';
      }
    }

    const top = list.slice(0, 5);
    const rest = list.slice(5);

    let html = top.map((u, i) => {
      const rank = i+1;
      const badge = rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"";
      const initial = (u.name.charAt(0)+u.surname.charAt(0)).toUpperCase() || u.username.charAt(0).toUpperCase();
      const dot = u.online ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2e7d32;margin-right:6px;box-shadow:0 0 6px rgba(46,125,50,0.5);animation:pulse 2s infinite"></span>' : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#d0d0d5;margin-right:6px"></span>';
      const status = u.online ? '<span class="lb-status online">Çevrimiçi</span>' : '<span class="lb-status offline">Çevrimdışı</span>';
      return `<div class="lb-item" style="${u.online?'box-shadow:inset 0 0 0 1px rgba(46,125,50,0.15)':''}"><span class="lb-badge">${badge}</span><div class="lb-avatar" style="${u.online?'box-shadow:0 0 0 2px #2e7d32':''}">${initial}</div><div class="lb-info"><div class="lb-name">${dot}${esc(u.name)} ${esc(u.surname)}</div><div class="lb-stars">${u.stars}</div></div>${status}</div>`;
    }).join("");

    if (rest.length) {
      html += `<button class="lb-more" id="lbToggle">Tüm Sıralamayı Göster (${list.length} kişi)</button><div class="lb-more-all" id="lbAll">`;
      html += rest.map((u, i) => {
        const rank = i+6;
        const initial = (u.name.charAt(0)+u.surname.charAt(0)).toUpperCase() || u.username.charAt(0).toUpperCase();
        const dot = u.online ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2e7d32;margin-right:6px;box-shadow:0 0 6px rgba(46,125,50,0.5);animation:pulse 2s infinite"></span>' : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#d0d0d5;margin-right:6px"></span>';
        const status = u.online ? '<span class="lb-status online">Çevrimiçi</span>' : '<span class="lb-status offline">Çevrimdışı</span>';
        return `<div class="lb-item"><span class="lb-rank">${rank}</span><div class="lb-avatar" style="${u.online?'box-shadow:0 0 0 2px #2e7d32':''}">${initial}</div><div class="lb-info"><div class="lb-name">${dot}${esc(u.name)} ${esc(u.surname)}</div><div class="lb-stars">${u.stars}</div></div>${status}</div>`;
      }).join("") + '</div>';
    }

    lbContent.innerHTML = html;
    const btn = document.getElementById("lbToggle");
    if (btn) btn.addEventListener("click", () => {
      const all = document.getElementById("lbAll");
      all.classList.toggle("show");
      btn.textContent = btn.textContent.includes("Göster") ? "Gizle" : "Tüm Sıralamayı Göster ("+list.length+" kişi)";
    });
  }).catch(() => {});
}

function loadProgressLeaderboard() {
  fetch("/api/progress/all").then(r=>r.json()).then(data => {
    const list = data.users || [];
    const container = document.getElementById("progressLB");
    if (!container) return;
    if (!list.length) { container.style.display = "none"; return; }
    container.style.display = "block";
    container.innerHTML = `<div class="plb-title"><span>📊</span> Herkesin İlerlemesi</div>` +
      list.map(u => {
        const tytPct = u.tytTotal ? Math.round((u.tytDone/u.tytTotal)*100) : 0;
        const aytPct = u.aytTotal ? Math.round((u.aytDone/u.aytTotal)*100) : 0;
        const genTotal = u.tytTotal + u.aytTotal;
        const genDone = u.tytDone + u.aytDone;
        const genPct = genTotal ? Math.round((genDone/genTotal)*100) : 0;
        const dot = u.online ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2e7d32;margin-right:6px;box-shadow:0 0 5px rgba(46,125,50,0.5);animation:pulse 2s infinite;flex-shrink:0"></span>' : '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#d0d0d5;margin-right:6px;flex-shrink:0"></span>';
        return `<div class="plb-card" onclick="showStudentDetailModal('${esc(u.username)}')">
          <div class="plb-header">${dot}<span class="plb-name">${esc(u.name)} ${esc(u.surname)}</span><span class="plb-stars">⭐${u.stars}</span></div>
          <div class="plb-bars">
            <div class="plb-row"><span class="plb-label">TYT</span><div class="plb-bar"><div class="plb-fill" style="width:${tytPct}%;background:${pctColor(tytPct)}"></div></div><span class="plb-pct ${pctClass(tytPct)}">%${tytPct}</span></div>
            <div class="plb-row"><span class="plb-label">AYT</span><div class="plb-bar"><div class="plb-fill" style="width:${aytPct}%;background:${pctColor(aytPct)}"></div></div><span class="plb-pct ${pctClass(aytPct)}">%${aytPct}</span></div>
            <div class="plb-row"><span class="plb-label">Genel</span><div class="plb-bar"><div class="plb-fill" style="width:${genPct}%;background:${pctGradient(genPct)}"></div></div><span class="plb-pct ${pctClass(genPct)}">%${genPct}</span></div>
          </div>
          <div class="plb-meta">${u.tytDone}/${u.tytTotal} TYT · ${u.aytDone}/${u.aytTotal} AYT</div>
        </div>`;
      }).join("");
    container.querySelectorAll(".plb-card").forEach(c => c.addEventListener("click", function() {
      const idx = Array.from(this.parentNode.children).indexOf(this) - 1;
      const u = list[idx];
      if (u) showStudentDetailModal(u.username);
    }));
  }).catch(() => {});
}

function showStudentDetailModal(username) {
  const content = document.getElementById("studentDetailContent");
  studentModal.style.display = "flex";
  content.innerHTML = "Yükleniyor...";
  fetch("/api/admin/user/detail?username="+encodeURIComponent(username)).then(r=>r.json()).then(u => {
    if (u.error) { content.innerHTML = `<div style="color:#d32f2f;padding:20px;text-align:center">${u.error}</div>`; return; }
    const tytPct = u.tytTotal ? Math.round((u.tytDone/u.tytTotal)*100) : 0;
    const aytPct = u.aytTotal ? Math.round((u.aytDone/u.aytTotal)*100) : 0;
    const genTotal = u.tytTotal + u.aytTotal;
    const genDone = u.tytDone + u.aytDone;
    const genPct = genTotal ? Math.round((genDone/genTotal)*100) : 0;
    const dot = u.online ? '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2e7d32;box-shadow:0 0 6px rgba(46,125,50,0.5);animation:pulse 2s infinite;margin-right:6px;vertical-align:middle"></span>' : '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#d0d0d5;margin-right:6px;vertical-align:middle"></span>';
    const activeHours = u.todayActive ? (u.todayActive/3600).toFixed(1) : "0.0";
    const tytDoneList = (u.tytList||[]).map(i => TYT_TOPICS[i]).filter(Boolean);
    const aytDoneList = (u.aytList||[]).map(i => AYT_TOPICS[i]).filter(Boolean);
    const tytMissing = TYT_TOPICS.filter((_,i) => !(u.tytList||[]).includes(i));
    const aytMissing = AYT_TOPICS.filter((_,i) => !(u.aytList||[]).includes(i));
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e8e8ed">
        <div style="width:40px;height:40px;border-radius:50%;background:#0056cc;color:white;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:600;flex-shrink:0">${(u.name.charAt(0)+u.surname.charAt(0)).toUpperCase()}</div>
        <div>
          <div style="font-size:1rem;font-weight:600">${esc(u.name)} ${esc(u.surname)}</div>
          <div style="font-size:0.78rem;color:#8e8e93">@${esc(u.username)} ${dot} ${u.online?"Çevrimiçi":"Çevrimdışı"} · ⭐${u.stars} · 🕐 ${activeHours}s aktif</div>
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:0.82rem;font-weight:600;color:#1d1d1f">Genel İlerleme <span class="${pctClass(genPct)}">%${genPct} (${genDone}/${genTotal})</span></div>
        <div style="height:10px;background:#e8e8ed;border-radius:5px;overflow:hidden"><div style="height:100%;width:${genPct}%;background:${pctGradient(genPct)};border-radius:5px;transition:width 0.5s"></div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:#f5f8ff;border-radius:12px;padding:12px;border:1px solid #e0e8f5">
          <div style="font-size:0.72rem;font-weight:600;color:#0056cc;margin-bottom:4px">TYT</div>
          <div style="height:6px;background:#e8e8ed;border-radius:3px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:${tytPct}%;background:${pctColor(tytPct)};border-radius:3px"></div></div>
          <div style="font-size:0.85rem;font-weight:700;color:#1d1d1f">%${tytPct} <span style="font-size:0.72rem;font-weight:400;color:#8e8e93">${u.tytDone}/${u.tytTotal}</span></div>
        </div>
        <div style="background:#f5f8ff;border-radius:12px;padding:12px;border:1px solid #e0e8f5">
          <div style="font-size:0.72rem;font-weight:600;color:#0056cc;margin-bottom:4px">AYT</div>
          <div style="height:6px;background:#e8e8ed;border-radius:3px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:${aytPct}%;background:${pctColor(aytPct)};border-radius:3px"></div></div>
          <div style="font-size:0.85rem;font-weight:700;color:#1d1d1f">%${aytPct} <span style="font-size:0.72rem;font-weight:400;color:#8e8e93">${u.aytDone}/${u.aytTotal}</span></div>
        </div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:0.85rem;font-weight:600;color:#2e7d32;margin-bottom:8px">✅ Tamamlanan Konular</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
          ${tytDoneList.length ? tytDoneList.map(t => `<span style="display:inline-block;background:#e8f5e9;color:#2e7d32;padding:4px 10px;border-radius:8px;font-size:0.72rem;border:1px solid #c8e6c9">✅ ${esc(t)}</span>`).join("") : '<span style="font-size:0.78rem;color:#999">Henüz tamamlanmamış</span>'}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${aytDoneList.length ? aytDoneList.map(t => `<span style="display:inline-block;background:#e8f5e9;color:#2e7d32;padding:4px 10px;border-radius:8px;font-size:0.72rem;border:1px solid #c8e6c9">✅ ${esc(t)}</span>`).join("") : ''}
        </div>
      </div>
      <div>
        <div style="font-size:0.85rem;font-weight:600;color:#d32f2f;margin-bottom:8px">❌ Eksik Konular <span style="font-size:0.72rem;font-weight:400;color:#999">${tytMissing.length + aytMissing.length} konu kaldı</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">
          ${tytMissing.length ? tytMissing.map(t => `<span style="display:inline-block;background:#fff0f0;color:#d32f2f;padding:4px 10px;border-radius:8px;font-size:0.72rem;border:1px solid #ffd0d0">❌ TYT - ${esc(t)}</span>`).join("") : '<span style="font-size:0.78rem;color:#999">Tüm TYT konuları tamamlandı 🎉</span>'}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${aytMissing.length ? aytMissing.map(t => `<span style="display:inline-block;background:#fff0f0;color:#d32f2f;padding:4px 10px;border-radius:8px;font-size:0.72rem;border:1px solid #ffd0d0">❌ AYT - ${esc(t)}</span>`).join("") : '<span style="font-size:0.78rem;color:#999">Tüm AYT konuları tamamlandı 🎉</span>'}
        </div>
      </div>
    `;
  }).catch(() => { content.innerHTML = '<div style="color:#d32f2f;padding:20px;text-align:center">Hata oluştu</div>'; });
}

document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (e.ctrlKey && (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P" || e.key === "u" || e.key === "U")) e.preventDefault();
});
document.addEventListener("dragstart", e => e.preventDefault());

const hash = location.hash.replace("#", "");
navigate(hash || "");
