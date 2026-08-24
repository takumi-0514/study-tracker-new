// ==== ナビゲーション・UI共通 ====
// タブ切替、サブタブ切替、時計表示

    function updateLiveClock() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      const weekDay = days[now.getDay()];

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const dateStrFull = `${year}年 ${month}月${day}日 (${weekDay})`;
      const dateStrShort = `${month}/${day}(${weekDay})`;
      const timeStr = `${hours}:${minutes}:${seconds}`;

      const sDateEl = document.getElementById('sidebar-date-text');
      const sClockEl = document.getElementById('sidebar-clock-text');
      if (sDateEl) sDateEl.innerText = dateStrFull;
      if (sClockEl) sClockEl.innerText = timeStr;

      const mDateEl = document.getElementById('mobile-sidebar-date-text');
      const mClockEl = document.getElementById('mobile-sidebar-clock-text');
      if (mDateEl) mDateEl.innerText = dateStrShort;
      if (mClockEl) mClockEl.innerText = timeStr;
    }

    function switchTab(tabId) {
      ['timer', 'problem', 'todos', 'dashboard', 'history', 'subjects'].forEach(tab => {
        const section = document.getElementById(`tab-${tab}`);
        const btn = document.getElementById(`nav-${tab}`);
        const mobBtn = document.getElementById(`mob-nav-${tab}`);
        
        if (tab === tabId) {
          if (section) section.classList.remove('hidden');
          if (btn) {
            btn.classList.add('bg-indigo-600', 'text-white');
            btn.classList.remove('text-slate-400', 'hover:bg-slate-800');
          }
          if (mobBtn) {
            mobBtn.classList.add('text-indigo-400');
            mobBtn.classList.remove('hover:text-slate-100');
          }
        } else {
          if (section) section.classList.add('hidden');
          if (btn) {
            btn.classList.remove('bg-indigo-600', 'text-white');
            btn.classList.add('text-slate-400', 'hover:bg-slate-800');
          }
          if (mobBtn) {
            mobBtn.classList.remove('text-indigo-400');
            mobBtn.classList.add('hover:text-slate-100');
          }
        }
      });

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
