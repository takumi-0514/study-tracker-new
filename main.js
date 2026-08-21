// ==== 初期化 ====
// DOMContentLoaded時にUIを初期描画する

    window.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();
      document.getElementById('manual-date').value = getTodayString();
      document.getElementById('todo-startdate-input').value = getTodayString();
      document.getElementById('todo-duedate-input').value = getTodayString();
      document.getElementById('goal-input').value = window.dailyGoal;
      
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const hoursStr = String(now.getHours()).padStart(2, '0');
      const minsStr = String(now.getMinutes()).padStart(2, '0');
      document.getElementById('target-time-input').value = `${hoursStr}:${minsStr}`;

      renderSubjectOptions();
      renderSubjectList();
      updateDashboardData();
      renderTodoList();
      renderProblemHistory();
      renderCustomScheduleTasksList();
      renderSchedulePresetsList();
      
      if (window.subjects.length > 0) {
        document.getElementById('timer-subject-select').value = window.subjects[0].id;
        document.getElementById('prob-subject-select').value = window.subjects[0].id;
      }
      setTimerMode('stopwatch');

      setInterval(updateLiveClock, 1000);
      updateLiveClock();

      const probInput = document.getElementById('problem-name-input');
      if (probInput) {
        probInput.addEventListener('input', checkProblemComparison);
      }
    });
