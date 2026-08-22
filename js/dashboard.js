// ==== ダッシュボード・履歴機能 ====
// グラフ描画、ストリーク計算、学習履歴、バックアップ入出力

    function setChartRange(range) {
      currentChartRange = range;
      ['7days', 'month', 'all'].forEach(r => {
        const btn = document.getElementById(`chart-range-${r}`);
        if (btn) {
          if (r === range) btn.className = "px-3 py-1 rounded-md bg-white shadow-sm text-indigo-600 font-semibold transition";
          else btn.className = "px-3 py-1 rounded-md text-slate-600 transition";
        }
      });
      renderMainChart();
    }

    function updateDashboardData() {
      const todayStr = getTodayString();
      let todayMins = 0;
      let totalMins = 0;
      const weekStart = getNDaysAgoDate(6);
      let weekMins = 0;

      logs.forEach(log => {
        totalMins += log.minutes;
        if (log.date === todayStr) todayMins += log.minutes;
        if (log.date >= weekStart && log.date <= todayStr) weekMins += log.minutes;
      });

      document.getElementById('kpi-today').innerText = formatMinutes(todayMins);
      document.getElementById('kpi-week').innerText = formatMinutes(weekMins);
      document.getElementById('kpi-total').innerText = formatMinutes(totalMins);
      document.getElementById('sidebar-today-time').innerText = formatMinutes(todayMins);
      
      const goalMins = dailyGoal * 60;
      const percent = Math.min(100, Math.round((todayMins / goalMins) * 100));
      document.getElementById('sidebar-goal-bar').style.width = `${percent}%`;
      document.getElementById('sidebar-goal-text').innerText = `目標: ${dailyGoal}h (${percent}%)`;
      
      const mobTimeEl = document.getElementById('mobile-sidebar-today-time');
      const mobGoalEl = document.getElementById('mobile-sidebar-goal-text');
      if (mobTimeEl) mobTimeEl.innerText = formatMinutes(todayMins);
      if (mobGoalEl) mobGoalEl.innerText = `目標 ${dailyGoal}h (${percent}%)`;

      document.getElementById('kpi-streak').innerText = `${calculateStreak()}日`;

      renderMainChart();
      renderSubjectChart();
      renderWeeklyReport();
      if (typeof renderSubjectList === 'function') renderSubjectList();
    }

    function setReportPeriod(period) {
      currentReportPeriod = period;
      ['day', 'week', 'month'].forEach(p => {
        const btn = document.getElementById(`report-period-${p}`);
        if (btn) {
          if (p === period) btn.className = "px-3 py-1 rounded-md bg-white shadow-sm text-indigo-600 font-semibold transition";
          else btn.className = "px-3 py-1 rounded-md text-slate-600 transition";
        }
      });
      renderWeeklyReport();
    }

    function renderWeeklyReport() {
      const rangeLabelEl = document.getElementById('weekly-report-range-label');
      const thisWeekEl = document.getElementById('weekly-report-this-week');
      const lastWeekEl = document.getElementById('weekly-report-last-week');
      const diffEl = document.getElementById('weekly-report-diff');
      const breakdownEl = document.getElementById('weekly-report-subject-breakdown');
      const emptyEl = document.getElementById('weekly-report-empty');
      const warningEl = document.getElementById('weekly-report-streak-warning');
      const warningTextEl = document.getElementById('weekly-report-streak-warning-text');
      const currentLabelEl = document.getElementById('report-current-label');
      const previousLabelEl = document.getElementById('report-previous-label');
      const breakdownLabelEl = document.getElementById('report-breakdown-label');
      if (!thisWeekEl) return;

      const period = currentReportPeriod || 'week';
      const todayStr = getTodayString();

      let currentStart, currentEnd, previousStart, previousEnd;
      let currentLabel, previousLabel, breakdownLabel;

      if (period === 'day') {
        currentStart = currentEnd = todayStr;
        previousStart = previousEnd = getNDaysAgoDate(1);
        currentLabel = '今日の合計';
        previousLabel = '昨日の合計';
        breakdownLabel = '科目別内訳(今日)';
      } else if (period === 'month') {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        currentStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        currentEnd = todayStr;
        const prevMonthDate = new Date(year, month - 1, 1);
        const prevYear = prevMonthDate.getFullYear();
        const prevMonth = prevMonthDate.getMonth();
        const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
        previousStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
        previousEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(daysInPrevMonth).padStart(2, '0')}`;
        currentLabel = '今月の合計';
        previousLabel = '先月の合計';
        breakdownLabel = '科目別内訳(今月)';
      } else {
        currentStart = getNDaysAgoDate(6);
        currentEnd = todayStr;
        previousStart = getNDaysAgoDate(13);
        previousEnd = getNDaysAgoDate(7);
        currentLabel = '今週の合計';
        previousLabel = '先週の合計';
        breakdownLabel = '科目別内訳(今週)';
      }

      if (rangeLabelEl) rangeLabelEl.innerText = `${currentStart} 〜 ${currentEnd}`;
      if (currentLabelEl) currentLabelEl.innerText = currentLabel;
      if (previousLabelEl) previousLabelEl.innerText = previousLabel;
      if (breakdownLabelEl) breakdownLabelEl.innerText = breakdownLabel;

      let currentMins = 0;
      let previousMins = 0;
      const subjectMinsCurrent = {};

      logs.forEach(log => {
        if (log.date >= currentStart && log.date <= currentEnd) {
          currentMins += log.minutes;
          subjectMinsCurrent[log.subjectId] = (subjectMinsCurrent[log.subjectId] || 0) + log.minutes;
        } else if (log.date >= previousStart && log.date <= previousEnd) {
          previousMins += log.minutes;
        }
      });

      thisWeekEl.innerText = formatMinutes(currentMins);
      lastWeekEl.innerText = formatMinutes(previousMins);

      if (previousMins === 0 && currentMins === 0) {
        diffEl.innerText = '-';
        diffEl.className = 'text-xs font-semibold mt-1 text-slate-400';
      } else if (previousMins === 0) {
        diffEl.innerText = `${previousLabel.replace('の合計', '')}の記録なし`;
        diffEl.className = 'text-xs font-semibold mt-1 text-slate-400';
      } else {
        const diffPercent = Math.round(((currentMins - previousMins) / previousMins) * 100);
        if (diffPercent >= 0) {
          diffEl.innerText = `▲ 前${period === 'day' ? '日' : period === 'month' ? '月' : '週'}より ${diffPercent}%多い`;
          diffEl.className = 'text-xs font-semibold mt-1 text-emerald-600';
        } else {
          diffEl.innerText = `▼ 前${period === 'day' ? '日' : period === 'month' ? '月' : '週'}より ${Math.abs(diffPercent)}%少ない`;
          diffEl.className = 'text-xs font-semibold mt-1 text-rose-500';
        }
      }

      breakdownEl.innerHTML = '';

      // 週間目標が設定されている科目は、今週まだ記録が0分でも一覧に出す
      let subjectIds = Object.keys(subjectMinsCurrent);
      if (period === 'week') {
        subjects.forEach(s => {
          if (s.weeklyGoalMinutes > 0 && !subjectIds.includes(s.id)) subjectIds.push(s.id);
        });
      }
      subjectIds.sort((a, b) => (subjectMinsCurrent[b] || 0) - (subjectMinsCurrent[a] || 0));

      if (subjectIds.length === 0) {
        emptyEl.classList.remove('hidden');
      } else {
        emptyEl.classList.add('hidden');
        const maxMins = Math.max(1, ...subjectIds.map(id => subjectMinsCurrent[id] || 0));
        const unmetGoalNames = [];

        subjectIds.forEach(subId => {
          const subject = subjects.find(s => s.id === subId) || { name: '未分類', color: '#94a3b8' };
          const mins = subjectMinsCurrent[subId] || 0;
          const row = document.createElement('div');

          if (period === 'week' && subject.weeklyGoalMinutes > 0) {
            const goalPercent = Math.min(100, Math.round((mins / subject.weeklyGoalMinutes) * 100));
            const achieved = mins >= subject.weeklyGoalMinutes;
            if (!achieved) unmetGoalNames.push(subject.name);
            const barColor = achieved ? '#10b981' : (goalPercent < 50 ? '#f43f5e' : subject.color);
            row.className = 'flex items-center gap-3 text-xs';
            row.innerHTML = `
              <span class="w-16 flex-shrink-0 truncate font-medium text-slate-600">${subject.name}</span>
              <div class="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="h-full rounded-full transition-all" style="width: ${goalPercent}%; background-color: ${barColor}"></div>
              </div>
              <span class="w-28 flex-shrink-0 text-right font-semibold ${achieved ? 'text-emerald-600' : 'text-slate-700'}">
                ${achieved ? '✅ 達成' : `${formatMinutes(mins)} / ${formatMinutes(subject.weeklyGoalMinutes)}`}
              </span>
            `;
          } else {
            const widthPercent = Math.round((mins / maxMins) * 100);
            row.className = 'flex items-center gap-3 text-xs';
            row.innerHTML = `
              <span class="w-16 flex-shrink-0 truncate font-medium text-slate-600">${subject.name}</span>
              <div class="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="h-full rounded-full" style="width: ${widthPercent}%; background-color: ${subject.color}"></div>
              </div>
              <span class="w-14 flex-shrink-0 text-right font-semibold text-slate-700">${formatMinutes(mins)}</span>
            `;
          }
          breakdownEl.appendChild(row);
        });

        if (period === 'week' && unmetGoalNames.length > 0) {
          const notice = document.createElement('div');
          notice.className = 'text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3';
          notice.innerText = `⚠️ 目標未達成: ${unmetGoalNames.join('、')}`;
          breakdownEl.insertBefore(notice, breakdownEl.firstChild);
        }
      }

      // ストリークが途切れそうな警告(現在ストリークが発生中で、今日まだ記録がない場合)
      const streak = calculateStreak();
      const hasTodayLog = logs.some(l => l.date === todayStr);
      if (streak > 0 && !hasTodayLog) {
        warningEl.classList.remove('hidden');
        warningTextEl.innerText = `現在 ${streak}日連続で学習中です。今日まだ記録がありません。途切れる前に学習を記録しましょう！`;
      } else {
        warningEl.classList.add('hidden');
      }
    }

    function calculateStreak() {
      if (logs.length === 0) return 0;
      const uniqueDates = [...new Set(logs.map(l => l.date))].sort().reverse();
      const todayStr = getTodayString();
      const yesterdayStr = getNDaysAgoDate(1);

      if (!uniqueDates.includes(todayStr) && !uniqueDates.includes(yesterdayStr)) return 0;

      let streak = 0;
      let checkDate = new Date();
      if (!uniqueDates.includes(todayStr)) checkDate.setDate(checkDate.getDate() - 1);

      while (true) {
        const dateStr = formatDateObj(checkDate);
        if (uniqueDates.includes(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      return streak;
    }

    function renderMainChart() {
      const ctx = document.getElementById('weeklyChart').getContext('2d');
      let labels = [];
      let timeKeys = [];

      if (currentChartRange === '7days') {
        for (let i = 6; i >= 0; i--) {
          const dateStr = getNDaysAgoDate(i);
          timeKeys.push(dateStr);
          labels.push(dateStr.slice(5).replace('-', '/'));
        }
      } else if (currentChartRange === 'month') {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          timeKeys.push(dateStr);
          labels.push(`${day}日`);
        }
      } else if (currentChartRange === 'all') {
        const monthKeysSet = new Set();
        logs.forEach(l => monthKeysSet.add(l.date.slice(0, 7)));
        const sortedMonths = Array.from(monthKeysSet).sort();
        if (sortedMonths.length === 0) {
          timeKeys = [getTodayString().slice(0, 7)];
          labels = [getTodayString().slice(0, 7).replace('-', '/')];
        } else {
          sortedMonths.forEach(mKey => {
            timeKeys.push(mKey);
            labels.push(mKey.replace('-', '/'));
          });
        }
      }

      const datasets = subjects.map(sub => {
        const dataArr = timeKeys.map(key => {
          let matchingLogs = currentChartRange === 'all' ? logs.filter(l => l.subjectId === sub.id && l.date.startsWith(key)) : logs.filter(l => l.subjectId === sub.id && l.date === key);
          const totalMins = matchingLogs.reduce((acc, curr) => acc + curr.minutes, 0);
          return (totalMins / 60).toFixed(1);
        });
        return { label: sub.name, data: dataArr, backgroundColor: sub.color, borderRadius: 4 };
      });

      if (weeklyChartInstance) weeklyChartInstance.destroy();
      weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } } }
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: value => value + ' h' } }
          }
        }
      });
    }

    function renderSubjectChart() {
      const ctx = document.getElementById('subjectChart').getContext('2d');
      const subjectTotals = {};
      subjects.forEach(s => subjectTotals[s.id] = 0);
      logs.forEach(l => {
        if (subjectTotals[l.subjectId] !== undefined) subjectTotals[l.subjectId] += l.minutes;
      });

      const labels = [], data = [], colors = [];
      subjects.forEach(s => {
        if (subjectTotals[s.id] > 0) {
          labels.push(s.name);
          data.push(subjectTotals[s.id]);
          colors.push(s.color);
        }
      });

      if (subjectChartInstance) subjectChartInstance.destroy();
      if (data.length === 0) return;

      subjectChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }

    function setHistoryFilter(filter) {
      historyPeriodFilter = filter;
      ['all', 'today', 'week', 'month'].forEach(f => {
        const btn = document.getElementById(`hist-filter-${f}`);
        if (btn) {
          if (f === filter) btn.className = "px-3 py-1.5 rounded-lg transition bg-white text-indigo-600 shadow-sm font-semibold";
          else btn.className = "px-3 py-1.5 rounded-lg transition text-slate-600";
        }
      });
      renderHistoryTable();
    }

    function renderHistoryTable() {
      const tbody = document.getElementById('history-tbody');
      const emptyState = document.getElementById('history-empty');
      if (!tbody) return;

      const filterSub = document.getElementById('history-filter-subject').value;
      const searchQuery = document.getElementById('history-search-input').value.trim().toLowerCase();

      const filterSelect = document.getElementById('history-filter-subject');
      const currentFilterVal = filterSelect.value;
      filterSelect.innerHTML = '<option value="all">すべての科目</option>' + subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      filterSelect.value = currentFilterVal;

      tbody.innerHTML = '';
      const todayStr = getTodayString();
      const weekStart = getNDaysAgoDate(6);
      const monthStart = todayStr.slice(0, 7) + '-01';

      let filteredLogs = [...logs];
      if (historyPeriodFilter === 'today') {
        filteredLogs = filteredLogs.filter(l => l.date === todayStr);
        document.getElementById('history-period-label').innerText = '本日の勉強時間';
      } else if (historyPeriodFilter === 'week') {
        filteredLogs = filteredLogs.filter(l => l.date >= weekStart && l.date <= todayStr);
        document.getElementById('history-period-label').innerText = '直近7日間の勉強時間';
      } else if (historyPeriodFilter === 'month') {
        filteredLogs = filteredLogs.filter(l => l.date >= monthStart && l.date <= todayStr);
        document.getElementById('history-period-label').innerText = '今月の勉強時間';
      } else {
        document.getElementById('history-period-label').innerText = '全期間の総勉強時間';
      }

      if (filterSub !== 'all') filteredLogs = filteredLogs.filter(l => l.subjectId === filterSub);
      if (searchQuery) filteredLogs = filteredLogs.filter(l => (l.note || '').toLowerCase().includes(searchQuery));

      const periodMins = filteredLogs.reduce((sum, l) => sum + l.minutes, 0);
      document.getElementById('history-period-time').innerText = formatMinutes(periodMins);
      document.getElementById('history-period-count').innerText = `${filteredLogs.length}回`;

      if (filteredLogs.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      } else {
        emptyState.classList.add('hidden');
      }

      filteredLogs.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id)).forEach(log => {
        const subject = subjects.find(s => s.id === log.subjectId) || { name: '未分類', color: '#94a3b8' };
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/80 transition";
        tr.innerHTML = `
          <td class="py-4 px-6 font-mono text-xs text-slate-500">${log.date}</td>
          <td class="py-4 px-6"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium" style="background-color: ${subject.color}15; color: ${subject.color}"><span class="w-2 h-2 rounded-full" style="background-color: ${subject.color}"></span>${subject.name}</span></td>
          <td class="py-4 px-6 font-semibold text-slate-800">${formatMinutes(log.minutes)}</td>
          <td class="py-4 px-6 text-slate-500 max-w-xs truncate">${log.note || '-'}</td>
          <td class="py-4 px-6 text-right"><button onclick="deleteLog('${log.id}')" class="text-slate-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
        `;
        tbody.appendChild(tr);
      });
      lucide.createIcons();
    }

    function deleteLog(id) {
      logs = logs.filter(l => l.id !== id);
      saveLogs();
      renderHistoryTable();
      updateDashboardData();
      showToast('学習記録を削除しました');
    }

    function exportBackupData() {
      const backupData = {
        version: 1,
        date: getTodayString(),
        subjects: subjects,
        logs: logs,
        todos: todos,
        problemLogs: problemLogs,
        dailyGoal: dailyGoal,
        timeSchedules: window.timeSchedules,
        customScheduleTasks: window.customScheduleTasks,
        schedulePresets: window.schedulePresets
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `study_tracker_backup_${getTodayString()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('セーブデータを書き出しました！');
    }

    function importBackupData(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          if (data && data.subjects && data.logs) {
            subjects = data.subjects;
            logs = data.logs;
            todos = data.todos || [];
            problemLogs = data.problemLogs || [];
            dailyGoal = data.dailyGoal || 4.0;
            window.timeSchedules = data.timeSchedules || [];
            window.customScheduleTasks = data.customScheduleTasks || [];
            window.schedulePresets = data.schedulePresets || {};

            saveSubjects();
            saveLogs();
            saveTodos();
            localStorage.setItem('st_problem_logs', JSON.stringify(problemLogs));
            localStorage.setItem('st_goal', dailyGoal);
            localStorage.setItem('st_time_schedules', JSON.stringify(window.timeSchedules));
            localStorage.setItem('st_custom_sched_tasks', JSON.stringify(window.customScheduleTasks));
            localStorage.setItem('st_sched_presets', JSON.stringify(window.schedulePresets));
            if (typeof notifyDataChanged === 'function') notifyDataChanged();

            renderSubjectOptions();
            renderSubjectList();
            updateDashboardData();
            refreshActiveTodoView();
            renderProblemHistory();
            renderCustomScheduleTasksList();
            renderSchedulePresetsList();
            showToast('データを正常に読み込みました！');
          } else {
            showToast('無効なファイル形式です');
          }
        } catch (err) {
          showToast('ファイルの読み込みに失敗しました');
        }
        event.target.value = '';
      };
      reader.readAsText(file);
    }
