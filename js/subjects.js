// ==== 科目・目標設定機能 ====

    function renderSubjectOptions() {
      const optionsHtml = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      ['manual-subject', 'prob-subject-select', 'todo-subject-select', 'edit-todo-subject', 'modal-todo-subject'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = optionsHtml;
      });
      const timerEl = document.getElementById('timer-subject-select');
      if (timerEl) {
        timerEl.innerHTML = optionsHtml + '<option value="break">☕ 休憩</option>';
      }
    }

    function renderSubjectList() {
      const container = document.getElementById('subject-list');
      if (!container) return;
      container.innerHTML = '';
      const { start: weekStart, end: weekEnd } = getCalendarWeekRange(0);
      subjects.forEach(sub => {
        const card = document.createElement('div');
        card.className = "flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl";

        let goalHtml = '';
        if (sub.weeklyGoalMinutes > 0) {
          const weekMins = logs.filter(l => l.subjectId === sub.id && l.date >= weekStart && l.date <= weekEnd)
                                .reduce((sum, l) => sum + l.minutes, 0);
          const percent = Math.min(100, Math.round((weekMins / sub.weeklyGoalMinutes) * 100));
          const achieved = weekMins >= sub.weeklyGoalMinutes;
          const weekStreak = calculateSubjectWeekStreak(sub.id);
          goalHtml = `
            <div class="mt-2 w-full">
              <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>週間目標 ${formatMinutes(sub.weeklyGoalMinutes)}</span>
                <span class="font-semibold ${achieved ? 'text-emerald-600' : 'text-slate-500'}">${achieved ? '✅ 達成' : `${percent}%`}</span>
              </div>
              <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div class="h-full rounded-full ${achieved ? 'bg-emerald-500' : ''}" style="width: ${percent}%; ${achieved ? '' : `background-color: ${sub.color}`}"></div>
              </div>
              ${weekStreak > 0 ? `<div class="text-[10px] text-orange-600 font-semibold mt-1">🔥 ${weekStreak}週連続達成中</div>` : ''}
            </div>
          `;
        }

        card.innerHTML = `
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${sub.color}"></div>
                <span class="font-medium text-slate-800 text-sm truncate">${sub.name}</span>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button onclick="editSubject('${sub.id}')" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition" title="編集"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                <button onclick="deleteSubject('${sub.id}')" class="text-slate-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition" title="削除"><i data-lucide="trash" class="w-4 h-4"></i></button>
              </div>
            </div>
            ${goalHtml}
          </div>
        `;
        container.appendChild(card);
      });
      lucide.createIcons();
    }

    function editSubject(id) {
      const sub = subjects.find(s => s.id === id);
      if (!sub) return;
      document.getElementById('edit-subject-id').value = sub.id;
      document.getElementById('edit-subject-name').value = sub.name;
      document.getElementById('edit-subject-color').value = sub.color;
      document.getElementById('edit-subject-weekly-goal').value = sub.weeklyGoalMinutes || '';
      document.getElementById('edit-subject-modal').classList.remove('hidden');
    }

    function closeEditSubjectModal() {
      document.getElementById('edit-subject-modal').classList.add('hidden');
    }

    function handleEditSubjectSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('edit-subject-id').value;
      const sub = subjects.find(s => s.id === id);
      if (sub) {
        sub.name = document.getElementById('edit-subject-name').value.trim();
        sub.color = document.getElementById('edit-subject-color').value;
        const goalVal = parseFloat(document.getElementById('edit-subject-weekly-goal').value);
        sub.weeklyGoalMinutes = goalVal > 0 ? goalVal : 0;
        saveSubjects();
        closeEditSubjectModal();
        renderSubjectOptions();
        renderSubjectList();
        updateDashboardData();
        refreshActiveTodoView();
        renderProblemHistory();
        showToast('科目を更新しました');
      }
    }

    function handleAddSubject(e) {
      e.preventDefault();
      const nameInput = document.getElementById('subject-name-input');
      const colorInput = document.getElementById('subject-color-input');
      const goalInput = document.getElementById('subject-weekly-goal-input');
      const goalVal = parseFloat(goalInput.value);
      subjects.push({ id: 'sub_' + Date.now(), name: nameInput.value.trim(), color: colorInput.value, weeklyGoalMinutes: goalVal > 0 ? goalVal : 0 });
      saveSubjects();
      nameInput.value = '';
      goalInput.value = '';
      renderSubjectOptions();
      renderSubjectList();
      updateDashboardData();
      showToast('科目を作成しました');
    }

    function deleteSubject(id) {
      if (subjects.length <= 1) { showToast('少なくとも1つの科目は必要です'); return; }
      subjects = subjects.filter(s => s.id !== id);
      saveSubjects();
      renderSubjectOptions();
      renderSubjectList();
      updateDashboardData();
      showToast('科目を削除しました');
    }

    function handleGoalSubmit(e) {
      e.preventDefault();
      const val = parseFloat(document.getElementById('goal-input').value);
      if (val > 0) { 
        dailyGoal = val; 
        localStorage.setItem('st_goal', dailyGoal); 
        if (typeof notifyDataChanged === 'function') notifyDataChanged();
        updateDashboardData(); 
        showToast('目標時間を更新しました'); 
      }
    }
