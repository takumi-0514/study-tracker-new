// ==== ナビゲーション・UI共通 ====
// タブ切替、ドロワーメニュー開閉、サブタブ切替、時計表示

const TAB_TITLES = {
  timer: 'タイマー / 計測',
  problem: '問題演習タイマー',
  todos: 'ToDoリスト',
  dashboard: 'ダッシュボード',
  history: '学習履歴',
  subjects: '科目・目標設定'
};

function updateLiveClock() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const weekDay = days[now.getDay()];

  const dateStrFull = `${year}年 ${month}月${day}日 (${weekDay})`;
  const dateStrShort = `${month}/${day}(${weekDay})`;
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;

  const sDateEl = document.getElementById('sidebar-date-text');
  const sClockEl = document.getElementById('sidebar-clock-text');
  if (sDateEl) sDateEl.innerText = dateStrFull;
  if (sClockEl) sClockEl.innerText = timeStr;

  const mDateEl = document.getElementById('mobile-sidebar-date-text');
  const mClockEl = document.getElementById('mobile-sidebar-clock-text');
  if (mDateEl) mDateEl.innerText = dateStrShort;
  if (mClockEl) mClockEl.innerText = timeStr;

  const drawerDateEl = document.getElementById('drawer-date-text');
  const drawerClockEl = document.getElementById('drawer-clock-text');
  if (drawerDateEl) drawerDateEl.innerText = dateStrFull;
  if (drawerClockEl) drawerClockEl.innerText = timeStr;
}

// --- ドロワーメニュー開閉制御 ---
function toggleDrawer(isOpen) {
  const backdrop = document.getElementById('drawer-backdrop');
  const panel = document.getElementById('drawer-panel');
  if (!backdrop || !panel) return;

  if (isOpen) {
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      backdrop.classList.remove('opacity-0', 'pointer-events-none');
      backdrop.classList.add('opacity-100', 'pointer-events-auto');
      panel.classList.remove('-translate-x-full');
      panel.classList.add('translate-x-0');
    });
    document.body.classList.add('overflow-hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } else {
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    panel.classList.remove('translate-x-0');
    panel.classList.add('-translate-x-full');
    document.body.classList.remove('overflow-hidden');
    setTimeout(() => {
      if (backdrop.classList.contains('opacity-0')) {
        backdrop.classList.add('hidden');
      }
    }, 300);
  }
}

// ドロワー内の項目を押して画面を切り替えたら自動でドロワーを閉じて「画面に帰る」
function navigateFromDrawer(tabId) {
  switchTab(tabId);
  toggleDrawer(false);
}

// ドロップダウンをすべて閉じる共通ヘルパー
function closeAllDropdowns() {
  if (typeof closeTimerModeDropdown === 'function') closeTimerModeDropdown();
  if (typeof closeTodoViewDropdown === 'function') closeTodoViewDropdown();
}
window.closeAllDropdowns = closeAllDropdowns;

// 画面外クリックで開いているドロップダウンを自動で閉じる
window.addEventListener('click', e => {
  const timerContainer = document.getElementById('timer-mode-dropdown-container');
  if (timerContainer && !timerContainer.contains(e.target)) {
    if (typeof closeTimerModeDropdown === 'function') closeTimerModeDropdown();
  }
  const todoContainer = document.getElementById('todo-view-dropdown-container');
  if (todoContainer && !todoContainer.contains(e.target)) {
    if (typeof closeTodoViewDropdown === 'function') closeTodoViewDropdown();
  }
});

// ESCキーでドロワーやドロップダウンを閉じる
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    toggleDrawer(false);
    closeAllDropdowns();
  }
});

function switchTab(tabId) {
  ['timer', 'problem', 'todos', 'dashboard', 'history', 'subjects'].forEach(tab => {
    const section = document.getElementById(`tab-${tab}`);
    const btn = document.getElementById(`nav-${tab}`);
    const drawerBtn = document.getElementById(`drawer-nav-${tab}`);
    
    if (tab === tabId) {
      if (section) section.classList.remove('hidden');
      if (btn) {
        btn.classList.add('bg-indigo-600', 'text-white');
        btn.classList.remove('text-slate-400', 'hover:bg-slate-800');
      }
      if (drawerBtn) {
        drawerBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        drawerBtn.classList.remove('text-slate-300', 'hover:bg-slate-800/80');
      }
    } else {
      if (section) section.classList.add('hidden');
      if (btn) {
        btn.classList.remove('bg-indigo-600', 'text-white');
        btn.classList.add('text-slate-400', 'hover:bg-slate-800');
      }
      if (drawerBtn) {
        drawerBtn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
        drawerBtn.classList.add('text-slate-300', 'hover:bg-slate-800/80');
      }
    }
  });

  // ヘッダーの現在のタブ名バッジを更新
  const mobileTabBadge = document.getElementById('mobile-current-tab-badge');
  if (mobileTabBadge && TAB_TITLES[tabId]) {
    mobileTabBadge.innerText = TAB_TITLES[tabId];
  }

  if (tabId === 'dashboard') {
    updateDashboardData();
  } else if (tabId === 'history') {
    renderHistoryTable();
    renderAchievementsPage();
  } else if (tabId === 'problem') {
    renderProblemHistory();
  } else if (tabId === 'todos') {
    if (todoViewMode === 'calendar') {
      renderCalendarView();
    } else if (todoViewMode === 'schedule') {
      renderScheduleView();
    } else {
      renderTodoList();
    }
  }
}

function setHistorySubTab(subTab) {
  const logBtn = document.getElementById('hist-subtab-log-btn');
  const achBtn = document.getElementById('hist-subtab-achievements-btn');
  const logContent = document.getElementById('hist-subtab-log-content');
  const achContent = document.getElementById('hist-subtab-achievements-content');

  if (subTab === 'log') {
    logBtn.className = "px-4 py-2 rounded-lg transition bg-white text-indigo-600 shadow-sm font-semibold";
    achBtn.className = "px-4 py-2 rounded-lg transition text-slate-600";
    logContent.classList.remove('hidden');
    achContent.classList.add('hidden');
  } else {
    achBtn.className = "px-4 py-2 rounded-lg transition bg-white text-indigo-600 shadow-sm font-semibold";
    logBtn.className = "px-4 py-2 rounded-lg transition text-slate-600";
    achContent.classList.remove('hidden');
    logContent.classList.add('hidden');
    renderAchievementsPage();
  }
}

function setProblemSubTab(subTab) {
  const timerBtn = document.getElementById('prob-subtab-timer-btn');
  const historyBtn = document.getElementById('prob-subtab-history-btn');
  const timerContent = document.getElementById('prob-subtab-timer-content');
  const historyContent = document.getElementById('prob-subtab-history-content');

  if (subTab === 'timer') {
    timerBtn.className = "px-4 py-2 rounded-lg transition bg-white text-indigo-600 shadow-sm font-semibold";
    historyBtn.className = "px-4 py-2 rounded-lg transition text-slate-600";
    timerContent.classList.remove('hidden');
    historyContent.classList.add('hidden');
  } else {
    historyBtn.className = "px-4 py-2 rounded-lg transition bg-white text-indigo-600 shadow-sm font-semibold";
    timerBtn.className = "px-4 py-2 rounded-lg transition text-slate-600";
    historyContent.classList.remove('hidden');
    timerContent.classList.add('hidden');
    renderProblemHistory();
  }
}

window.toggleDrawer = toggleDrawer;
window.navigateFromDrawer = navigateFromDrawer;
window.switchTab = switchTab;
window.setHistorySubTab = setHistorySubTab;
window.setProblemSubTab = setProblemSubTab;
window.updateLiveClock = updateLiveClock;
