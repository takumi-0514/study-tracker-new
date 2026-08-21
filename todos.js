// ==== ToDo・スケジュール機能 ====
// ToDoリスト、カレンダー、時間割スケジュール、プリセット

    function setTodoViewMode(mode) {
      todoViewMode = mode;
      const listBtn = document.getElementById('todo-view-list-btn');
      const scheduleBtn = document.getElementById('todo-view-schedule-btn');
      const calBtn = document.getElementById('todo-view-calendar-btn');
      const listView = document.getElementById('todo-list-view');
      const scheduleView = document.getElementById('todo-schedule-view');
      const calView = document.getElementById('todo-calendar-view');

      const formBoxList = document.getElementById('form-box-list');
      const formBoxSchedule = document.getElementById('form-box-schedule');

      [listBtn, scheduleBtn, calBtn].forEach(b => {
        if (b) b.className = "px-3 py-1.5 rounded-lg transition text-slate-600";
      });
      [listView, scheduleView, calView].forEach(v => {
        if (v) v.classList.add('hidden');
      });

      if (mode === 'list') {
        if (listBtn) listBtn.className = "px-3 py-1.5 rounded-lg transition bg-white text-indigo-600 shadow-sm font-semibold";
        if (listView) listView.classList.remove('hidden');
        if (formBoxList) formBoxList.classList.remove('hidden');
        if (formBoxSchedule) formBoxSchedule.classList.add('hidden');
        renderTodoList();
      } else if (mode === 'schedule') {
        if (scheduleBtn) scheduleBtn.className = "px-3 py-1.5 rounded-lg transition bg-white text-indigo-600 shadow-sm font-semibold";
        if (scheduleView) scheduleView.classList.remove('hidden');
        if (formBoxList) formBoxList.classList.add('hidden');
        if (formBoxSchedule) formBoxSchedule.classList.remove('hidden');
        renderScheduleView();
      } else if (mode === 'calendar') {
        if (calBtn) calBtn.className = "px-3 py-1.5 rounded-lg transition bg-white text-indigo-600 shadow-sm font-semibold";
        if (calView) calView.classList.remove('hidden');
        if (formBoxList) formBoxList.classList.remove('hidden');
        if (formBoxSchedule) formBoxSchedule.classList.add('hidden');
        renderCalendarView();
      }
    }

    function handleAddTodo(e) {
      e.preventDefault();
      const titleInput = document.getElementById('todo-title-input');
      const subjectSelect = document.getElementById('todo-subject-select');
      const startDateInput = document.getElementById('todo-startdate-input');
      const dueDateInput = document.getElementById('todo-duedate-input');
      const timeInput = document.getElementById('todo-time-input');

      const todayStr = getTodayString();
      const newTodo = {
        id: 'todo_' + Date.now(),
        title: titleInput.value.trim(),
        subjectId: subjectSelect.value,
        startDate: startDateInput.value || todayStr,
        dueDate: dueDateInput.value || todayStr,
        estimatedMinutes: parseInt(timeInput.value) || null,
        completed: false,
        createdAt: todayStr
      };

      todos.push(newTodo);
      saveTodos();

      titleInput.value = '';
      timeInput.value = '';
      showToast('タスクを追加しました！');

      refreshActiveTodoView();
    }

    function handleScheduleTaskAdd(e) {
      e.preventDefault();
      const editId = document.getElementById('sched-edit-task-id').value;
      const name = document.getElementById('sched-task-name').value.trim();
      const color = document.getElementById('sched-task-color').value;

      if (!name) return;

      if (editId) {
        const task = window.customScheduleTasks.find(t => t.id === editId);
        if (task) {
          task.name = name;
          task.color = color;
        }
        cancelScheduleTaskEdit();
        showToast('スケジュール用タスクを更新しました！');
      } else {
        window.customScheduleTasks.push({
          id: 'ctask_' + Date.now(),
          name: name,
          color: color
        });
        document.getElementById('sched-task-name').value = '';
        showToast('スケジュール用タスクを追加しました！');
      }

      localStorage.setItem('st_custom_sched_tasks', JSON.stringify(window.customScheduleTasks));
      renderCustomScheduleTasksList();
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
    }

    function editCustomScheduleTask(id) {
      const task = window.customScheduleTasks.find(t => t.id === id);
      if (!task) return;

      document.getElementById('sched-edit-task-id').value = task.id;
      document.getElementById('sched-task-name').value = task.name;
      document.getElementById('sched-task-color').value = task.color;
      document.getElementById('sched-task-submit-btn').innerText = '更新';
      document.getElementById('sched-task-cancel-btn').classList.remove('hidden');
    }

    function cancelScheduleTaskEdit() {
      document.getElementById('sched-edit-task-id').value = '';
      document.getElementById('sched-task-name').value = '';
      document.getElementById('sched-task-color').value = '#3b82f6';
      document.getElementById('sched-task-submit-btn').innerText = '追加';
      document.getElementById('sched-task-cancel-btn').classList.add('hidden');
    }

    function renderCustomScheduleTasksList() {
      const container = document.getElementById('schedule-custom-tasks-list');
      if (!container) return;
      container.innerHTML = '';

      if (window.customScheduleTasks.length === 0) {
        container.innerHTML = `<div class="text-[11px] text-slate-400 text-center py-2">タスクがありません</div>`;
        return;
      }

      window.customScheduleTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = "flex items-center justify-between bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-xs";
        item.innerHTML = `
          <div class="flex items-center gap-2 truncate">
            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${task.color}"></span>
            <span class="font-medium text-slate-800 truncate">${task.name}</span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button onclick="editCustomScheduleTask('${task.id}')" class="text-slate-400 hover:text-indigo-600 p-1 rounded transition" title="編集"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
            <button onclick="deleteCustomScheduleTask('${task.id}')" class="text-slate-400 hover:text-rose-500 p-1 rounded transition" title="削除"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        `;
        container.appendChild(item);
      });
      lucide.createIcons();
    }

    function deleteCustomScheduleTask(id) {
      window.customScheduleTasks = window.customScheduleTasks.filter(t => t.id !== id);
      localStorage.setItem('st_custom_sched_tasks', JSON.stringify(window.customScheduleTasks));
      renderCustomScheduleTasksList();
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
      showToast('スケジュール用タスクを削除しました');
    }

    function toggleTodoStatus(id) {
      const todo = todos.find(t => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
        saveTodos();
        refreshActiveTodoView();
      }
    }

    function deleteTodo(id) {
      todos = todos.filter(t => t.id !== id);
      saveTodos();
      refreshActiveTodoView();
      showToast('タスクを削除しました');
    }

    function editTodo(id) {
      const todo = todos.find(t => t.id === id);
      if (!todo) return;

      document.getElementById('edit-todo-id').value = todo.id;
      document.getElementById('edit-todo-title').value = todo.title;
      
      const select = document.getElementById('edit-todo-subject');
      select.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      select.value = todo.subjectId;

      document.getElementById('edit-todo-startdate').value = todo.startDate || getTodayString();
      document.getElementById('edit-todo-duedate').value = todo.dueDate || '';
      document.getElementById('edit-todo-time').value = todo.estimatedMinutes || '';

      document.getElementById('edit-todo-modal').classList.remove('hidden');
    }

    function closeEditTodoModal() {
      document.getElementById('edit-todo-modal').classList.add('hidden');
    }

    function handleEditTodoSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('edit-todo-id').value;
      const todo = todos.find(t => t.id === id);
      if (todo) {
        todo.title = document.getElementById('edit-todo-title').value.trim();
        todo.subjectId = document.getElementById('edit-todo-subject').value;
        todo.startDate = document.getElementById('edit-todo-startdate').value || getTodayString();
        todo.dueDate = document.getElementById('edit-todo-duedate').value || null;
        todo.estimatedMinutes = parseInt(document.getElementById('edit-todo-time').value) || null;
        saveTodos();
        closeEditTodoModal();
        refreshActiveTodoView();
        showToast('タスクを更新しました');
      }
    }

    function clearCompletedTodos() {
      const completedList = todos.filter(t => t.completed);
      if (completedList.length === 0) {
        showToast('完了済みのタスクはありません');
        return;
      }

      todos = todos.filter(t => !t.completed);
      saveTodos();
      refreshActiveTodoView();
      showToast(`${completedList.length}件の完了タスクを一括削除しました`);
    }

    function setTodoFilter(filter) {
      currentTodoFilter = filter;
      ['all', 'pending', 'completed'].forEach(f => {
        const btn = document.getElementById(`filter-${f}-btn`);
        if (btn) {
          if (f === filter) {
            btn.className = "px-3 py-1.5 rounded-md bg-white shadow-sm text-indigo-600 font-semibold transition";
          } else {
            btn.className = "px-3 py-1.5 rounded-md text-slate-600 transition";
          }
        }
      });
      renderTodoList();
    }

    function refreshActiveTodoView() {
      if (todoViewMode === 'list') renderTodoList();
      else if (todoViewMode === 'schedule') renderScheduleView();
      else if (todoViewMode === 'calendar') renderCalendarView();
    }

    function startTimerForTodo(todoId) {
      const todo = todos.find(t => t.id === todoId);
      if (!todo) return;

      activeTodoTask = todo;
      document.getElementById('active-task-title').innerText = todo.title;
      document.getElementById('active-task-banner').classList.remove('hidden');

      document.getElementById('timer-subject-select').value = todo.subjectId;

      switchTab('timer');
      showToast(`「${todo.title}」でタイマーを準備しました`);
    }

    function getRangeBadge(start, due, completed) {
      if (!due) return '';
      const today = getTodayString();
      const s = start || today;

      if (today >= s && today <= due) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800"><i data-lucide="clock" class="w-3 h-3"></i> 実施期間中 (${s} 〜 ${due})</span>`;
      }
      if (due < today && !completed) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-700"><i data-lucide="alert-circle" class="w-3 h-3"></i> 期限超過 (${due})</span>`;
      }
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600"><i data-lucide="calendar" class="w-3 h-3"></i> ${s} 〜 ${due}</span>`;
    }

    function renderTodoList() {
      const container = document.getElementById('todo-container');
      const emptyState = document.getElementById('todo-empty');
      if (!container) return;

      container.innerHTML = '';
      let filteredTodos = [...todos];

      filteredTodos.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return 0;
      });

      if (currentTodoFilter === 'pending') {
        filteredTodos = filteredTodos.filter(t => !t.completed);
      } else if (currentTodoFilter === 'completed') {
        filteredTodos = filteredTodos.filter(t => t.completed);
      }

      const totalCount = todos.length;
      const completedCount = todos.filter(t => t.completed).length;
      const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      const progressText = document.getElementById('todo-progress-text');
      if (progressText) progressText.innerText = `${completedCount} / ${totalCount} 完了 (${percent}%)`;

      if (filteredTodos.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      } else {
        if (emptyState) emptyState.classList.add('hidden');
      }

      filteredTodos.forEach(todo => {
        const subject = subjects.find(s => s.id === todo.subjectId) || { name: '未分類', color: '#94a3b8' };
        const badge = getRangeBadge(todo.startDate, todo.dueDate, todo.completed);

        const card = document.createElement('div');
        card.className = `p-4 rounded-xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-sm ${todo.completed ? 'opacity-60 bg-slate-50 border-slate-200' : 'border-slate-200/80 hover:border-indigo-200'}`;

        card.innerHTML = `
          <div class="flex items-start gap-3">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodoStatus('${todo.id}')" class="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
            <div>
              <div class="font-medium text-slate-800 ${todo.completed ? 'line-through text-slate-400' : ''}">${todo.title}</div>
              <div class="flex flex-wrap items-center gap-2 mt-1.5">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium" style="background-color: ${subject.color}15; color: ${subject.color}">
                  <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${subject.color}"></span>
                  ${subject.name}
                </span>
                ${badge}
                ${todo.estimatedMinutes ? `<span class="text-xs text-slate-400 flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${todo.estimatedMinutes}分</span>` : ''}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 self-end sm:self-center">
            ${!todo.completed ? `
              <button onclick="startTimerForTodo('${todo.id}')" class="flex items-center gap-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold px-3 py-1.5 rounded-lg transition">
                <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i> タイマー
              </button>
            ` : ''}
            <button onclick="editTodo('${todo.id}')" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition" title="編集"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
            <button onclick="deleteTodo('${todo.id}')" class="text-slate-400 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition" title="削除"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        `;
        container.appendChild(card);
      });
      lucide.createIcons();
    }

    function renderScheduleView() {
      const todayObj = new Date();
      const tomorrowObj = new Date();
      tomorrowObj.setDate(todayObj.getDate() + 1);

      const todayStr = formatDateObj(todayObj);
      const tomorrowStr = formatDateObj(tomorrowObj);

      document.getElementById('schedule-today-date-label').innerText = todayStr;
      document.getElementById('schedule-tomorrow-date-label').innerText = tomorrowStr;

      renderPieSchedule('today', todayStr);
      renderPieSchedule('tomorrow', tomorrowStr);
      renderSchedulePresetsList();
    }

    function renderPieSchedule(dayType, dateStr) {
      const canvasId = dayType === 'today' ? 'todayPieChart' : 'tomorrowPieChart';
      const listTextId = dayType === 'today' ? 'schedule-today-list-text' : 'schedule-tomorrow-list-text';
      
      const dayItems = window.timeSchedules.filter(s => s.date === dateStr);
      dayItems.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      const listContainer = document.getElementById(listTextId);
      listContainer.innerHTML = '';

      if (dayItems.length === 0) {
        listContainer.innerHTML = `<div class="text-xs text-slate-400 text-center py-2">予定がありません。「予定を追加」ボタンから登録してください</div>`;
      } else {
        dayItems.forEach(item => {
          const cTask = window.customScheduleTasks.find(t => t.name === item.content);
          const itemColor = item.color || (cTask ? cTask.color : '#3b82f6');

          const itemDiv = document.createElement('div');
          itemDiv.className = "flex items-center justify-between bg-white border border-slate-200/80 p-2 rounded-xl text-xs";

          itemDiv.innerHTML = `
            <div class="truncate text-slate-800 font-medium flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${itemColor}"></span>
              <span class="font-mono text-indigo-600 font-bold">${item.startTime}〜${item.endTime}</span>
              <span class="truncate">${item.content}</span>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button onclick="openScheduleModal('${dayType}', '${item.id}')" class="text-slate-400 hover:text-indigo-600 p-1 transition" title="編集"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
              <button onclick="deleteScheduleItem('${item.id}')" class="text-slate-400 hover:text-rose-500 p-1 transition" title="削除"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
          `;
          listContainer.appendChild(itemDiv);
        });
      }

      let labels = [];
      let data = [];
      let backgroundColors = [];

      let currentMins = 0;
      dayItems.forEach((item) => {
        const startMins = timeToMinutes(item.startTime);
        const endMins = timeToMinutes(item.endTime);

        if (startMins > currentMins) {
          labels.push('自由時間 / 予定なし');
          data.push(startMins - currentMins);
          backgroundColors.push('#e2e8f0');
        }

        if (endMins > startMins) {
          const cTask = window.customScheduleTasks.find(t => t.name === item.content);
          let itemColor = item.color || (cTask ? cTask.color : '#3b82f6');

          labels.push(`${item.content} (${item.startTime}〜${item.endTime})`);
          data.push(endMins - startMins);
          backgroundColors.push(itemColor);
          currentMins = Math.max(currentMins, endMins);
        }
      });

      if (currentMins < 1440) {
        labels.push('自由時間 / 予定なし');
        data.push(1440 - currentMins);
        backgroundColors.push('#e2e8f0');
      }

      const canvasEl = document.getElementById(canvasId);
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');

      if (dayType === 'today') {
        if (todayPieChartInstance) todayPieChartInstance.destroy();
      } else {
        if (tomorrowPieChartInstance) tomorrowPieChartInstance.destroy();
      }

      const chartObj = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const mins = context.parsed;
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return ` ${context.label}: 約 ${h}時間 ${m > 0 ? m + '分' : ''}`;
                }
              }
            }
          }
        }
      });

      if (dayType === 'today') todayPieChartInstance = chartObj;
      else tomorrowPieChartInstance = chartObj;

      lucide.createIcons();
    }

    function openScheduleModal(dayType, editId = null) {
      document.getElementById('schedule-modal-day-type').value = dayType;
      document.getElementById('schedule-modal-edit-id').value = editId || '';

      const todayObj = new Date();
      if (dayType === 'tomorrow') todayObj.setDate(todayObj.getDate() + 1);
      const dateStr = formatDateObj(todayObj);

      const daySchedules = window.timeSchedules.filter(s => s.date === dateStr);

      let defaultStart = "08:00";
      if (!editId && daySchedules.length > 0) {
        daySchedules.sort((a, b) => timeToMinutes(b.endTime) - timeToMinutes(a.endTime));
        defaultStart = daySchedules[0].endTime;
      }

      let defaultEnd = "09:00";
      const [sh, sm] = defaultStart.split(':').map(Number);
      let endTotalMin = (sh * 60 + sm) + 60;
      if (endTotalMin > 1440) endTotalMin = 1440;
      const eh = Math.floor(endTotalMin / 60);
      const em = endTotalMin % 60;
      defaultEnd = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

      let targetEditItem = null;
      if (editId) {
        targetEditItem = window.timeSchedules.find(s => s.id === editId);
        if (targetEditItem) {
          defaultStart = targetEditItem.startTime;
          defaultEnd = targetEditItem.endTime;
        }
      }

      document.getElementById('schedule-modal-title').innerText = editId ? '予定の編集' : `${dayType === 'today' ? '今日' : '明日'} (${dateStr}) の予定追加`;
      document.getElementById('schedule-modal-submit-btn').innerText = editId ? '変更を保存する' : '予定を追加する';

      let timeOptions = '';
      for (let h = 0; h <= 24; h++) {
        for (let m of (h === 24 ? [0] : [0, 30])) {
          const tStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          timeOptions += `<option value="${tStr}">${tStr}</option>`;
        }
      }
      document.getElementById('schedule-modal-start').innerHTML = timeOptions;
      document.getElementById('schedule-modal-end').innerHTML = timeOptions;

      document.getElementById('schedule-modal-start').value = defaultStart;
      document.getElementById('schedule-modal-end').value = defaultEnd;

      const todoSelect = document.getElementById('schedule-modal-custom-task-select');
      todoSelect.innerHTML = '<option value="">-- スケジュール用タスクから選択 --</option>' + window.customScheduleTasks.map(t => `<option value="${t.name}" data-color="${t.color}">${t.name}</option>`).join('');

      if (targetEditItem) {
        document.getElementById('schedule-modal-content').value = targetEditItem.content;
      } else {
        document.getElementById('schedule-modal-content').value = '';
      }

      document.getElementById('schedule-modal').classList.remove('hidden');
    }

    function closeScheduleModal() {
      document.getElementById('schedule-modal').classList.add('hidden');
    }

    function fillScheduleFromCustomTask(val) {
      if (val) {
        document.getElementById('schedule-modal-content').value = val;
        const matched = window.customScheduleTasks.find(t => t.name === val);
        if (matched) {
          window._tempSelectedColor = matched.color;
        }
      } else {
        window._tempSelectedColor = null;
      }
    }

    function handleScheduleModalSubmit(e) {
      e.preventDefault();
      const dayType = document.getElementById('schedule-modal-day-type').value;
      const editId = document.getElementById('schedule-modal-edit-id').value;
      const startTime = document.getElementById('schedule-modal-start').value;
      const endTime = document.getElementById('schedule-modal-end').value;
      const content = document.getElementById('schedule-modal-content').value.trim();

      const todayObj = new Date();
      if (dayType === 'tomorrow') todayObj.setDate(todayObj.getDate() + 1);
      const dateStr = formatDateObj(todayObj);

      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        showToast('終了時間は開始時間より後に設定してください');
        return;
      }

      const cTask = window.customScheduleTasks.find(t => t.name === content);
      let assignedColor = window._tempSelectedColor || (cTask ? cTask.color : '#3b82f6');
      window._tempSelectedColor = null;

      if (editId) {
        const target = window.timeSchedules.find(s => s.id === editId);
        if (target) {
          target.startTime = startTime;
          target.endTime = endTime;
          target.content = content;
          target.color = assignedColor;
        }
        showToast('スケジュールを更新しました！');
      } else {
        window.timeSchedules.push({
          id: 'sch_' + Date.now(),
          date: dateStr,
          startTime: startTime,
          endTime: endTime,
          content: content,
          color: assignedColor
        });
        showToast('スケジュールに追加しました！');
      }

      localStorage.setItem('st_time_schedules', JSON.stringify(window.timeSchedules));
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
      closeScheduleModal();
      renderScheduleView();
    }

    function deleteScheduleItem(id) {
      window.timeSchedules = window.timeSchedules.filter(s => s.id !== id);
      localStorage.setItem('st_time_schedules', JSON.stringify(window.timeSchedules));
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
      renderScheduleView();
      showToast('スケジュールを削除しました');
    }

    function copyScheduleToTomorrow() {
      const todayObj = new Date();
      const tomorrowObj = new Date();
      tomorrowObj.setDate(todayObj.getDate() + 1);

      const todayStr = formatDateObj(todayObj);
      const tomorrowStr = formatDateObj(tomorrowObj);

      const todayItems = window.timeSchedules.filter(s => s.date === todayStr);
      if (todayItems.length === 0) {
        showToast('コピーする今日の予定がありません');
        return;
      }

      window.timeSchedules = window.timeSchedules.filter(s => s.date !== tomorrowStr);
      todayItems.forEach(item => {
        window.timeSchedules.push({
          ...item,
          id: 'sch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          date: tomorrowStr
        });
      });

      localStorage.setItem('st_time_schedules', JSON.stringify(window.timeSchedules));
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
      renderScheduleView();
      showToast('今日のスケジュールを明日にコピーしました！');
    }

    function saveCurrentScheduleAsPreset() {
      const presetName = document.getElementById('sched-preset-name').value.trim();
      if (!presetName) {
        showToast('テンプレート名を入力してください');
        return;
      }

      const todayObj = new Date();
      const todayStr = formatDateObj(todayObj);
      const todayItems = window.timeSchedules.filter(s => s.date === todayStr);

      if (todayItems.length === 0) {
        showToast('保存する今日の予定がありません');
        return;
      }

      window.schedulePresets[presetName] = todayItems.map(i => ({
        startTime: i.startTime,
        endTime: i.endTime,
        content: i.content,
        color: i.color
      }));

      localStorage.setItem('st_sched_presets', JSON.stringify(window.schedulePresets));
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
      document.getElementById('sched-preset-name').value = '';
      renderSchedulePresetsList();
      showToast(`テンプレート「${presetName}」を保存しました！`);
    }

    function renderSchedulePresetsList() {
      const container = document.getElementById('schedule-presets-list');
      if (!container) return;
      container.innerHTML = '';

      const keys = Object.keys(window.schedulePresets);
      if (keys.length === 0) {
        container.innerHTML = `<span class="text-[11px] text-slate-400">保存されたテンプレートはありません</span>`;
        return;
      }

      keys.forEach(presetName => {
        const badge = document.createElement('div');
        badge.className = "flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs transition cursor-pointer";
        badge.innerHTML = `
          <span onclick="promptLoadPreset('${presetName}')" class="font-medium">${presetName}を読み込む</span>
          <button onclick="deleteSchedulePreset(event, '${presetName}')" class="text-slate-400 hover:text-rose-500 ml-1"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
        `;
        container.appendChild(badge);
      });
      lucide.createIcons();
    }

    function promptLoadPreset(presetName) {
      document.getElementById('preset-load-name-label').innerText = presetName;
      document.getElementById('preset-load-target-name').value = presetName;
      document.getElementById('preset-load-modal').classList.remove('hidden');
    }

    function closePresetLoadModal() {
      document.getElementById('preset-load-modal').classList.add('hidden');
    }

    function confirmLoadPreset(dayType) {
      const presetName = document.getElementById('preset-load-target-name').value;
      const presetItems = window.schedulePresets[presetName];
      if (!presetItems) return;

      const targetObj = new Date();
      if (dayType === 'tomorrow') targetObj.setDate(targetObj.getDate() + 1);
      const targetStr = formatDateObj(targetObj);

      window.timeSchedules = window.timeSchedules.filter(s => s.date !== targetStr);
      presetItems.forEach(item => {
        window.timeSchedules.push({
          id: 'sch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          date: targetStr,
          startTime: item.startTime,
          endTime: item.endTime,
          content: item.content,
          color: item.color
        });
      });

      localStorage.setItem('st_time_schedules', JSON.stringify(window.timeSchedules));
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
      closePresetLoadModal();
      renderScheduleView();
      showToast(`テンプレート「${presetName}」を${dayType === 'today' ? '今日' : '明日'}に読み込みました！`);
    }

    function deleteSchedulePreset(e, presetName) {
      e.stopPropagation();
      delete window.schedulePresets[presetName];
      localStorage.setItem('st_sched_presets', JSON.stringify(window.schedulePresets));
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
      renderSchedulePresetsList();
      showToast(`テンプレート「${presetName}」を削除しました`);
    }

    function renderCalendarView() {
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth();
      document.getElementById('calendar-month-year').innerText = `${year}年 ${month + 1}月`;

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDayOfWeek = firstDay.getDay(); 
      const totalDays = lastDay.getDate();

      const container = document.getElementById('calendar-days-container');
      if (!container) return;
      container.innerHTML = '';

      const todayStr = getTodayString();

      for (let i = 0; i < startDayOfWeek; i++) {
        const blank = document.createElement('div');
        blank.className = "min-h-[85px] bg-slate-50/50 rounded-lg border border-slate-100/50 p-1";
        container.appendChild(blank);
      }

      for (let day = 1; day <= totalDays; day++) {
        const currentMonthStr = String(month + 1).padStart(2, '0');
        const currentDayStr = String(day).padStart(2, '0');
        const dateStr = `${year}-${currentMonthStr}-${currentDayStr}`;
        const isToday = dateStr === todayStr;

        const dayTodos = todos.filter(t => {
          const s = t.startDate || t.dueDate || dateStr;
          const d = t.dueDate || s;
          return dateStr >= s && dateStr <= d;
        });

        const dayCell = document.createElement('div');
        dayCell.className = `min-h-[85px] p-1.5 rounded-lg border flex flex-col justify-between transition cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 ${isToday ? 'bg-indigo-50/50 border-indigo-300' : 'bg-white border-slate-100'}`;
        dayCell.onclick = () => openDayDetailModal(dateStr);

        let todosHtml = '';
        dayTodos.slice(0, 3).forEach(t => {
          const sub = subjects.find(s => s.id === t.subjectId) || { color: '#6366f1' };
          todosHtml += `
            <div title="${t.title}" class="text-[10px] truncate px-1 py-0.5 rounded font-medium my-0.5 border flex items-center justify-between gap-1" style="background-color: ${sub.color}15; border-color: ${sub.color}30; color: ${sub.color}">
              <span class="${t.completed ? 'line-through opacity-60' : ''} truncate">${t.title}</span>
            </div>
          `;
        });
        if (dayTodos.length > 3) {
          todosHtml += `<div class="text-[9px] text-slate-400 font-semibold text-right">+他 ${dayTodos.length - 3}件</div>`;
        }

        dayCell.innerHTML = `
          <div>
            <div class="text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-600'} mb-1">${day}日</div>
            <div class="space-y-0.5">${todosHtml}</div>
          </div>
        `;
        container.appendChild(dayCell);
      }
      lucide.createIcons();
    }

    function openDayDetailModal(dateStr) {
      document.getElementById('modal-date-title').innerText = dateStr;
      document.getElementById('modal-target-date').value = dateStr;

      const subjectSelect = document.getElementById('modal-todo-subject');
      subjectSelect.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

      renderModalTodoList(dateStr);
      document.getElementById('day-detail-modal').classList.remove('hidden');
    }

    function closeDayDetailModal() {
      document.getElementById('day-detail-modal').classList.add('hidden');
      refreshActiveTodoView();
    }

    function renderModalTodoList(dateStr) {
      const container = document.getElementById('modal-todo-list');
      container.innerHTML = '';

      const dayTodos = todos.filter(t => {
        const s = t.startDate || t.dueDate || dateStr;
        const d = t.dueDate || s;
        return dateStr >= s && dateStr <= d;
      });

      if (dayTodos.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-400 text-center py-6">この日のタスクはありません</div>`;
        return;
      }

      dayTodos.forEach(t => {
        const sub = subjects.find(s => s.id === t.subjectId) || { name: '未分類', color: '#6366f1' };
        const itemDiv = document.createElement('div');
        itemDiv.className = `p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs ${t.completed ? 'opacity-60' : ''}`;
        itemDiv.innerHTML = `
          <div class="flex items-center gap-2.5 truncate">
            <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTodoStatus('${t.id}'); renderModalTodoList('${dateStr}');" class="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer">
            <div>
              <div class="font-medium text-slate-800 ${t.completed ? 'line-through text-slate-400' : ''}">${t.title}</div>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium mt-0.5" style="background-color: ${sub.color}15; color: ${sub.color}">${sub.name}</span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="editTodo('${t.id}'); closeDayDetailModal();" class="text-slate-400 hover:text-indigo-600 p-1 rounded" title="編集"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
            <button onclick="deleteTodo('${t.id}'); renderModalTodoList('${dateStr}');" class="text-slate-400 hover:text-rose-500 p-1 rounded" title="削除"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        `;
        container.appendChild(itemDiv);
      });
      lucide.createIcons();
    }

    function handleModalAddTodo(e) {
      e.preventDefault();
      const dateStr = document.getElementById('modal-target-date').value;
      const title = document.getElementById('modal-todo-title').value.trim();
      const subjectId = document.getElementById('modal-todo-subject').value;
      const time = parseInt(document.getElementById('modal-todo-time').value) || null;

      if (!title) return;

      const newTodo = {
        id: 'todo_' + Date.now(),
        title: title,
        subjectId: subjectId,
        startDate: dateStr,
        dueDate: dateStr,
        estimatedMinutes: time,
        completed: false,
        createdAt: getTodayString()
      };

      todos.push(newTodo);
      saveTodos();

      document.getElementById('modal-todo-title').value = '';
      document.getElementById('modal-todo-time').value = '';
      renderModalTodoList(dateStr);
      showToast('タスクを追加しました！');
    }

    function changeCalendarMonth(offset) {
      calendarDate.setMonth(calendarDate.getMonth() + offset);
      renderCalendarView();
    }

    function resetCalendarToToday() {
      calendarDate = new Date();
      renderCalendarView();
    }
