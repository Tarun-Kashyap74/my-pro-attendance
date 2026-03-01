// --- INITIALIZATION ---
const defaultSubjectNames = [
  "Advance Java Programming Practical",
  "Advance Java Programming Theory",
  "Data Communication And Networking Practical",
  "Data Communication And Networking Theory",
  "Comprehensive Assessment",
  "Graphic Programming Practical",
  "Graphic Programming Theory",
  "Cloud Computing Practical",
  "Cloud Computing Theory",
  "English And Mathematical Aptitude",
  "Aptitude Training",
  "Placement Training",
];

let subjects = JSON.parse(localStorage.getItem("subjects"));
if (!subjects || subjects.length === 0) {
  subjects = defaultSubjectNames.map((name) => ({
    name: name,
    present: 0,
    total: 0,
    history: [],
    tasks: [],
  }));
}
let timetable = JSON.parse(localStorage.getItem("timetable")) || [];
let appSettings = JSON.parse(localStorage.getItem("appSettings")) || {
  themePrimary: "#6c5ce7",
  themeAccent: "#a29bfe",
  darkMode: false,
  academicMode: false
};

subjects.forEach((s) => {
  if (!s.history) s.history = [];
  if (!s.tasks) s.tasks = [];
});

// Ensure property exists for existing users
if (typeof appSettings.academicMode === 'undefined') appSettings.academicMode = false;

applyTheme(
  appSettings.themePrimary,
  appSettings.themeAccent,
  appSettings.darkMode,
);

let currentEditIdx = null;
let editingTTIndex = null;
let currentTaskSubIdx = null;
let _lastDateStamp = new Date().toDateString();
let notifiedClasses = new Set();
let sortLowFirst = false;
let currentStreak = 0;

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
  // Feature: Academic Comeback Mode overrides
  if (appSettings.academicMode) {
    p = "#ff4757"; // Serious Red
    a = "#ff6b81";
    isDark = true; // Force Dark Mode
  }

  document.documentElement.style.setProperty("--primary", p);
  const toggleBtn = document.getElementById("darkModeToggle");
  const acBtn = document.getElementById("academicModeToggle");

  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
    if (toggleBtn) toggleBtn.checked = true;
  } else {
    document.documentElement.removeAttribute("data-theme");
    if (toggleBtn) toggleBtn.checked = false;
  }
  if (acBtn) acBtn.checked = appSettings.academicMode;
}

function toggleAcademicMode() {
  appSettings.academicMode = !appSettings.academicMode;
  applyTheme(appSettings.themePrimary, appSettings.themeAccent, appSettings.darkMode);
  saveData();
  renderSubjects(); // Re-render to hide/show badges
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
  const titles = { home: "Home", subjects: "Subjects" };
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
    renderTodaySchedule();
  }
  if (secs === "00") renderTodaySchedule();
  if (secs === "00" || secs === "30") checkNotifications();
  
  // Feature 5: Forgot to Mark Reminder (Check after 6 PM)
  if (now.getHours() >= 18 && !sessionStorage.getItem("remindedToday")) {
    checkDailyReminder();
  }
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
  const targetFrac = globalTarget / 100;

  // Feature 3: Sorting Logic
  // We map subjects to include their original index so buttons work correctly after sorting
  let displaySubjects = subjects.map((s, i) => ({ ...s, _origIdx: i }));

  if (sortLowFirst) {
    displaySubjects.sort((a, b) => {
      const pa = a.total > 0 ? a.present / a.total : 1;
      const pb = b.total > 0 ? b.present / b.total : 1;
      return pa - pb; // Ascending (Lowest first)
    });
  }

  list.innerHTML = displaySubjects
    .map((s, i) => {
      const p = s.total > 0 ? ((s.present / s.total) * 100).toFixed(2) : "0.00";
      const pendingTasks = s.tasks ? s.tasks.filter((t) => !t.done).length : 0;

      // Smart Badge Logic
      let smartBadge = "";
      if (s.total > 0) {
        const currentPerc = s.present / s.total;
        if (currentPerc >= targetFrac && !appSettings.academicMode) {
          const maxTotal = targetFrac > 0 ? s.present / targetFrac : Infinity;
          const canBunk = Math.floor(maxTotal - s.total);
          if (canBunk > 0)
            smartBadge = `<span style="font-size:0.65rem; background:var(--success); color:white; padding:2px 8px; border-radius:10px; margin-left:6px; vertical-align:middle;">Safe to Bunk ${canBunk}</span>`;
        } else {
          const needed = Math.ceil(
            (targetFrac * s.total - s.present) / (1 - targetFrac),
          );
          if (needed > 0)
            smartBadge = `<span style="font-size:0.65rem; background:var(--danger); color:white; padding:2px 8px; border-radius:10px; margin-left:6px; vertical-align:middle;">Attend Next ${needed}</span>`;
        }
      }

      return `
      <div class="subject-item">
        <div class="subject-info" onclick="openTaskModal(${s._origIdx})">
          <strong>${s.name} ${pendingTasks > 0 ? `<span style="font-size:0.7rem; background:var(--danger); color:white; padding:2px 6px; border-radius:10px">${pendingTasks}</span>` : ""} ${smartBadge}</strong>
          <div class="subject-stats">
            Attendance: <span style="color:${parseFloat(p) >= globalTarget ? "var(--success)" : "var(--danger)"}; font-weight:bold">${p}%</span> 
            (${s.present}/${s.total})
          </div>
        </div>
        <div class="subject-actions">
          <button class="btn-icon btn-p" onclick="markAttendance(${s._origIdx},true)"><i class='bx bx-check'></i></button>
          <button class="btn-icon btn-a" onclick="markAttendance(${s._origIdx},false)"><i class='bx bx-x'></i></button>
          <button class="btn-icon btn-more" onclick="openEditAttendance(${s._origIdx})"><i class='bx bx-dots-vertical-rounded'></i></button>
          <button class="btn-icon btn-more" onclick="deleteSubject(${s._origIdx})" style="color:var(--danger)"><i class='bx bx-trash'></i></button>
        </div>
      </div>`;
    })
    .join("");
}

function toggleSort() {
  sortLowFirst = !sortLowFirst;
  const btn = document.getElementById("sortBtn");
  if (sortLowFirst) {
    btn.style.background = "var(--primary)";
    btn.style.color = "white";
  } else {
    btn.style.background = "";
    btn.style.color = "";
  }
  renderSubjects();
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
  const container = document.getElementById("editSubName");
  container.innerHTML = `
    <label style="display:block; font-size:0.8rem; color:var(--muted); font-weight:700; margin-bottom:5px">Subject Name</label>
    <input type="text" id="editSubNameInput" class="styled-input" style="margin-top:0; margin-bottom:10px">
  `;
  document.getElementById("editSubNameInput").value = subjects[idx].name;
  document.getElementById("manualPresent").value = subjects[idx].present;
  document.getElementById("manualTotal").value = subjects[idx].total;
  openModal("editAttendanceModal");
}

function saveManualAttendance() {
  const nameInput = document.getElementById("editSubNameInput");
  if (nameInput && nameInput.value.trim()) {
    subjects[currentEditIdx].name = nameInput.value.trim();
  }
  subjects[currentEditIdx].present =
    parseInt(document.getElementById("manualPresent").value) || 0;
  subjects[currentEditIdx].total =
    parseInt(document.getElementById("manualTotal").value) || 0;
  saveData();
  closeModal("editAttendanceModal");
}

function openHistoryModal() {
  const history = subjects[currentEditIdx].history || [];
  const list = document.getElementById("historyList");
  if (history.length === 0) {
    list.innerHTML =
      "<p style='text-align:center; color:var(--muted); padding:10px'>No history available.</p>";
  } else {
    // Show newest first
    list.innerHTML = history
      .slice()
      .reverse()
      .map((h) => {
        const dateObj = new Date(h.date);
        const dateStr =
          dateObj.toLocaleDateString() +
          " " +
          dateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        const isP = h.status === "P";
        return `
        <div class="hist-item">
          <span class="hist-date">${dateStr}</span>
          <span class="hist-status ${isP ? "status-p" : "status-a"}">${isP ? "Present" : "Absent"}</span>
        </div>
      `;
      })
      .join("");
  }
  openModal("historyModal");
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
    .map((t, i) => {
      let dateHtml = "";
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isUrgent = d < today || d.getTime() === today.getTime();
        dateHtml = `<div class="task-meta ${isUrgent ? "task-due urgent" : "task-due"}"><i class='bx bx-calendar'></i> ${t.dueDate}</div>`;
      }
      return `
    <div class="task-item ${t.done ? "completed" : ""}" onclick="toggleTask(${i})">
      <div style="flex:1">
        <span>${t.done ? '<i class="bx bx-checkbox-checked"></i>' : '<i class="bx bx-checkbox"></i>'} &nbsp; ${t.text}</span>
        ${dateHtml}
      </div>
      <i class='bx bx-x' style="font-size:1.2rem; color:var(--muted)" onclick="deleteTask(event, ${i})"></i>
    </div>
  `;
    })
    .join("");
}

function addNewTask() {
  const input = document.getElementById("newTaskInput");
  const dateInput = document.getElementById("newTaskDate");
  const val = input.value.trim();
  if (!val) return;
  subjects[currentTaskSubIdx].tasks.push({
    text: val,
    done: false,
    dueDate: dateInput.value,
  });
  input.value = "";
  dateInput.value = "";
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

      // Quick Mark Buttons for Ongoing Class
      let quickAction = "";
      if (isO) {
        const subIdx = subjects.findIndex((s) => s.name === item.sub);
        if (subIdx !== -1) {
          quickAction = `
            <div style="margin-top:12px; display:flex; gap:10px; padding-top:10px; border-top:1px solid rgba(0,0,0,0.05)">
               <button onclick="markAttendance(${subIdx}, true); renderTodaySchedule()" class="btn-p" style="flex:1; height:38px; border-radius:12px; font-weight:700; font-size:0.9rem">Present</button>
               <button onclick="markAttendance(${subIdx}, false); renderTodaySchedule()" class="btn-a" style="flex:1; height:38px; border-radius:12px; font-weight:700; font-size:0.9rem">Absent</button>
            </div>`;
        }
      }

      return `<div class="tt-row${isO ? " ongoing" : ""}">
       <div style="width:100%">
         <div style="display:flex; justify-content:space-between; align-items:center">
            <div class="time">${formatTime12(item.from)} - ${formatTime12(item.to)}</div>
            <div class="sub">${item.sub}</div>
         </div>
         ${quickAction}
       </div>
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

// Remove Sunday from dropdown
const ttDaySelect = document.getElementById("ttDaySelect");
if (ttDaySelect) {
  const sunOption = ttDaySelect.querySelector("option[value='0']");
  if (sunOption) sunOption.remove();
}

// --- NOTIFICATIONS ---
function checkNotifications() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const day = now.getDay();
  const nowM = now.getHours() * 60 + now.getMinutes();

  timetable.forEach((t) => {
    if (parseInt(t.day) !== day) return;
    const startM = timeToMinutes(t.from);
    const diff = startM - nowM;
    // Notify if 10 mins or less before class, and class hasn't started yet
    if (diff <= 10 && diff > 0) {
      const key = `${day}-${t.sub}-${t.from}`; // Unique ID for this class instance
      if (!notifiedClasses.has(key)) {
        new Notification(`Upcoming Class: ${t.sub}`, {
          body: `Starts in ${diff} minutes at ${formatTime12(t.from)}`,
          icon: "graduation-cap.png",
        });
        notifiedClasses.add(key);
      }
    }
  });
}

// --- REMINDER ---
function checkDailyReminder() {
  const today = new Date().getDay();
  const todayClasses = timetable.filter((t) => parseInt(t.day) === today);
  
  if (todayClasses.length === 0) return;

  // Check if any attendance has been marked for today
  const todayDateStr = new Date().toDateString();
  let markedToday = false;

  // We check if ANY subject has a history entry for today. 
  // A more specific check would be to see if the SPECIFIC subjects in timetable have entries.
  for (let s of subjects) {
    if (s.history.some(h => new Date(h.date).toDateString() === todayDateStr)) {
      markedToday = true;
      break;
    }
  }

  if (!markedToday) {
    openModal("reminderModal");
    sessionStorage.setItem("remindedToday", "true");
  }
}

// --- SICK DAY ---
function confirmSickDay() {
  const today = new Date().getDay();
  const todayClasses = timetable.filter((t) => parseInt(t.day) === today);
  
  if (todayClasses.length === 0) {
    closeModal("sickDayModal");
    return;
  }

  todayClasses.forEach(cls => {
    const subIdx = subjects.findIndex(s => s.name === cls.sub);
    if (subIdx !== -1) {
      markAttendance(subIdx, false); // Mark Absent
    }
  });

  saveData();
  closeModal("sickDayModal");
  renderTodaySchedule();
}

// --- BUNK CALCULATOR ---
function openBunkModal() {
  const sel = document.getElementById("bunkSubjectSelect");
  sel.innerHTML = "";
  const aggOpt = document.createElement("option");
  aggOpt.value = "agg";
  aggOpt.innerText = "Overall Percentage";
  sel.appendChild(aggOpt);
  subjects.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.innerText = s.name;
    sel.appendChild(opt);
  });
  document.getElementById("bunkResult").innerHTML =
    "Select options and calculate.";
  document.getElementById("bunkCount").value = "";
  closeModal("settingsModal");
  openModal("bunkModal");
}

function calculateBunk() {
  const idx = document.getElementById("bunkSubjectSelect").value;
  const action = document.getElementById("bunkAction").value; // "bunk" or "attend"
  const count = parseInt(document.getElementById("bunkCount").value) || 0;
  const resEl = document.getElementById("bunkResult");

  if (count <= 0) {
    resEl.innerHTML =
      "<span style='color:var(--danger)'>Please enter a valid number.</span>";
    return;
  }

  let p, t, currentPerc;

  if (idx === "agg") {
    p = subjects.reduce((acc, s) => acc + (Number(s.present) || 0), 0);
    t = subjects.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    currentPerc = t > 0 ? ((p / t) * 100).toFixed(2) : 0;
  } else {
    const s = subjects[idx];
    p = s.present;
    t = s.total;
    currentPerc = s.total > 0 ? ((s.present / s.total) * 100).toFixed(2) : 0;
  }

  if (action === "bunk") {
    t += count;
  } else {
    p += count;
    t += count;
  }

  const newPerc = t > 0 ? ((p / t) * 100).toFixed(2) : 0;

  let color = parseFloat(newPerc) >= 75 ? "var(--success)" : "var(--danger)";

  resEl.innerHTML = `
    <div style="font-size:0.9rem; color:var(--muted)">Current: ${currentPerc}%</div>
    <div style="font-size:2rem; color:${color}; font-weight:800; margin:5px 0">${newPerc}%</div>
    <div style="font-size:0.85rem; color:var(--text)">
      If you ${action} next ${count} classes,<br>
      Total: ${p}/${t}
    </div>
  `;
}

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

  // Feature 4: Streak Calculation
  // Logic: Consecutive days in history where NO "Absent" was recorded.
  const historyByDate = {};
  subjects.forEach((s) => {
    s.history.forEach((h) => {
      const d = new Date(h.date).toDateString();
      if (!historyByDate[d]) historyByDate[d] = { p: 0, a: 0 };
      if (h.status === "P") historyByDate[d].p++;
      else historyByDate[d].a++;
    });
  });

  const sortedDates = Object.keys(historyByDate).sort((a, b) => new Date(b) - new Date(a));
  let streak = 0;
  const todayStr = new Date().toDateString();

  for (let d of sortedDates) {
    if (d === todayStr && historyByDate[d].a === 0 && historyByDate[d].p === 0) continue; // Skip today if empty
    if (historyByDate[d].a > 0) break; // Streak broken by absent
    if (historyByDate[d].p > 0) streak++;
  }

  currentStreak = streak; // Store global
  document.getElementById("streakVal").innerText = streak + " Day Streak";
  document.getElementById("streakBadge").style.display = streak > 0 ? "flex" : "none";
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

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.subjects && data.timetable) {
        localStorage.setItem("subjects", JSON.stringify(data.subjects));
        localStorage.setItem("timetable", JSON.stringify(data.timetable));
        if (data.appSettings)
          localStorage.setItem("appSettings", JSON.stringify(data.appSettings));
        alert("Data restored successfully!");
        location.reload();
      } else {
        alert("Invalid backup file.");
      }
    } catch (err) {
      alert("Error reading file.");
    }
  };
  reader.readAsText(file);
}

// Start
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

updateClock();
renderSubjects();
updateStats();
renderTodaySchedule();
