let subjects = JSON.parse(localStorage.getItem("subjects")) || [];
let timetable = JSON.parse(localStorage.getItem("timetable")) || [];
let currentEditIdx = null;
let editingTTIndex = null;

const targetSlider = document.getElementById("targetSlider");
const targetVal = document.getElementById("targetVal");

// show percent sign on load
if (targetVal && targetSlider) targetVal.innerText = targetSlider.value + "%";

// Helpers: convert HH:MM <-> minutes and format 12-hour with AM/PM
function timeToMinutes(t) {
  const [hh, mm] = (t || "").split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function formatTime12(t) {
  const [hhRaw, mmRaw] = (t || "").split(":").map(Number);
  if (isNaN(hhRaw) || isNaN(mmRaw)) return t || "";
  const ampm = hhRaw >= 12 ? "PM" : "AM";
  const hh = hhRaw % 12 || 12;
  return `${hh}:${String(mmRaw).padStart(2, "0")} ${ampm}`;
}

let _lastDateStamp = new Date().toDateString();

function updateClock() {
  const now = new Date();
  const nowH = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, "0");
  const secs = String(now.getSeconds()).padStart(2, "0");
  const ampm = nowH >= 12 ? "PM" : "AM";
  const hours12 = nowH % 12 || 12;
  document.getElementById("liveClock").innerText = `${String(hours12).padStart(
    2,
    "0"
  )}:${mins}:${secs} ${ampm}`;

  // If date changed (crossed midnight or timezone change), refresh calendar and schedule immediately
  const todayStamp = now.toDateString();
  if (todayStamp !== _lastDateStamp) {
    _lastDateStamp = todayStamp;
    renderCalendar();
    renderTodaySchedule();
  }

  // update schedule at every minute boundary (keep next-lesson live)
  if (secs === "00") renderTodaySchedule();

  // refresh at fixed 5 AM exactly at HH:00:00 for any daily recalculations
  const refreshHour = 5;
  if (nowH === refreshHour && mins === "00" && secs === "00") {
    renderTodaySchedule();
    renderCalendar();
    renderSubjects();
  }

  // refresh exactly at midnight (12:00 AM) so next-day sessions appear immediately
  if (nowH === 0 && mins === "00" && secs === "00") {
    // reset date stamp and force full refresh
    _lastDateStamp = new Date().toDateString();
    renderTodaySchedule();
    renderCalendar();
    renderSubjects();
  }
}

setInterval(updateClock, 1000);

function renderCalendar() {
  const now = new Date();
  document.getElementById("monthYear").innerText = `${now.toLocaleString(
    "default",
    { month: "long" }
  )} ${now.getFullYear()}`;
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

function openModal(id) {
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function confirmAddSubject() {
  const input = document.getElementById("subjectNameInput");
  if (!input) return;
  const name = (input.value || "").trim();
  if (!name) return;
  subjects.push({ name: name, present: 0, total: 0 });
  saveData();
  input.value = "";
  closeModal("subjectModal");
}

let subjectToDelete = null;

function deleteSubject(idx) {
  subjectToDelete = idx;
  document.getElementById(
    "deleteSubjectName"
  ).innerText = `Are you sure you want to delete "${subjects[idx].name}"?`;
  openModal("deleteConfirmationModal");
}

function confirmDeleteSubject() {
  if (subjectToDelete !== null) {
    subjects.splice(subjectToDelete, 1);
    saveData();
    subjectToDelete = null;
  }
  closeModal("deleteConfirmationModal");
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

function markAttendance(idx, isPresent) {
  subjects[idx].total++;
  if (isPresent) subjects[idx].present++;
  saveData();
}

function saveData() {
  localStorage.setItem("subjects", JSON.stringify(subjects));
  renderSubjects();
  updateStats();
}

function renderSubjects() {
  const list = document.getElementById("subjectList");
  list.innerHTML = subjects
    .map((s, i) => {
      const p = s.total > 0 ? ((s.present / s.total) * 100).toFixed(2) : "0.00";
      return `
      <div class="subject-item">
        <div style="max-width:60%;">
          <div style="font-weight:600; font-size:1rem; overflow:hidden; text-overflow:ellipsis;">${s.name}</div>
          <div class="subject-stats" style="color:var(--muted); font-size:0.9rem; display:flex; gap:12px; align-items:center; margin-top:6px">
            <span>Present <strong style="font-weight:700">${s.present}</strong></span>
            <span>Total <strong style="font-weight:700">${s.total}</strong> Lectures</span>
            <span>•</span>
            <span>${p}%</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="del-btn-ui" onclick="deleteSubject(${i})">Del</span>
          <span class="edit-btn-ui" onclick="openEditAttendance(${i})">Edit</span>
          <button class="btn-p" onclick="markAttendance(${i},true)">P</button>
          <button class="btn-a" onclick="markAttendance(${i},false)">A</button>
        </div>
      </div>`;
    })
    .join("");
}

// Build 24-hour HH:MM string from 12-hour inputs
function build24(hhId, mmId, ampmId) {
  const hhEl = document.getElementById(hhId);
  const mmEl = document.getElementById(mmId);
  const ampmEl = document.getElementById(ampmId);
  if (!hhEl || !mmEl || !ampmEl) return "";
  let hh = parseInt(hhEl.value, 10);
  let mm = parseInt(mmEl.value, 10);
  const ampm = (ampmEl.value || "AM").toUpperCase();
  if (isNaN(hh) || isNaN(mm)) return "";
  if (hh < 1) hh = 1;
  if (hh > 12) hh = hh % 12;
  if (mm < 0) mm = 0;
  if (mm > 59) mm = mm % 60;
  if (hh === 12 && ampm === "AM") hh = 0;
  if (ampm === "PM" && hh !== 12) hh = hh + 12;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function openTimetableModal() {
  renderModalTT();
  openModal("timetableModal");
}
function addTimetableEntry() {
  const d = parseInt(document.getElementById("ttDaySelect").value, 10);
  const s = document.getElementById("ttSubInput").value;
  const f = build24("ttFromHour", "ttFromMin", "ttFromAMPM");
  const t = build24("ttToHour", "ttToMin", "ttToAMPM");
  if (s && f && t) {
    if (editingTTIndex !== null && typeof editingTTIndex === "number") {
      timetable[editingTTIndex] = { day: d, sub: s, from: f, to: t };
      editingTTIndex = null;
      const btn = document.getElementById("ttAddBtn");
      if (btn) btn.innerText = "Add Class";
      const hint = document.getElementById("ttEditHint");
      if (hint) hint.innerText = "";
    } else {
      timetable.push({ day: d, sub: s, from: f, to: t });
    }
    localStorage.setItem("timetable", JSON.stringify(timetable));
    renderModalTT();
    renderTodaySchedule();
    document.getElementById("ttSubInput").value = "";
    document.getElementById("ttFromHour").value = "";
    document.getElementById("ttFromMin").value = "";
    document.getElementById("ttFromAMPM").value = "AM";
    document.getElementById("ttToHour").value = "";
    document.getElementById("ttToMin").value = "";
    document.getElementById("ttToAMPM").value = "AM";
    // keep the timetable modal open after adding/updating so user can add multiple entries
    const subEl = document.getElementById("ttSubInput");
    if (subEl) subEl.focus();
  }
}

function renderModalTT() {
  const list = document.getElementById("modalTTList");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const sel = parseInt(document.getElementById("ttDaySelect").value, 10);
  const entries = timetable
    .map((item, i) => ({ ...item, _idx: i }))
    .filter((it) => parseInt(it.day, 10) === sel)
    .sort((a, b) => a.from.localeCompare(b.from));

  if (entries.length === 0) {
    list.innerHTML = `<p style="color:var(--muted); font-size:.9rem; text-align:center">No classes for ${days[sel]}.</p>`;
    return;
  }

  list.innerHTML = `
    <div class="tt-table">
      ${entries
        .map(
          (it) => `
        <div class="tt-row">
          <div>
            <div class="time">${formatTime12(it.from)} - ${formatTime12(
            it.to
          )}</div>
            <div class="sub">${it.sub}</div>
          </div>
          <div>
            <button class="edit-btn-ui" onclick="editTT(${
              it._idx
            })">Edit</button>
            <button class="del-btn-ui" onclick="deleteTT(${
              it._idx
            })">Delete</button>
          </div>
        </div>`
        )
        .join("")}
    </div>`;
}

// Populate timetable inputs for editing an entry
function editTT(i) {
  const entry = timetable[i];
  if (!entry) return;
  editingTTIndex = i;
  document.getElementById("ttDaySelect").value = String(entry.day);
  document.getElementById("ttSubInput").value = entry.sub;
  // parse 24h HH:MM into 12h pieces
  const [fh, fm] = entry.from.split(":").map(Number);
  const [th, tm] = entry.to.split(":").map(Number);
  const fAMP = fh >= 12 ? "PM" : "AM";
  const tAMP = th >= 12 ? "PM" : "AM";
  let fh12 = fh % 12 || 12;
  let th12 = th % 12 || 12;
  document.getElementById("ttFromHour").value = String(fh12);
  document.getElementById("ttFromMin").value = String(fm).padStart(2, "0");
  document.getElementById("ttFromAMPM").value = fAMP;
  document.getElementById("ttToHour").value = String(th12);
  document.getElementById("ttToMin").value = String(tm).padStart(2, "0");
  document.getElementById("ttToAMPM").value = tAMP;
  // change Add button to Update
  const btn = document.getElementById("ttAddBtn");
  if (btn) btn.innerText = "Update Class";
  const hint = document.getElementById("ttEditHint");
  if (hint) hint.innerText = "Editing entry — click Update to save";
}

function deleteTT(i) {
  timetable.splice(i, 1);
  localStorage.setItem("timetable", JSON.stringify(timetable));
  renderModalTT();
  renderTodaySchedule();
}

function renderTodaySchedule() {
  const now = new Date();
  const today = now.getDay();
  const daysFull = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayEl = document.getElementById("todayDay");
  if (dayEl) dayEl.innerText = daysFull[today];
  const scheduleList = document.getElementById("todaySchedule");
  const classes = timetable
    .filter((item) => parseInt(item.day, 10) === today)
    .sort((a, b) => a.from.localeCompare(b.from));

  if (classes.length === 0) {
    scheduleList.innerHTML =
      '<p style="color:var(--muted); font-size:0.9rem; text-align:center;">No classes today.</p>';
    document.getElementById("nextClassDetail").innerText = "Free Day!";
    document.getElementById("nextClassTime").innerText = "Enjoy.";
    return;
  }

  const nowM = now.getHours() * 60 + now.getMinutes();
  // If current time falls within a class, mark it as ongoing and show next as "Ongoing"
  const ongoing = classes.find(
    (item) => timeToMinutes(item.from) <= nowM && timeToMinutes(item.to) > nowM
  );
  const upcoming = ongoing
    ? null
    : classes.find((item) => timeToMinutes(item.from) > nowM);

  scheduleList.innerHTML = `
    <div class="tt-table">
      ${classes
        .map((item) => {
          const isO =
            ongoing &&
            item.from === ongoing.from &&
            item.to === ongoing.to &&
            item.sub === ongoing.sub;
          return `
        <div class="tt-row${isO ? " ongoing" : ""}">
          <div>
            <div class="time">${formatTime12(item.from)} - ${formatTime12(
            item.to
          )}</div>
            <div class="sub" style="font-weight:600">${item.sub}</div>
          </div>
        </div>`;
        })
        .join("")}
    </div>`;

  if (upcoming) {
    document.getElementById("nextClassDetail").innerText = upcoming.sub;
    document.getElementById("nextClassTime").innerText = `${formatTime12(
      upcoming.from
    )} - ${formatTime12(upcoming.to)}`;
  } else {
    if (ongoing) {
      document.getElementById("nextClassDetail").innerText =
        ongoing.sub + " (Ongoing)";
      document.getElementById("nextClassTime").innerText = `${formatTime12(
        ongoing.from
      )} - ${formatTime12(ongoing.to)}`;
    } else {
      // No more classes today; show when next session will be updated (midnight)
      document.getElementById("nextClassDetail").innerText =
        "Next session will update at 12:00 AM";
      document.getElementById("nextClassTime").innerText = "";
    }
  }
}

// ensure modal day selector updates modal list on change
const ttSel = document.getElementById("ttDaySelect");
if (ttSel) ttSel.addEventListener("change", renderModalTT);

function updateStats() {
  let tp = 0,
    tt = 0;
  subjects.forEach((s) => {
    tp += s.present;
    tt += s.total;
  });
  const perc = tt > 0 ? ((tp / tt) * 100).toFixed(2) : "0.00";
  const target = parseInt(targetSlider.value);
  document.getElementById("currPerc").innerText = perc + "%";
  document.getElementById("tClasses").innerText = tt;
  document.getElementById("tPresent").innerText = tp;
  document.getElementById("tAbsent").innerText = tt - tp;
  document.getElementById("currPerc").style.color =
    parseFloat(perc) >= target ? "var(--success)" : "var(--danger)";

  // Calculate how many classes user can still miss and warning if below target
  const leaveInfoEl = document.getElementById("leaveInfo");
  if (leaveInfoEl) {
    if (tt === 0) {
      leaveInfoEl.innerText = "No classes recorded yet.";
    } else {
      // maximum additional missed classes x such that 100*tp/(tt + x) >= target
      const maxMissRaw = (tp * 100) / target - tt;
      const maxMiss = Math.max(0, Math.floor(maxMissRaw));

      if (parseFloat(perc) >= target) {
        leaveInfoEl.innerText = `You can miss up to ${maxMiss} class${
          maxMiss === 1 ? "" : "es"
        } and still remain at or above ${target}%`;
      } else {
        // compute how many consecutive attends needed to reach target
        if (target === 100) {
          leaveInfoEl.innerText =
            "Target 100% is strict — you must avoid any future absence to reach it.";
        } else {
          const need = Math.ceil(
            ((target / 100) * tt - tp) / (1 - target / 100)
          );
          const needSafe = Math.max(0, need);
          leaveInfoEl.innerText = `Warning: below target. Attend the next ${needSafe} class${
            needSafe === 1 ? "" : "es"
          } to reach ${target}%`;
        }
      }
    }
  }
}

targetSlider.oninput = function () {
  targetVal.innerText = this.value + "%";
  updateStats();
};

// scroll controls removed

updateClock();
renderCalendar();
renderSubjects();
updateStats();
renderTodaySchedule();

// Schedule a precise refresh at the next midnight and repeat daily.
function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMid = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  const ms = nextMid.getTime() - now.getTime();
  setTimeout(() => {
    _lastDateStamp = new Date().toDateString();
    renderTodaySchedule();
    renderCalendar();
    renderSubjects();
    // schedule next midnight
    scheduleMidnightRefresh();
  }, ms);
}

// start the midnight scheduler
scheduleMidnightRefresh();
