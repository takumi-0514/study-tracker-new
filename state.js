// ==== グローバル状態管理 ====
// アプリ全体で共有する状態変数とlocalStorageからの初期読み込み

    const DEFAULT_SUBJECTS = [
      { id: 'sub_1', name: '英語', color: '#6366f1' },
      { id: 'sub_2', name: '数学', color: '#10b981' },
      { id: 'sub_3', name: 'プログラミング', color: '#f59e0b' },
      { id: 'sub_4', name: '読書', color: '#ec4899' }
    ];

    let activeTodoTask = null;
    let todoViewMode = 'list';
    let currentTodoFilter = 'all';
    let historyPeriodFilter = 'all';
    let calendarDate = new Date();
    let currentChartRange = '7days';

    let timerMode = 'stopwatch';
    let timerSeconds = 0;
    let targetTimerSeconds = 1800;
    let alarmTargetTimestamp = null;
    let timerInterval = null;
    let isTimerRunning = false;
    let hasTimerStartedEver = false;

    let pomoWorkMin = 25;
    let pomoBreakMin = 5;
    let totalSets = 4;
    let currentSet = 1;
    let loopState = 'work';

    let subjectElapsedSeconds = {};

    let probSeconds = 0;
    let probInterval = null;
    let isProbRunning = false;

    let alarmTimeout = null;
    let weeklyChartInstance = null;
    let subjectChartInstance = null;

    let todayPieChartInstance = null;
    let tomorrowPieChartInstance = null;

    window.subjects = JSON.parse(localStorage.getItem('st_subjects')) || DEFAULT_SUBJECTS;
    window.logs = JSON.parse(localStorage.getItem('st_logs')) || [];
    window.todos = JSON.parse(localStorage.getItem('st_todos')) || [];
    window.problemLogs = JSON.parse(localStorage.getItem('st_problem_logs')) || [];
    window.dailyGoal = parseFloat(localStorage.getItem('st_goal')) || 4.0;
    window.timeSchedules = JSON.parse(localStorage.getItem('st_time_schedules')) || [];
    window.customScheduleTasks = JSON.parse(localStorage.getItem('st_custom_sched_tasks')) || [
      { id: 'c_1', name: '自習・復習', color: '#3b82f6' },
      { id: 'c_2', name: '休憩', color: '#10b981' },
      { id: 'c_3', name: '部活・行事', color: '#f59e0b' }
    ];
    window.schedulePresets = JSON.parse(localStorage.getItem('st_sched_presets')) || {};


// ==== 永続化ヘルパー ====
// state.js で定義したグローバル変数をlocalStorageへ保存する

    function saveLogs() { 
      localStorage.setItem('st_logs', JSON.stringify(logs)); 
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
    }

    function saveSubjects() { 
      localStorage.setItem('st_subjects', JSON.stringify(subjects)); 
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
    }

    function saveTodos() { 
      localStorage.setItem('st_todos', JSON.stringify(todos)); 
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
    }
