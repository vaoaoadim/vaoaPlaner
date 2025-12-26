// script.js
const weekEl = document.getElementById("week");
const weekStartInput = document.getElementById("weekStart");
const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");

const barCanvas = document.getElementById("barChart");
const pieCanvas = document.getElementById("pieChart");
const summaryEl = document.getElementById("summary");
const body = document.body;

// Panels
const analyticsContainer = document.getElementById("analytics-container");
const habitsContainer = document.getElementById("habits-container");
const calendarContainer = document.getElementById("calendar-container");
const historyContainer = document.getElementById("history-container");
const historyList = document.getElementById("history-list");

// Buttons
const btnStats = document.getElementById("toggleAnalytics");
const btnHabits = document.getElementById("toggleHabits");
const btnCalendar = document.getElementById("toggleCalendar");
const btnWeeklyAnalytics = document.getElementById("btnWeeklyAnalytics");
const btnThemeToggle = document.getElementById("btnThemeToggle");

const closeButtons = document.querySelectorAll(".close-panel");
const bottomControls = document.querySelector(".bottom-controls");

// Track the currently viewed month in the calendar
let calendarViewDate = new Date();

// Constants
const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const SHORT_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const ENERGY = ["⚡", "⚡⚡", "⚡⚡⚡", "⚡⚡⚡⚡"];
const MOOD = ["🙂", "😐", "😡", "😞"];
const MOOD_SCORES = { "🙂": 4, "😐": 3, "😡": 2, "😞": 1 };

// New Constants for Selection Features
const SLEEP_OPTIONS = ["1ч", "2ч", "3ч", "4ч", "5ч", "6ч", "7ч", "8ч", "9ч", "10ч", "11ч", "12ч+"];
const HABIT_OPTIONS = [
  "🏋️",
  "💧",
  "🏃",
  "📚",
  "🧘",
  "🥗",
  "📵",
  "🚭",
  "🧹",
  "🙏",
  "💻"
];

// CALENDAR STICKERS CONSTANT (Added for the modification)
const CALENDAR_STICKERS = [
  "✈️", "🚗", "🚂", "🏠", "💼",
  "💊", "🏋️", "🎉", "🎂", "❤️",
  "⭐", "💰", "🛒", "📚", "🎮",
  "🏖️", "🎬", "🎤", "🐾", "🍔"
];

// --- HELPER: Get Monday of the Week ---
// Ensures any date selected maps to the same Monday "Key"
function getISOWeekMonday(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay(); // 0 is Sunday
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  
  const monday = new Date(date);
  monday.setDate(diff);
  
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// State initialization
let state = JSON.parse(localStorage.getItem("planer")) || {};

// --- MIGRATION: Normalize Keys to Mondays ---
// This runs once to fix any existing messy data where weeks were saved under random days
if (state.weeks) {
  const normalizedWeeks = {};
  Object.keys(state.weeks).sort().forEach(key => {
    const monday = getISOWeekMonday(key);
    // Move data to the calculated Monday key.
    // If the specific key IS the Monday, it takes precedence over others (e.g. overwrites a Tuesday entry)
    if (!normalizedWeeks[monday] || key === monday) {
        normalizedWeeks[monday] = state.weeks[key];
    }
  });
  state.weeks = normalizedWeeks;
  localStorage.setItem("planer", JSON.stringify(state));
}

// --- MIGRATION LOGIC FOR MULTI-WEEK SUPPORT (Legacy) ---
if (!state.weeks) {
  state.weeks = {}; 
  if (state.weekStart && state.days) {
    const mondayKey = getISOWeekMonday(state.weekStart);
    state.weeks[mondayKey] = {
      days: state.days,
      habits: state.habits || []
    };
  }
  if (state.history && state.history.length > 0) {
    state.history.forEach(h => {
      const histMonday = getISOWeekMonday(h.weekStart);
      if (!state.weeks[histMonday]) {
        state.weeks[histMonday] = {
          days: h.days,
          habits: h.habits || []
        };
      }
    });
  }
  state.history = []; 
}

// Ensure default structures
if (!state.calendar) state.calendar = {};
if (!state.theme) state.theme = 'light';

// TWEAK 1: Remove auto-filled date default
// We strictly rely on user input now.
/*
if (!state.weekStart) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  state.weekStart = getISOWeekMonday(`${y}-${m}-${d}`);
} else {
*/
    // If a weekStart exists in storage, ensure it's normalized, but we won't force it into the input later
    if (state.weekStart) {
        state.weekStart = getISOWeekMonday(state.weekStart);
    }
/* } */

if (!state.days) state.days = [];
if (!state.habits) state.habits = [];

// Apply Theme immediately
if (state.theme === 'dark') {
  body.classList.add('dark-theme');
}

// --- SAVE SYSTEM ---
function save() {
  // Ensure we are saving to the Monday key
  if (state.weekStart) {
    state.weeks[state.weekStart] = {
      days: state.days,
      habits: state.habits
    };
  }
  localStorage.setItem("planer", JSON.stringify(state));
}

// --- CORE PLANNER LOGIC ---

function initWeek() {
  if (!weekStartInput.value) return;
  
  // 1. Save the week we are leaving BEFORE switching
  // state.weekStart holds the OLD week key at this point
  save();

  // 2. Get the new requested date
  const rawPick = weekStartInput.value;
  // 3. Calculate the Monday for that date
  const newMonday = getISOWeekMonday(rawPick);

  // 4. Update State and UI to snap to Monday
  state.weekStart = newMonday;
  weekStartInput.value = newMonday; // Visual snap
  
  // Update the calendar view to match the selected week
  calendarViewDate = new Date(newMonday);

  if (state.weeks[newMonday]) {
    // Load existing week
    const weekData = state.weeks[newMonday];
    state.days = weekData.days;
    state.habits = weekData.habits || [];
  } else {
    // Create new week
    const start = new Date(newMonday);
    state.days = DAYS.map((d, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return {
        date: date.toISOString(),
        tasks: [],
        energy: "",
        mood: "",
        sleep: "",
        note: ""
      };
    });

    // Smart Habits: Carry over habit names from the most recent previous week
    const sortedWeeks = Object.keys(state.weeks).sort();
    const prevWeekKey = sortedWeeks.filter(k => k < newMonday).pop();
    
    let baseHabits = [];
    if (prevWeekKey) {
      baseHabits = state.weeks[prevWeekKey].habits || [];
    } else if (state.habits && state.habits.length > 0) {
      baseHabits = state.habits;
    }

    state.habits = baseHabits.map(h => ({
      name: h.name,
      checks: [false, false, false, false, false, false, false]
    }));
  }
  
  save(); 
  render();
}

function shiftWeek(daysToAdd) {
  // Logic works because adding 7 days to a Monday gives the next Monday
  // Only shift if a date is actually selected
  if (!weekStartInput.value) return;

  const current = new Date(weekStartInput.value);
  current.setDate(current.getDate() + daysToAdd);
  const y = current.getFullYear();
  const m = String(current.getMonth() + 1).padStart(2, '0');
  const d = String(current.getDate()).padStart(2, '0');
  
  weekStartInput.value = `${y}-${m}-${d}`;
  initWeek();
}

prevWeekBtn.onclick = () => shiftWeek(-7);
nextWeekBtn.onclick = () => shiftWeek(7);

function render() {
  weekEl.innerHTML = "";
  let totalTasks = 0;
  let completedTasks = 0;
  let dailyProgress = [];

  state.days.forEach((day, i) => {
    const dayEl = document.createElement("div");
    dayEl.className = "day";

    const done = day.tasks.filter(t => t.done).length;
    totalTasks += day.tasks.length;
    completedTasks += done;
    const percent = day.tasks.length ? Math.round(done / day.tasks.length * 100) : 0;
    dailyProgress.push(percent);

    // Updated template with SLEEP SELECTOR
    dayEl.innerHTML = `
      <h3>${DAYS[i]}</h3>
      <div class="progress">Выполнено: ${percent}%</div>
      <div class="tasks"></div>
      <button class="add-task-btn">Добавить задачу</button>
      <div class="meta">
        <select class="energy">
          <option value="">Энергия</option>
          ${ENERGY.map(e => `<option ${day.energy===e?"selected":""}>${e}</option>`).join("")}
        </select>
        <select class="mood">
          <option value="">Настроение</option>
          ${MOOD.map(m => `<option ${day.mood===m?"selected":""}>${m}</option>`).join("")}
        </select>
        <select class="sleep">
          <option value="">Сон</option>
          ${SLEEP_OPTIONS.map(s => `<option ${day.sleep===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <textarea rows="1" placeholder="Мысли / урок дня" class="note-area">${day.note || ''}</textarea>
      </div>
    `;

    // Render Tasks
    const tasksEl = dayEl.querySelector(".tasks");
    day.tasks.forEach((t, ti) => {
      const taskEl = document.createElement("div");
      taskEl.className = t.done ? "task done" : "task";
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = t.done;
      checkbox.onchange = e => {
        t.done = e.target.checked;
        save();
        render(); 
      };

      const contentEl = document.createElement('div');
      contentEl.className = 'task-content';
      
      const spanEl = document.createElement('span');
      spanEl.className = 'task-text';
      
      if (!t.text) {
        spanEl.innerText = "Новая задача";
        spanEl.style.opacity = "0.5";
      } else {
        spanEl.innerText = t.text;
        spanEl.style.opacity = "1";
      }
      
      const inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.value = t.text;
      inputEl.style.display = 'none';
      inputEl.placeholder = "Новая задача";

      contentEl.onclick = () => {
        if (inputEl.style.display === 'none') {
          inputEl.style.display = 'block';
          spanEl.style.display = 'none';
          inputEl.focus();
          spanEl.classList.remove('marquee');
          spanEl.style.removeProperty('--marquee-offset');
        }
      };

      inputEl.onblur = () => {
        t.text = inputEl.value;
        save();
        
        if (!t.text) {
          spanEl.innerText = "Новая задача";
          spanEl.style.opacity = "0.5";
        } else {
          spanEl.innerText = t.text;
          spanEl.style.opacity = "1";
        }

        inputEl.style.display = 'none';
        spanEl.style.display = 'inline-block';
        checkMarquee(spanEl, contentEl);
      };

      inputEl.onkeypress = (e) => {
        if (e.key === 'Enter') inputEl.blur();
      };

      contentEl.appendChild(spanEl);
      contentEl.appendChild(inputEl);

      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'delete';
      deleteBtn.innerText = '✕';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        day.tasks.splice(ti, 1);
        save();
        render();
      };

      taskEl.appendChild(checkbox);
      taskEl.appendChild(contentEl);
      taskEl.appendChild(deleteBtn);
      tasksEl.appendChild(taskEl);

      setTimeout(() => checkMarquee(spanEl, contentEl), 0);
    });

    dayEl.querySelector(".add-task-btn").onclick = () => {
      day.tasks.push({ text: "", done: false });
      save();
      render();
    };

    // Updated selectors to include new sleep select
    const [energySel, moodSel, sleepSel] = dayEl.querySelectorAll(".meta select");
    const noteArea = dayEl.querySelector(".note-area");
    
    energySel.onchange = e => { day.energy = e.target.value; save(); };
    moodSel.onchange = e => { day.mood = e.target.value; save(); };
    sleepSel.onchange = e => { day.sleep = e.target.value; save(); }; 
    
    const resizeTextarea = () => {
      noteArea.style.height = 'auto';
      noteArea.style.height = noteArea.scrollHeight + 'px';
    };
    noteArea.oninput = e => {
      day.note = e.target.value;
      save();
      resizeTextarea();
    };
    setTimeout(resizeTextarea, 0);

    weekEl.appendChild(dayEl);
  });

  renderStats(totalTasks, completedTasks, dailyProgress);
  renderHabits();
  renderCalendar();
}

function checkMarquee(span, container) {
  span.classList.remove('marquee');
  span.style.removeProperty('--marquee-offset');
  
  if (span.scrollWidth > container.clientWidth) {
    const offset = container.clientWidth - span.scrollWidth;
    span.style.setProperty('--marquee-offset', `${offset}px`);
    span.classList.add('marquee');
  }
}

// --- STATS LOGIC ---

function renderStats(total, done, dailyData) {
  const ctxBar = barCanvas.getContext("2d");
  barCanvas.width = barCanvas.offsetWidth;
  barCanvas.height = 200;
  ctxBar.clearRect(0, 0, barCanvas.width, barCanvas.height);
  const w = barCanvas.width / dailyData.length;
  dailyData.forEach((v, i) => {
    ctxBar.fillStyle = "#8fff97ff"; 
    ctxBar.fillRect(i * w + 10, 200 - v * 1.8, w - 20, v * 1.8);
  });

  const ctxPie = pieCanvas.getContext("2d");
  pieCanvas.width = pieCanvas.offsetWidth;
  pieCanvas.height = 200;
  ctxPie.clearRect(0, 0, pieCanvas.width, pieCanvas.height);
  const centerX = pieCanvas.width / 2;
  const centerY = 100;
  const radius = 70;
  const progressRatio = total ? (done / total) : 0;
  const angle = progressRatio * Math.PI * 2; 

  ctxPie.beginPath();
  ctxPie.moveTo(centerX, centerY);
  ctxPie.arc(centerX, centerY, radius, 0, angle);
  ctxPie.fillStyle = "#ff8fb0"; 
  ctxPie.fill();

  ctxPie.beginPath();
  ctxPie.moveTo(centerX, centerY);
  ctxPie.arc(centerX, centerY, radius, angle, Math.PI * 2);
  ctxPie.fillStyle = "#f6efe8";
  ctxPie.fill();

  summaryEl.innerHTML = `
    <strong>Итоги недели</strong><br>
    Всего задач: ${total}<br>
    Выполнено: ${done}<br>
    Эффективность: ${total ? Math.round(done / total * 100) : 0}%
  `;
}

// --- HABITS LOGIC ---

const habitsList = document.getElementById("habits-list");
const addHabitBtn = document.getElementById("addHabitBtn");

function renderHabits() {
  habitsList.innerHTML = "";
  if (state.habits.length === 0) {
    habitsList.innerHTML = "<p style='text-align:center;'>Нет привычек. Добавьте новую!</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "habits-table";
  
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Привычка</th>
      ${SHORT_DAYS.map(d => `<th style="text-align:center">${d}</th>`).join("")}
      <th></th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  state.habits.forEach((habit, idx) => {
    const tr = document.createElement("tr");
    
    // Name Input - CHANGED TO SELECT
    const tdName = document.createElement("td");
    const selectName = document.createElement("select");
    selectName.className = "habit-name-input";
    
    // Default option
    const defaultOpt = document.createElement("option");
    defaultOpt.text = "Выбрать...";
    defaultOpt.value = "";
    defaultOpt.disabled = true;
    if(!habit.name) defaultOpt.selected = true;
    selectName.appendChild(defaultOpt);

    // Emoji options
    HABIT_OPTIONS.forEach(opt => {
        const el = document.createElement("option");
        el.value = opt;
        el.innerText = opt;
        if(habit.name === opt) el.selected = true;
        selectName.appendChild(el);
    });
    
    // Support legacy text if not in list
    if (habit.name && !HABIT_OPTIONS.includes(habit.name)) {
         const legacyOpt = document.createElement("option");
         legacyOpt.value = habit.name;
         legacyOpt.innerText = habit.name;
         legacyOpt.selected = true;
         selectName.appendChild(legacyOpt);
    }

    selectName.onchange = (e) => {
      habit.name = e.target.value;
      save();
    };
    tdName.appendChild(selectName);
    tr.appendChild(tdName);

    // Days Checkboxes
    for (let i = 0; i < 7; i++) {
      const tdDay = document.createElement("td");
      tdDay.style.textAlign = "center";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "habit-checkbox";
      checkbox.checked = habit.checks ? habit.checks[i] : false;
      checkbox.onchange = (e) => {
        if (!habit.checks) habit.checks = [false,false,false,false,false,false,false];
        habit.checks[i] = e.target.checked;
        save();
      };
      tdDay.appendChild(checkbox);
      tr.appendChild(tdDay);
    }

    // Delete
    const tdDel = document.createElement("td");
    const btnDel = document.createElement("span");
    btnDel.className = "delete";
    btnDel.innerText = "✕";
    btnDel.onclick = () => {
      state.habits.splice(idx, 1);
      save();
      renderHabits();
    };
    tdDel.appendChild(btnDel);
    tr.appendChild(tdDel);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  habitsList.appendChild(table);
}

addHabitBtn.onclick = () => {
  state.habits.push({
    name: "", 
    checks: [false, false, false, false, false, false, false]
  });
  save();
  renderHabits();
};

// --- MODAL LOGIC (CUSTOM PIXEL UI) ---

const customModal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

function openCustomModal(type, title, textOrValue, callback) {
    modalTitle.innerText = title;
    modalBody.innerHTML = "";
    
    let inputElement = null;

    if (type === 'confirm') {
        const p = document.createElement('p');
        p.innerText = textOrValue;
        p.style.textAlign = "center";
        modalBody.appendChild(p);
    } else if (type === 'prompt') {
        const p = document.createElement('p');
        p.innerText = "Введите текст заметки:";
        modalBody.appendChild(p);
        
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.value = textOrValue || "";
        inputElement.className = 'modal-input';
        modalBody.appendChild(inputElement);
        // Focus with slight delay to ensure render
        setTimeout(() => inputElement.focus(), 100);
    } else if (type === 'sticker') { // ADDED: Sticker logic
        const p = document.createElement('p');
        p.innerText = "Выберите стикер:";
        p.style.textAlign = "center";
        modalBody.appendChild(p);
        
        const grid = document.createElement('div');
        grid.className = 'sticker-grid';
        
        // Function to create sticker buttons
        CALENDAR_STICKERS.forEach(sticker => {
            const btn = document.createElement('button');
            btn.className = 'sticker-btn';
            btn.innerText = sticker;
            btn.onclick = () => {
                callback(sticker);
                cleanup();
            };
            grid.appendChild(btn);
        });
        modalBody.appendChild(grid);

        // Add explicit delete button for better UX
        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = "Удалить стикер";
        deleteBtn.style.marginTop = "10px";
        deleteBtn.onclick = () => {
            callback(""); // Clear
            cleanup();
        };
        modalBody.appendChild(deleteBtn);
    }

    customModal.classList.remove('hidden');

    const cleanup = () => {
        customModal.classList.add('hidden');
        // Clear handlers to prevent multiple firings
        modalConfirmBtn.onclick = null;
        modalCancelBtn.onclick = null;
    };

    modalConfirmBtn.onclick = () => {
        if (type === 'prompt') {
            callback(inputElement.value);
        } else if (type === 'sticker') {
             // For sticker, we handle selection on button click, so OK just closes
        } else {
            callback(true);
        }
        cleanup();
    };

    modalCancelBtn.onclick = () => {
        if (type === 'confirm') callback(false); 
        cleanup();
    };
}


// --- CALENDAR LOGIC ---

const calendarGrid = document.getElementById("calendar-grid");
const calendarTitle = document.getElementById("calendar-month-title");

// Button Listeners removed as per request

function renderCalendar() {
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  
  const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  calendarTitle.innerText = `${monthNames[month]} ${year}`;
  
  calendarGrid.innerHTML = "";
  
  SHORT_DAYS.forEach(day => {
    const d = document.createElement("div");
    d.className = "cal-day-header";
    d.innerText = day;
    calendarGrid.appendChild(d);
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const adjFirstDay = (firstDayIndex === 0) ? 6 : firstDayIndex - 1; 

  for (let i = 0; i < adjFirstDay; i++) {
    const empty = document.createElement("div");
    calendarGrid.appendChild(empty);
  }

  const todayDate = new Date();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement("div");
    cell.className = "cal-day";
    
    // Check real today for highlighting
    if (d === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear()) {
        cell.classList.add("today");
    }
    
    if (state.calendar[dateStr]) cell.classList.add("has-note");

    cell.innerHTML = `<strong>${d}</strong>`;
    
    if (state.calendar[dateStr]) {
      const notePreview = document.createElement("span");
      notePreview.className = "cal-note";
      notePreview.innerText = state.calendar[dateStr];
      cell.appendChild(notePreview);
    }

    cell.onclick = () => {
      // CHANGED: Use 'sticker' type instead of 'prompt'
      openCustomModal('sticker', `Метка на ${d} ${monthNames[month]}`, state.calendar[dateStr] || "", (newNote) => {
          if (newNote !== null) {
            if (newNote.trim() === "") {
                delete state.calendar[dateStr];
            } else {
                state.calendar[dateStr] = newNote;
            }
            save();
            renderCalendar();
          }
      });
    };

    calendarGrid.appendChild(cell);
  }
}

// --- HISTORY ANALYTICS LOGIC ---

function renderHistory() {
  historyList.innerHTML = "";
  
  const allWeeks = Object.entries(state.weeks).map(([date, data]) => ({
    weekStart: date,
    days: data.days,
    habits: data.habits
  }));

  if (allWeeks.length === 0) {
    historyList.innerHTML = "<p style='text-align:center;'>История пуста.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Неделя</th>
        <th>Задачи (Вып/Всего)</th>
        <!-- REMOVED HABITS COLUMN AS REQUESTED -->
        <th>Ср. Сон</th>
        <!-- MOOD REMOVED -->
        <th>Удалить</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  
  const tbody = table.querySelector("tbody");
  allWeeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  allWeeks.forEach(week => {
    let totalTasks = 0;
    let doneTasks = 0;
    let totalSleep = 0;
    let sleepCount = 0;
    // Mood calculation kept for data integrity/potential future use but not displayed
    let totalMood = 0;
    let moodCount = 0;

    week.days.forEach(d => {
      totalTasks += d.tasks.length;
      doneTasks += d.tasks.filter(t => t.done).length;
      
      const sleepVal = parseFloat(d.sleep);
      if (!isNaN(sleepVal)) {
        totalSleep += sleepVal;
        sleepCount++;
      }

      if (d.mood && MOOD_SCORES[d.mood]) {
        totalMood += MOOD_SCORES[d.mood];
        moodCount++;
      }
    });

    const avgSleep = sleepCount ? (totalSleep / sleepCount).toFixed(1) + "ч" : "-";
    
    // Mood Emoji calculation logic remains but variable not used in display
    const avgMoodScore = moodCount ? (totalMood / moodCount) : 0;
    let avgMoodEmoji = "-";
    if (avgMoodScore > 0) {
      if (avgMoodScore >= 3.5) avgMoodEmoji = "🙂";
      else if (avgMoodScore >= 2.5) avgMoodEmoji = "😐";
      else if (avgMoodScore >= 1.5) avgMoodEmoji = "😡";
      else avgMoodEmoji = "😞";
    }

    const tr = document.createElement("tr");
    
    // TWEAK 3: Add Delete Functionality with CUSTOM MODAL
    const tdAction = document.createElement("td");
    const btnDel = document.createElement("span");
    btnDel.className = "delete";
    btnDel.innerText = "✕";
    btnDel.title = "Удалить неделю из архива";
    btnDel.onclick = (e) => {
        e.stopPropagation();
        
        openCustomModal('confirm', 'Удалить неделю', "Вы уверены, что хотите удалить эту неделю из архива?", (confirmed) => {
            if(confirmed) {
                delete state.weeks[week.weekStart];
                
                // If deleting the currently visible week, clear the view
                if (state.weekStart === week.weekStart) {
                    state.weekStart = null;
                    weekStartInput.value = "";
                    weekEl.innerHTML = "";
                }
                
                save();
                renderHistory();
            }
        });
    };
    tdAction.appendChild(btnDel);

    tr.innerHTML = `
      <td>${week.weekStart}</td>
      <td>${doneTasks} / ${totalTasks}</td>
      <td>${avgSleep}</td>
    `;
    
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });

  historyList.appendChild(table);
}


// --- PANELS NAVIGATION ---

function closeAllPanels() {
  [analyticsContainer, habitsContainer, calendarContainer, historyContainer].forEach(el => {
    el.classList.remove("visible");
  });
  body.classList.remove("panel-open");
  bottomControls.style.display = "flex"; 
}

function openPanel(panel) {
  closeAllPanels();
  panel.classList.add("visible");
  body.classList.add("panel-open");
  bottomControls.style.display = "none"; 
}

btnStats.onclick = () => openPanel(analyticsContainer);
btnHabits.onclick = () => openPanel(habitsContainer);
btnCalendar.onclick = () => {
    // When opening calendar, sync view with current week date or today
    if(state.weekStart) {
        calendarViewDate = new Date(state.weekStart);
    } else {
        calendarViewDate = new Date();
    }
    renderCalendar();
    openPanel(calendarContainer);
};

btnWeeklyAnalytics.onclick = () => {
  renderHistory();
  openPanel(historyContainer);
};

btnThemeToggle.onclick = () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  
  // Добавляем поиск нашего мета-тега:
  const metaTheme = document.getElementById("theme-meta");

  if (state.theme === 'dark') {
    body.classList.add('dark-theme');
    // Устанавливаем цвет для темной темы:
    if(metaTheme) metaTheme.setAttribute("content", "#3f243a");
  } else {
    body.classList.remove('dark-theme');
    // Устанавливаем цвет для светлой темы:
    if(metaTheme) metaTheme.setAttribute("content", "#ffc8c8");
  }
  save();
};

closeButtons.forEach(btn => {
  btn.onclick = closeAllPanels;
});

weekStartInput.onchange = initWeek;

// TWEAK 2: Initially Empty Field
// We do NOT auto-initialize initWeek() if we want it empty initially.
// Uncomment below if you want to restore the "Remember last week" functionality.
/*
if (state.weekStart) {
  weekStartInput.value = state.weekStart;
  initWeek(); 
}
*/

const instructionModal = document.getElementById("instruction-modal");
const closeInstructionBtn = document.getElementById("close-instruction-btn");

if (!localStorage.getItem("planer_instructions_seen")) {
  instructionModal.classList.remove("hidden");
}

closeInstructionBtn.onclick = () => {
  instructionModal.classList.add("hidden");
  localStorage.setItem("planer_instructions_seen", "true");
};
