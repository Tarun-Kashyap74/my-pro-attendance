// --- INITIALIZATION ---
let subjects = JSON.parse(localStorage.getItem("subjects")) || [];
let timetable = JSON.parse(localStorage.getItem("timetable")) || [];
let appSettings = JSON.parse(localStorage.getItem("appSettings")) || {
  themePrimary: "#6c5ce7",
  themeAccent: "#a29bfe",
  darkMode: false,
};

subjects.forEach((s) => {
  if (!s.history) s.history = [];
  if (!s.tasks) s.tasks = [];
});

applyTheme(
  appSettings.themePrimary,
  appSettings.themeAccent,
  appSettings.darkMode,
);

let currentEditIdx = null;
let editingTTIndex = null;
let currentTaskSubIdx = null;
let subjectEditIdx = null;
let _lastDateStamp = new Date().toDateString();

// --- THEME ---
function toggleDarkMode() {
  const isDark = document.getElementById("darkModeToggle").checked;
  appSettings.darkMode = isDark;
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  saveData();
}

function setTheme(primary, accent) {
  appSettings.themePrimary = primary;
  appSettings.themeAccent = accent;
  applyTheme(primary, accent, appSettings.darkMode);
  saveData();
}

function applyTheme(p, a, isDark) {
  document.documentElement.style.setProperty("--primary", p);
  const toggleBtn = document.getElementById("darkModeToggle");
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
    if (toggleBtn) toggleBtn.checked = true;
  } else {
    document.documentElement.removeAttribute("data-theme");
    if (toggleBtn) toggleBtn.checked = false;
  }
}

// --- TABS ---
function switchTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById("tab-" + tabId).classList.add("active");
  const navs = document.querySelectorAll(".nav-item");
  navs.forEach((n) => n.classList.remove("active"));
  if (tabId === "home") navs[0].classList.add("active");
  if (tabId === "subjects") navs[1].classList.add("active");
  if (tabId === "stats") navs[2].classList.add("active");
  const titles = { home: "Home", subjects: "Subjects", stats: "Statistics" };
  document.getElementById("pageTitle").innerText = titles[tabId];
}

// --- CLOCK ---
function updateClock() {
  const now = new Date();
  const secs = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("liveClock").innerText = now.toLocaleTimeString(
    "en-US",
    { hour: "numeric", minute: "2-digit", hour12: true },
  );

  const todayStamp = now.toDateString();
  if (todayStamp !== _lastDateStamp) {
    _lastDateStamp = todayStamp;
    renderCalendar();
    renderTodaySchedule();
  }
  if (secs === "00") renderTodaySchedule();
}
setInterval(updateClock, 1000);

// --- RENDER ---
function renderSubjects() {
  const list = document.getElementById("subjectList");
  if (subjects.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--muted)">
      <i class='bx bx-book-open' style="font-size:3rem; margin-bottom:10px; display:block"></i>
      <p>No subjects yet.</p>
    </div>`;
    return;
  }
  // highlight subjects relative to currently selected target
  const globalTarget = parseInt(
    document.getElementById("targetSlider").value || "75",
    10,
  );
  list.innerHTML = subjects
    .map((s, i) => {
      const p = s.total > 0 ? ((s.present / s.total) * 100).toFixed(2) : "0.00";
      const pendingTasks = s.tasks ? s.tasks.filter((t) => !t.done).length : 0;
      return `
      <div class="subject-item">
        <div class="subject-info" onclick="openTaskModal(${i})">
          <strong>${s.name} ${pendingTasks > 0 ? `<span style="font-size:0.7rem; background:var(--danger); color:white; padding:2px 6px; border-radius:10px">${pendingTasks}</span>` : ""}</strong>
          <div class="subject-stats">
            Attendance: <span style="color:${parseFloat(p) >= globalTarget ? "var(--success)" : "var(--danger)"}; font-weight:bold">${p}%</span> 
            (${s.present}/${s.total})
          </div>
        </div>
        <div class="subject-actions">
          <button class="btn-icon btn-p" onclick="markAttendance(${i},true)"><i class='bx bx-check'></i></button>
          <button class="btn-icon btn-a" onclick="markAttendance(${i},false)"><i class='bx bx-x'></i></button>
          <button class="btn-icon" title="Edit subject" onclick="openEditSubject(${i})"><i class='bx bx-edit-alt'></i></button>
          <button class="btn-icon btn-more" onclick="openEditAttendance(${i})"><i class='bx bx-dots-vertical-rounded'></i></button>
          <button class="btn-icon btn-more" onclick="deleteSubject(${i})" style="color:var(--danger)"><i class='bx bx-trash'></i></button>
        </div>
      </div>`;
    })
    .join("");
}

// Edit subject name (simple prompt). Updates the name and re-renders.
function openEditSubject(idx) {
  const current = subjects[idx];
  if (!current) return;
  subjectEditIdx = idx;
  document.getElementById("editSubjectNameInput").value = current.name;
  openModal("editSubjectModal");
}

function saveEditedSubject() {
  const val = (
    document.getElementById("editSubjectNameInput").value || ""
  ).trim();
  if (!val) return alert("Name cannot be empty.");
  if (subjectEditIdx === null || subjectEditIdx === undefined) return;
  subjects[subjectEditIdx].name = val;
  subjectEditIdx = null;
  saveData();
  closeModal("editSubjectModal");
}

function confirmAddSubject() {
  const input = document.getElementById("subjectNameInput");
  const name = (input.value || "").trim();
  if (!name) return;
  subjects.push({ name: name, present: 0, total: 0, history: [], tasks: [] });
  saveData();
  input.value = "";
  closeModal("subjectModal");
}

function deleteSubject(idx) {
  window.subjectToDelete = idx;
  document.getElementById("deleteSubjectName").innerText =
    `Delete "${subjects[idx].name}"?`;
  openModal("deleteConfirmationModal");
}

function confirmDeleteSubject() {
  if (window.subjectToDelete !== undefined && window.subjectToDelete !== null) {
    subjects.splice(window.subjectToDelete, 1);
    saveData();
    window.subjectToDelete = null;
  }
  closeModal("deleteConfirmationModal");
}

function markAttendance(idx, isPresent) {
  subjects[idx].total++;
  if (isPresent) subjects[idx].present++;
  subjects[idx].history.push({
    date: new Date().toISOString(),
    status: isPresent ? "P" : "A",
  });
  saveData();
}

function openEditAttendance(idx) {
  currentEditIdx = idx;
  document.getElementById("editSubName").innerText = subjects[idx].name;
  document.getElementById("manualPresent").value = subjects[idx].present;
  document.getElementById("manualTotal").value = subjects[idx].total;
  openModal("editAttendanceModal");
}

function saveManualAttendance() {
  subjects[currentEditIdx].present =
    parseInt(document.getElementById("manualPresent").value) || 0;
  subjects[currentEditIdx].total =
    parseInt(document.getElementById("manualTotal").value) || 0;
  saveData();
  closeModal("editAttendanceModal");
}

// --- TASKS ---
function openTaskModal(idx) {
  currentTaskSubIdx = idx;
  document.getElementById("taskModalTitle").innerText =
    `Tasks: ${subjects[idx].name}`;
  renderTasks();
  openModal("taskModal");
}

function renderTasks() {
  const list = document.getElementById("taskList");
  const tasks = subjects[currentTaskSubIdx].tasks;
  if (!tasks || tasks.length === 0) {
    list.innerHTML = `<p style="color:var(--muted); text-align:center; padding:20px;">No pending tasks.</p>`;
    return;
  }
  list.innerHTML = tasks
    .map(
      (t, i) => `
    <div class="task-item ${t.done ? "completed" : ""}" onclick="toggleTask(${i})">
      <span>${t.done ? '<i class="bx bx-checkbox-checked"></i>' : '<i class="bx bx-checkbox"></i>'} &nbsp; ${t.text}</span>
      <i class='bx bx-x' style="font-size:1.2rem; color:var(--muted)" onclick="deleteTask(event, ${i})"></i>
    </div>
  `,
    )
    .join("");
}

function addNewTask() {
  const input = document.getElementById("newTaskInput");
  const val = input.value.trim();
  if (!val) return;
  subjects[currentTaskSubIdx].tasks.push({ text: val, done: false });
  input.value = "";
  saveData();
  renderTasks();
  renderSubjects();
}

function toggleTask(taskIdx) {
  const t = subjects[currentTaskSubIdx].tasks[taskIdx];
  t.done = !t.done;
  saveData();
  renderTasks();
  renderSubjects();
}

function deleteTask(e, taskIdx) {
  e.stopPropagation();
  subjects[currentTaskSubIdx].tasks.splice(taskIdx, 1);
  saveData();
  renderTasks();
  renderSubjects();
}

// --- TIMETABLE ---
function renderTodaySchedule() {
  const today = new Date().getDay();
  const daysFull = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  document.getElementById("todayDay").innerText = daysFull[today];

  const classes = timetable
    .filter((item) => parseInt(item.day, 10) === today)
    .sort((a, b) => a.from.localeCompare(b.from));
  const scheduleList = document.getElementById("todaySchedule");

  if (classes.length === 0) {
    scheduleList.innerHTML =
      '<p style="color:var(--muted); text-align:center; font-size:0.9rem; padding:10px;">No classes today.</p>';
    document.getElementById("nextClassDetail").innerText = "Relax!";
    document.getElementById("nextClassTime").innerText = "No classes";
    return;
  }

  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const ongoing = classes.find(
    (item) => timeToMinutes(item.from) <= nowM && timeToMinutes(item.to) > nowM,
  );
  const upcoming = ongoing
    ? null
    : classes.find((item) => timeToMinutes(item.from) > nowM);

  scheduleList.innerHTML = classes
    .map((item) => {
      const isO = ongoing && item === ongoing;
      return `<div class="tt-row${isO ? " ongoing" : ""}">
       <div class="time">${formatTime12(item.from)} - ${formatTime12(item.to)}</div>
       <div class="sub">${item.sub}</div>
    </div>`;
    })
    .join("");

  if (upcoming) {
    document.getElementById("nextClassDetail").innerText = upcoming.sub;
    document.getElementById("nextClassTime").innerText =
      `${formatTime12(upcoming.from)} - ${formatTime12(upcoming.to)}`;
  } else if (ongoing) {
    document.getElementById("nextClassDetail").innerText = ongoing.sub;
    document.getElementById("nextClassTime").innerText = "Ongoing Now";
  } else {
    document.getElementById("nextClassDetail").innerText = "All Done";
    document.getElementById("nextClassTime").innerText = "See you tomorrow";
  }
}

function openTimetableModal() {
  renderModalTT();
  openModal("timetableModal");
}

function addTimetableEntry() {
  const d = parseInt(document.getElementById("ttDaySelect").value, 10);
  const s = document.getElementById("ttSubInput").value;
  const fH = document.getElementById("ttFromHour").value;
  const fM = document.getElementById("ttFromMin").value;
  const fAP = document.getElementById("ttFromAMPM").value;
  const tH = document.getElementById("ttToHour").value;
  const tM = document.getElementById("ttToMin").value;
  const tAP = document.getElementById("ttToAMPM").value;

  if (s && fH && tH) {
    const to24 = (h, m, ap) => {
      let hh = parseInt(h);
      if (ap === "PM" && hh !== 12) hh += 12;
      if (ap === "AM" && hh === 12) hh = 0;
      return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };
    const fromTime = to24(fH, fM, fAP);
    const toTime = to24(tH, tM, tAP);

    if (editingTTIndex !== null) {
      timetable[editingTTIndex] = {
        day: d,
        sub: s,
        from: fromTime,
        to: toTime,
      };
      editingTTIndex = null;
      document.getElementById("ttAddBtn").innerText = "Add Class";
      document.getElementById("ttEditHint").innerText = "";
    } else {
      timetable.push({ day: d, sub: s, from: fromTime, to: toTime });
    }
    saveData();
    renderModalTT();
    renderTodaySchedule();
    document.getElementById("ttSubInput").value = "";
  }
}

function renderModalTT() {
  const list = document.getElementById("modalTTList");
  const sel = parseInt(document.getElementById("ttDaySelect").value, 10);
  const entries = timetable
    .map((item, i) => ({ ...item, _idx: i }))
    .filter((it) => parseInt(it.day, 10) === sel)
    .sort((a, b) => a.from.localeCompare(b.from));

  const countEl = document.getElementById("classCount");
  if (countEl) countEl.innerText = entries.length;

  if (entries.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--muted); opacity:0.7">
        <i class='bx bx-calendar-plus' style="font-size:3rem; margin-bottom:10px"></i>
        <p>No classes for this day.</p>
        <p style="font-size:0.8rem">Add one above!</p>
      </div>`;
    return;
  }
  list.innerHTML = entries
    .map(
      (it) => `
    <div class="tt-item-card">
      <div class="tt-info">
        <div class="tt-time-disp">
          <i class='bx bx-time-five'></i> ${formatTime12(it.from)} - ${formatTime12(it.to)}
        </div>
        <div class="tt-sub-name">${it.sub}</div>
      </div>
      <div class="tt-actions">
        <i class='bx bx-edit-alt tt-edit-icon' onclick="editTT(${it._idx})"></i>
        <i class='bx bx-trash tt-del-icon' onclick="deleteTT(${it._idx})"></i>
      </div>
    </div>
  `,
    )
    .join("");
}

function editTT(i) {
  const entry = timetable[i];
  editingTTIndex = i;
  document.getElementById("ttDaySelect").value = String(entry.day);
  document.getElementById("ttSubInput").value = entry.sub;
  const [fh, fm] = entry.from.split(":").map(Number);
  const [th, tm] = entry.to.split(":").map(Number);
  document.getElementById("ttFromHour").value = fh % 12 || 12;
  document.getElementById("ttFromMin").value = fm;
  document.getElementById("ttFromAMPM").value = fh >= 12 ? "PM" : "AM";
  document.getElementById("ttToHour").value = th % 12 || 12;
  document.getElementById("ttToMin").value = tm;
  document.getElementById("ttToAMPM").value = th >= 12 ? "PM" : "AM";
  document.getElementById("ttAddBtn").innerHTML =
    "<i class='bx bx-save'></i> Update Class";
}

function deleteTT(i) {
  timetable.splice(i, 1);
  saveData();
  renderModalTT();
  renderTodaySchedule();
}

document
  .getElementById("ttDaySelect")
  .addEventListener("change", renderModalTT);

// --- UTILS ---
function openModal(id) {
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function saveData() {
  localStorage.setItem("subjects", JSON.stringify(subjects));
  localStorage.setItem("timetable", JSON.stringify(timetable));
  localStorage.setItem("appSettings", JSON.stringify(appSettings));
  renderSubjects();
  updateStats();
}

function timeToMinutes(t) {
  const [hh, mm] = (t || "").split(":").map(Number);
  return isNaN(hh) ? 0 : hh * 60 + mm;
}

function formatTime12(t) {
  const [hhRaw, mmRaw] = (t || "").split(":").map(Number);
  if (isNaN(hhRaw)) return t || "";
  const ampm = hhRaw >= 12 ? "PM" : "AM";
  const hh = hhRaw % 12 || 12;
  return `${hh}:${String(mmRaw).padStart(2, "0")} ${ampm}`;
}

function updateStats() {
  let tp = 0,
    tt = 0;
  subjects.forEach((s) => {
    tp += Number(s.present) || 0;
    tt += Number(s.total) || 0;
  });

  const percNum = tt > 0 ? (tp / tt) * 100 : 0;
  const perc = percNum.toFixed(2);
  const target = parseInt(
    document.getElementById("targetSlider").value || "75",
    10,
  );
  const targetFrac = target / 100;

  const percEl = document.getElementById("currPerc");
  percEl.innerText = perc + "%";
  percEl.style.color = percNum >= target ? "var(--success)" : "var(--danger)";

  document.getElementById("tClasses").innerText = tt;
  document.getElementById("tPresent").innerText = tp;
  document.getElementById("tAbsent").innerText = tt - tp;

  // Calculate how many classes can still be missed while staying at/above target
  const leaveInfoEl = document.getElementById("leaveInfo");
  if (!leaveInfoEl) return;

  if (tt === 0) {
    leaveInfoEl.innerText = `No data yet.`;
    return;
  }

  if (percNum >= target) {
    // Solve for n: tp / (tt + n) >= targetFrac  => tt + n <= tp / targetFrac
    const maxTotalAllowed = targetFrac > 0 ? tp / targetFrac : Infinity;
    let allowedMiss = Math.floor(Math.max(0, maxTotalAllowed - tt));
    if (!isFinite(allowedMiss)) {
      leaveInfoEl.innerText = `Target is 0% — no restriction.`;
    } else if (allowedMiss === 0) {
      leaveInfoEl.innerText = `No more leaves allowed to maintain ${target}%`;
    } else {
      leaveInfoEl.innerText = `You can miss ${allowedMiss} more class${allowedMiss > 1 ? "es" : ""} and still keep ${target}%`;
    }
  } else {
    // Need to attend some consecutive classes to reach target
    if (target === 100) {
      // To reach 100% you must have present == total and then attend all future classes
      if (tp === tt) {
        leaveInfoEl.innerText = `Attend upcoming classes without missing any to maintain 100%`;
      } else {
        leaveInfoEl.innerText = `Impossible to reach 100% unless you have perfect attendance from start.`;
      }
    } else {
      const needed = Math.ceil(
        Math.max(0, (targetFrac * tt - tp) / (1 - targetFrac)),
      );
      leaveInfoEl.innerText = `Attend next ${needed} class${needed > 1 ? "es" : ""} to reach ${target}%`;
    }
  }
}

document.getElementById("targetSlider").oninput = function () {
  document.getElementById("targetVal").innerText = this.value + "%";
  updateStats();
};

function exportData() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify({ subjects, timetable, appSettings }));
  const dl = document.createElement("a");
  dl.setAttribute("href", dataStr);
  dl.setAttribute(
    "download",
    `Backup_${new Date().toISOString().slice(0, 10)}.json`,
  );
  document.body.appendChild(dl);
  dl.click();
  dl.remove();
}

function renderCalendar() {
  const now = new Date();
  document.getElementById("monthYear").innerText = now.toLocaleString(
    "default",
    { month: "long" },
  );
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";
  for (let i = 1; i <= days; i++) {
    const d = document.createElement("div");
    d.className =
      i === now.getDate() ? "calendar-day current-day" : "calendar-day";
    d.innerText = i;
    grid.appendChild(d);
  }
}

// Start
updateClock();
renderCalendar();
renderSubjects();
updateStats();
renderTodaySchedule();

// --- AUTH / UMS INTEGRATION ---
const API_BASE = "http://localhost:3000";
let auth = {
  accessToken: localStorage.getItem("accessToken") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
};

function refreshUserArea() {
  const ua = document.getElementById("userArea");
  if (!ua) return;
  if (auth.user) {
    ua.innerHTML = `<div style="display:flex; gap:10px; align-items:center"><span style="font-weight:700">${auth.user.name}</span><button class="edit-main-btn" onclick="logout()">Logout</button></div>`;
  } else {
    ua.innerHTML = `<button id="loginBtn" class="edit-main-btn" onclick="openLoginModal()">Login</button>`;
  }
}

refreshUserArea();

function openLoginModal() {
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginRemember").checked = false;
  openModal("loginModal");
}

async function doLogin() {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value;
  const remember = document.getElementById("loginRemember").checked;
  if (!u || !p) return alert("Enter username and password");

  try {
    const r = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: u, password: p, remember }),
    });
    const data = await r.json();
    if (!r.ok) return alert(data.error || "Login failed");

    auth.accessToken = data.accessToken;
    auth.user = data.user;
    localStorage.setItem("accessToken", auth.accessToken);
    localStorage.setItem("user", JSON.stringify(auth.user));
    closeModal("loginModal");
    refreshUserArea();
    await fetchAttendanceFromServer();
    alert("Login successful");
  } catch (err) {
    console.error("Login error", err);
    alert("Login request failed");
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (e) {}
  auth = { accessToken: null, user: null };
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  refreshUserArea();
  alert("Logged out");
}

async function fetchAttendanceFromServer() {
  if (!auth.accessToken) return;
  try {
    const r = await fetch(`${API_BASE}/api/attendance`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      credentials: "include",
    });

    // if server returned a refreshed token in header, update it
    const newAcc = r.headers.get("x-access-token");
    if (newAcc) {
      auth.accessToken = newAcc;
      localStorage.setItem("accessToken", newAcc);
    }

    const data = await r.json();
    if (!r.ok) return console.error("Attendance error", data);
    // populate attendance into app (best-effort mapping)
    if (data.attendance) {
      const a = data.attendance;
      if (a.present !== undefined && a.total !== undefined) {
        // set totals into the main stats
        const present = Number(a.present) || 0;
        const total = Number(a.total) || 0;
        // distribute into a single synthetic subject called 'UMS'
        const idx = subjects.findIndex((s) => s.name === "UMS");
        if (idx === -1)
          subjects.push({
            name: "UMS",
            present,
            total,
            history: [],
            tasks: [],
          });
        else {
          subjects[idx].present = present;
          subjects[idx].total = total;
        }
        saveData();
        updateStats();
      }
    }
  } catch (err) {
    console.error("fetchAttendance error", err);
  }
}
