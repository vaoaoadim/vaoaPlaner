// script.js
const weekEl = document.getElementById("week");
const weekStartInput = document.getElementById("weekStart");
// Removed broken reference to weeklyGoalInput which caused the script to crash on load
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

// Constants
const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const SHORT_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const ENERGY = ["⚡", "⚡⚡", "⚡⚡⚡", "⚡⚡⚡⚡"];
const MOOD = ["🙂", "😐", "😡", "😞"];
const MOOD_SCORES = { "🙂": 4, "😐": 3, "😴": 2, "😞": 1 };

// State initialization
let state = JSON.parse(localStorage.getItem("planer")) || {};

// Initialize new state properties if missing
if (!state.habits) state.habits = [];
if (!state.calendar) state.calendar = {};
if (!state.history) state.history = []; // Array of { weekStart, days, habitsSnapshot }
if (!state.theme) state.theme = 'light';

// Apply Theme immediately
if (state.theme === 'dark') {
  body.classList.add('dark-theme');
}

function save() {
  localStorage.setItem("planer", JSON.stringify(state));
}

// --- CORE PLANNER LOGIC ---

function initWeek() {
  if (!weekStartInput.value) return;
  const newStart = weekStartInput.value;

  // Archiving Logic: If weekStart changes significantly, archive the old week
  // We check if state.weekStart exists and is different from input
  if (state.weekStart && state.weekStart !== newStart) {
    // Only archive if there's actual data to save (e.g. tasks exist)
    const hasData = state.days.some(d => d.tasks.length > 0 || d.note || d.sleep);
    
    if (hasData) {
      // Check if this week is already archived to prevent duplicates on minor toggles
      const alreadyArchived = state.history.some(h => h.weekStart === state.weekStart);
      if (!alreadyArchived) {
         state.history.push({
           weekStart: state.weekStart,
           // Removed weeklyGoal reference
           days: JSON.parse(JSON.stringify(state.days)), // Deep copy
           habits: JSON.parse(JSON.stringify(state.habits)) // Snapshot habits state for that week
         });
      }
    }
    
    // Reset days for the new week (Clean slate for new week)
    // This changes previous behavior of "recycling" tasks, but is necessary for "Previous Weeks" feature.
    state.days = []; 
  }

  state.weekStart = newStart;
  const start = new Date(state.weekStart);

  // Generate or load days
  // If state.days is empty (because we reset it), map will generate new structure
  // If state.days has data (reload page), map will use it.
  state.days = DAYS.map((d, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    
    // Reuse existing day if it exists and matches logic (handled by index)
    // or create new
    return state.days?.[i] || {
      date: date.toISOString(),
      tasks: [],
      energy: "",
      mood: "",
      sleep: "",
      note: ""
    };
  });
  
  save();
  render();
}

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
        <input placeholder="Сон (например, 8ч)" value="${day.sleep}">
        <textarea rows="1" placeholder="Мысли / урок дня" class="note-area">${day.note || ''}</textarea>
      </div>
    `;

    // Render Tasks with Marquee support
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
        render(); // Re-render to update stats
      };

      // Content Wrapper
      const contentEl = document.createElement('div');
      contentEl.className = 'task-content';
      
      // Display Span (Marquee)
      const spanEl = document.createElement('span');
      spanEl.className = 'task-text';
      
      // Placeholder logic for span
      if (!t.text) {
        spanEl.innerText = "Новая задача";
        spanEl.style.opacity = "0.5";
      } else {
        spanEl.innerText = t.text;
        spanEl.style.opacity = "1";
      }
      
      // Edit Input (Hidden initially)
      const inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.value = t.text;
      inputEl.style.display = 'none';
      inputEl.placeholder = "Новая задача";

      // Toggle Edit Mode
      contentEl.onclick = () => {
        if (inputEl.style.display === 'none') {
          inputEl.style.display = 'block';
          spanEl.style.display = 'none';
          inputEl.focus();
          // Remove marquee while editing
          spanEl.classList.remove('marquee');
          spanEl.style.removeProperty('--marquee-offset');
        }
      };

      inputEl.onblur = () => {
        t.text = inputEl.value;
        save();
        
        // Update span text/style based on input
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

      // Delete Button
      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'delete';
      deleteBtn.innerText = '✕';
      deleteBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent edit mode trigger
        day.tasks.splice(ti, 1);
        save();
        render();
      };

      taskEl.appendChild(checkbox);
      taskEl.appendChild(contentEl);
      taskEl.appendChild(deleteBtn);
      tasksEl.appendChild(taskEl);

      // Initial marquee check after DOM insertion
      setTimeout(() => checkMarquee(spanEl, contentEl), 0);
    });

    dayEl.querySelector(".add-task-btn").onclick = () => {
      // Initialize with empty text so placeholder shows
      day.tasks.push({ text: "", done: false });
      save();
      render();
    };

    const [energySel, moodSel, sleepIn] = dayEl.querySelectorAll(".meta select, .meta input");
    const noteArea = dayEl.querySelector(".note-area");
    
    energySel.onchange = e => { day.energy = e.target.value; save(); };
    moodSel.onchange = e => { day.mood = e.target.value; save(); };
    sleepIn.oninput = e => { day.sleep = e.target.value; save(); };
    
    // Auto-expand Textarea Logic
    const resizeTextarea = () => {
      noteArea.style.height = 'auto';
      noteArea.style.height = noteArea.scrollHeight + 'px';
    };
    noteArea.oninput = e => {
      day.note = e.target.value;
      save();
      resizeTextarea();
    };
    // Initialize height
    setTimeout(resizeTextarea, 0);

    weekEl.appendChild(dayEl);
  });

  renderStats(totalTasks, completedTasks, dailyProgress);
  renderHabits();
  renderCalendar();
}

function checkMarquee(span, container) {
  // Reset
  span.classList.remove('marquee');
  span.style.removeProperty('--marquee-offset');
  
  // Check overflow
  // Use scrollWidth vs clientWidth of container
  if (span.scrollWidth > container.clientWidth) {
    const offset = container.clientWidth - span.scrollWidth;
    // Buffer to ensure it scrolls past the end a little or fits perfectly
    span.style.setProperty('--marquee-offset', `${offset}px`);
    span.classList.add('marquee');
  }
}

// --- STATS LOGIC ---

function renderStats(total, done, dailyData) {
  // Bar Chart
  const ctxBar = barCanvas.getContext("2d");
  barCanvas.width = barCanvas.offsetWidth;
  barCanvas.height = 200;
  ctxBar.clearRect(0, 0, barCanvas.width, barCanvas.height);
  const w = barCanvas.width / dailyData.length;
  dailyData.forEach((v, i) => {
    ctxBar.fillStyle = "#ff8fb0"; 
    ctxBar.fillRect(i * w + 10, 200 - v * 1.8, w - 20, v * 1.8);
  });

  // Pie Chart
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
  
  // Header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Привычка</th>
      ${SHORT_DAYS.map(d => `<th style="text-align:center">${d}</th>`).join("")}
      <th></th>
    </tr>
  `;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  state.habits.forEach((habit, idx) => {
    const tr = document.createElement("tr");
    
    // Name Input
    const tdName = document.createElement("td");
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.className = "habit-name-input";
    inputName.value = habit.name;
    inputName.placeholder = "Новая привычка"; // Placeholder for habits
    inputName.oninput = (e) => {
      habit.name = e.target.value;
      save();
    };
    tdName.appendChild(inputName);
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
    name: "", // Initialize with empty text
    checks: [false, false, false, false, false, false, false]
  });
  save();
  renderHabits();
};

// --- CALENDAR LOGIC ---

const calendarGrid = document.getElementById("calendar-grid");
const calendarTitle = document.getElementById("calendar-month-title");

function renderCalendar() {
  const now = new Date();
  // Using fixed logic for current month for simplicity, or we could add month navigation.
  // Let's assume current month for the "regular calendar".
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Month Names
  const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  calendarTitle.innerText = `${monthNames[month]} ${year}`;
  
  calendarGrid.innerHTML = "";
  
  // Header Row
  SHORT_DAYS.forEach(day => {
    const d = document.createElement("div");
    d.className = "cal-day-header";
    d.innerText = day;
    calendarGrid.appendChild(d);
  });

  // Days logic
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const adjFirstDay = (firstDayIndex === 0) ? 6 : firstDayIndex - 1; // Adjust for Monday start

  // Empty slots
  for (let i = 0; i < adjFirstDay; i++) {
    const empty = document.createElement("div");
    calendarGrid.appendChild(empty);
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement("div");
    cell.className = "cal-day";
    if (d === now.getDate() && month === now.getMonth()) cell.classList.add("today");
    if (state.calendar[dateStr]) cell.classList.add("has-note");

    cell.innerHTML = `<strong>${d}</strong>`;
    
    if (state.calendar[dateStr]) {
      const notePreview = document.createElement("span");
      notePreview.className = "cal-note";
      notePreview.innerText = state.calendar[dateStr];
      cell.appendChild(notePreview);
    }

    cell.onclick = () => {
      const newNote = prompt(`Заметка на ${d} ${monthNames[month]}:`, state.calendar[dateStr] || "");
      if (newNote !== null) {
        if (newNote.trim() === "") {
          delete state.calendar[dateStr];
        } else {
          state.calendar[dateStr] = newNote;
        }
        save();
        renderCalendar();
      }
    };

    calendarGrid.appendChild(cell);
  }
}

// --- HISTORY ANALYTICS LOGIC ---

function renderHistory() {
  historyList.innerHTML = "";
  if (!state.history || state.history.length === 0) {
    historyList.innerHTML = "<p style='text-align:center;'>История пуста. Завершите неделю, сменив дату.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Неделя</th>
        <th>Задачи (Вып/Всего)</th>
        <th>Привычки (Всего)</th>
        <th>Ср. Сон</th>
        <th>Ср. Настроение</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  
  const tbody = table.querySelector("tbody");

  // Show history in reverse order (newest first)
  [...state.history].reverse().forEach(week => {
    // 1. Tasks
    let totalTasks = 0;
    let doneTasks = 0;
    let totalSleep = 0;
    let sleepCount = 0;
    let totalMood = 0;
    let moodCount = 0;

    week.days.forEach(d => {
      totalTasks += d.tasks.length;
      doneTasks += d.tasks.filter(t => t.done).length;
      
      // Sleep
      const sleepVal = parseFloat(d.sleep);
      if (!isNaN(sleepVal)) {
        totalSleep += sleepVal;
        sleepCount++;
      }

      // Mood
      if (d.mood && MOOD_SCORES[d.mood]) {
        totalMood += MOOD_SCORES[d.mood];
        moodCount++;
      }
    });

    // 2. Habits
    // Sum all checks in the habits array snapshot
    let doneHabits = 0;
    if (week.habits) {
        week.habits.forEach(h => {
            if(h.checks) doneHabits += h.checks.filter(c => c).length;
        });
    }

    const avgSleep = sleepCount ? (totalSleep / sleepCount).toFixed(1) + "ч" : "-";
    const avgMoodScore = moodCount ? (totalMood / moodCount) : 0;
    
    // Map score back to closest emoji
    let avgMoodEmoji = "-";
    if (avgMoodScore > 0) {
      if (avgMoodScore >= 3.5) avgMoodEmoji = "🙂";
      else if (avgMoodScore >= 2.5) avgMoodEmoji = "😐";
      else if (avgMoodScore >= 1.5) avgMoodEmoji = "😴";
      else avgMoodEmoji = "😞";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${week.weekStart || "Неизв."}</td>
      <td>${doneTasks} / ${totalTasks}</td>
      <td>${doneHabits}</td>
      <td>${avgSleep}</td>
      <td>${avgMoodEmoji}</td>
    `;
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
  bottomControls.style.display = "flex"; // Show buttons
}

function openPanel(panel) {
  closeAllPanels();
  panel.classList.add("visible");
  body.classList.add("panel-open");
  bottomControls.style.display = "none"; // Hide buttons when panel is open
}

btnStats.onclick = () => openPanel(analyticsContainer);
btnHabits.onclick = () => openPanel(habitsContainer);
btnCalendar.onclick = () => openPanel(calendarContainer);

// New Buttons Wiring
btnWeeklyAnalytics.onclick = () => {
  renderHistory();
  openPanel(historyContainer);
};

btnThemeToggle.onclick = () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  if (state.theme === 'dark') {
    body.classList.add('dark-theme');
  } else {
    body.classList.remove('dark-theme');
  }
  save();
};

closeButtons.forEach(btn => {
  btn.onclick = closeAllPanels;
});

// Initialization
weekStartInput.onchange = initWeek;
// Removed broken oninput listener for non-existent weeklyGoalInput

if (state.weekStart) {
  weekStartInput.value = state.weekStart;
  // Removed assignment to non-existent weeklyGoalInput
  render();
}

// --- INSTRUCTION MODAL LOGIC ---
const instructionModal = document.getElementById("instruction-modal");
const closeInstructionBtn = document.getElementById("close-instruction-btn");

// Check if visited before
if (!localStorage.getItem("planer_instructions_seen")) {
  instructionModal.classList.remove("hidden");
}

closeInstructionBtn.onclick = () => {
  instructionModal.classList.add("hidden");
  localStorage.setItem("planer_instructions_seen", "true");
};

