// ==== タイマー機能 ====
// ストップウォッチ/カウントダウン/時刻アラーム/ポモドーロ、問題演習タイマー

    function setTimerMode(mode) {
      if (isTimerRunning) {
        showToast('タイマー停止後にモードを変更できます');
        return;
      }
      timerMode = mode;
      const stopwatchBtn = document.getElementById('mode-stopwatch-btn');
      const timerBtn = document.getElementById('mode-timer-btn');
      const alarmBtn = document.getElementById('mode-alarm-btn');
      const pomodoroBtn = document.getElementById('mode-pomodoro-btn');
      const normalPanel = document.getElementById('normal-timer-panel');
      const alarmPanel = document.getElementById('alarm-timer-panel');
      const pomoSettings = document.getElementById('pomodoro-settings-panel');
      const loopStatus = document.getElementById('timer-loop-status');

      normalPanel.classList.add('hidden');
      alarmPanel.classList.add('hidden');
      pomoSettings.classList.add('hidden');
      loopStatus.classList.add('hidden');

      stopwatchBtn.className = "px-3.5 py-2 rounded-lg transition text-slate-600";
      timerBtn.className = "px-3.5 py-2 rounded-lg transition text-slate-600";
      alarmBtn.className = "px-3.5 py-2 rounded-lg transition text-slate-600";
      pomodoroBtn.className = "px-3.5 py-2 rounded-lg transition text-slate-600";

      if (mode === 'stopwatch') {
        stopwatchBtn.className = "px-3.5 py-2 rounded-lg transition bg-white shadow-sm text-indigo-600 font-semibold";
        timerSeconds = 0;
      } else if (mode === 'timer') {
        timerBtn.className = "px-3.5 py-2 rounded-lg transition bg-white shadow-sm text-indigo-600 font-semibold";
        normalPanel.classList.remove('hidden');
        const mins = parseInt(document.getElementById('normal-minutes-input').value) || 30;
        targetTimerSeconds = mins * 60;
        timerSeconds = targetTimerSeconds;
      } else if (mode === 'alarm') {
        alarmBtn.className = "px-3.5 py-2 rounded-lg transition bg-white shadow-sm text-indigo-600 font-semibold";
        alarmPanel.classList.remove('hidden');
        updateAlarmTimerTarget();
      } else if (mode === 'pomodoro') {
        pomodoroBtn.className = "px-3.5 py-2 rounded-lg transition bg-white shadow-sm text-indigo-600 font-semibold";
        pomoSettings.classList.remove('hidden');
        
        pomoWorkMin = parseInt(document.getElementById('pomo-work-input').value) || 25;
        pomoBreakMin = parseInt(document.getElementById('pomo-break-input').value) || 5;
        totalSets = parseInt(document.getElementById('pomo-sets-input').value) || 4;
        currentSet = 1;
        loopState = 'work';
        timerSeconds = pomoWorkMin * 60;
        subjectElapsedSeconds = {};

        loopStatus.classList.remove('hidden');
        loopStatus.innerText = `🔥 集中タイム (${currentSet} / ${totalSets}セット)`;
      }

      hasTimerStartedEver = false;
      updateSaveButtonState();
      updateTimerDisplay();
      renderLapList();
    }

    function updateNormalTimerInitial() {
      if (!isTimerRunning && timerMode === 'timer' && !hasTimerStartedEver) {
        const mins = parseInt(document.getElementById('normal-minutes-input').value) || 30;
        targetTimerSeconds = mins * 60;
        timerSeconds = targetTimerSeconds;
        updateTimerDisplay();
      }
    }

    function updateAlarmTimerTarget() {
      const timeVal = document.getElementById('target-time-input').value;
      if (!timeVal) return;
      const [hours, minutes] = timeVal.split(':').map(Number);
      
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);

      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      alarmTargetTimestamp = target.getTime();
      const diffSecs = Math.max(0, Math.floor((alarmTargetTimestamp - Date.now()) / 1000));
      
      if (!isTimerRunning && !hasTimerStartedEver) {
        timerSeconds = diffSecs;
        updateTimerDisplay();
      }
    }

    function updatePomodoroInitial() {
      if (!isTimerRunning && timerMode === 'pomodoro' && loopState === 'work' && !hasTimerStartedEver) {
        pomoWorkMin = parseInt(document.getElementById('pomo-work-input').value) || 25;
        timerSeconds = pomoWorkMin * 60;
        updateTimerDisplay();
      }
    }

    function applyPomodoroSettings() {
      if (isTimerRunning) {
        showToast('タイマー実行中は変更できません');
        return;
      }
      pomoWorkMin = parseInt(document.getElementById('pomo-work-input').value) || 25;
      pomoBreakMin = parseInt(document.getElementById('pomo-break-input').value) || 5;
      totalSets = parseInt(document.getElementById('pomo-sets-input').value) || 4;
      currentSet = 1;
      loopState = 'work';
      timerSeconds = pomoWorkMin * 60;
      subjectElapsedSeconds = {};
      hasTimerStartedEver = false;
      updateSaveButtonState();
      document.getElementById('timer-loop-status').innerText = `🔥 集中タイム (${currentSet} / ${totalSets}セット)`;
      updateTimerDisplay();
      renderLapList();
      showToast('ポモドーロの設定を適用しました');
    }

    function handleTimerSubjectChange(newSubId) {}


    // iPhone/iPad Safari/PWA対策:
    // 無音のaudioをタイマー中ずっと再生する方式は使わない。
    // 開始ボタンのユーザー操作中にAudioContextだけをresumeし、
    // アラーム時にだけMP3を再生する。
    let audioUnlocked = false;
    let alarmAudioContext = null;

    function unlockAudio() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (AudioContextClass) {
          if (!alarmAudioContext) alarmAudioContext = new AudioContextClass();

          const p = alarmAudioContext.resume();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              audioUnlocked = true;
              console.log("[AUDIO] AudioContext unlocked:", alarmAudioContext.state);
            }).catch(err => console.warn("[AUDIO] AudioContext resume failed:", err));
          } else {
            audioUnlocked = true;
          }
        }

        const audio = document.getElementById('alarm-sound');
        if (audio) {
          audio.preload = 'auto';
          audio.muted = false;
          audio.volume = 1;
          try { audio.load(); } catch (_) {}
        }
      } catch (err) {
        console.warn("[AUDIO] unlock exception:", err);
      }
    }

    function playAlarmSound() {
      const audio = document.getElementById('alarm-sound');
      if (!audio) {
        console.warn("[AUDIO] #alarm-sound が見つかりません");
        return;
      }

      if (alarmTimeout) {
        clearTimeout(alarmTimeout);
        alarmTimeout = null;
      }

      audio.muted = false;
      audio.volume = 1;
      audio.loop = false;
      try { audio.currentTime = 0; } catch (_) {}

      if (alarmAudioContext && alarmAudioContext.state === 'suspended') {
        alarmAudioContext.resume().catch(err =>
          console.warn("[AUDIO] resume at alarm failed:", err)
        );
      }

      console.log("[AUDIO] alarm play", {
        unlocked: audioUnlocked,
        audioContextState: alarmAudioContext ? alarmAudioContext.state : 'none',
        readyState: audio.readyState
      });

      const p = audio.play();

      if (p && typeof p.then === 'function') {
        p.then(() => {
          audioUnlocked = true;
          console.log("[AUDIO] alarm started");
        }).catch(e => {
          console.warn("[AUDIO] alarm play blocked:", e);
          try {
            audio.load();
            audio.currentTime = 0;
            audio.play().catch(err2 =>
              console.warn("[AUDIO] alarm retry failed:", err2)
            );
          } catch (retryErr) {
            console.warn("[AUDIO] alarm retry exception:", retryErr);
          }
        });
      }

      alarmTimeout = setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        audio.muted = false;
        audio.loop = false;
        alarmTimeout = null;
      }, 5000);
    }

    function stopAlarmAudio() {
      const audio = document.getElementById('alarm-sound');
      if (!audio) return;

      if (alarmTimeout) {
        clearTimeout(alarmTimeout);
        alarmTimeout = null;
      }

      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      audio.muted = false;
      audio.loop = false;
    }

    function updateSaveButtonState() {
      const saveBtn = document.getElementById('save-btn');
      const totalRecordedSecs = Object.values(subjectElapsedSeconds).reduce((a, b) => a + b, 0);

      if (hasTimerStartedEver && totalRecordedSecs >= 60) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        saveBtn.disabled = true;
        saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }

    function startTimer(fromUser = true) {
      if (fromUser) unlockAudio();
      if (isTimerRunning) return;
      
      if (timerMode === 'alarm') {
        updateAlarmTimerTarget();
        if (timerSeconds <= 0) {
          showToast('未来の時間を指定してください');
          return;
        }
      }

      isTimerRunning = true;
      hasTimerStartedEver = true;
      updateSaveButtonState();

      document.getElementById('start-btn').classList.add('hidden');
      document.getElementById('pause-btn').classList.remove('hidden');
      document.getElementById('floating-timer').classList.remove('hidden');
      document.getElementById('lap-panel').classList.remove('hidden');

      timerInterval = setInterval(() => {
        const currentSubId = document.getElementById('timer-subject-select').value;

        if (timerMode === 'stopwatch') {
          timerSeconds++;
          if (currentSubId !== 'break') {
            subjectElapsedSeconds[currentSubId] = (subjectElapsedSeconds[currentSubId] || 0) + 1;
          }
        } else if (timerMode === 'timer' || timerMode === 'alarm') {
          if (timerMode === 'alarm' && alarmTargetTimestamp) {
            const left = Math.max(0, Math.floor((alarmTargetTimestamp - Date.now()) / 1000));
            timerSeconds = left;
          } else {
            if (timerSeconds > 0) timerSeconds--;
          }
          
          if (currentSubId !== 'break') {
            subjectElapsedSeconds[currentSubId] = (subjectElapsedSeconds[currentSubId] || 0) + 1;
          }

          if (timerSeconds <= 0) {
            playAlarmSound();
            pauseTimer();
            showToast('アラーム時刻になりました！自動で記録を保存します');
            saveTimerSessionAuto();
            return;
          }
        } else {
          if (timerSeconds > 0) {
            timerSeconds--;
            if (loopState === 'work' && currentSubId !== 'break') {
              subjectElapsedSeconds[currentSubId] = (subjectElapsedSeconds[currentSubId] || 0) + 1;
            }
          }
          if (timerSeconds === 0) {
            playAlarmSound();
            if (loopState === 'work') {
              saveTimerSessionAuto(false);
              if (pomoBreakMin > 0) {
                loopState = 'break';
                timerSeconds = pomoBreakMin * 60;
                document.getElementById('timer-loop-status').innerText = `☕ 休憩タイム (${currentSet} / ${totalSets}セット)`;
                showToast('集中タイム終了！休憩に入ります。');
                updateTimerDisplay();
                return;
              }
            }
            if (currentSet < totalSets) {
              currentSet++;
              loopState = 'work';
              timerSeconds = pomoWorkMin * 60;
              document.getElementById('timer-loop-status').innerText = `🔥 集中タイム (${currentSet} / ${totalSets}セット)`;
              showToast(`セット ${currentSet} を開始します！`);
              updateTimerDisplay();
            } else {
              pauseTimer();
              showToast('すべてのセットが完了しました！お疲れ様でした！');
            }
            return;
          }
        }
        updateTimerDisplay();
        renderLapList();
        updateSaveButtonState();
      }, 1000);
    }

    function pauseTimer() {
      if (!isTimerRunning) return;
      stopAlarmAudio();
      isTimerRunning = false;
      clearInterval(timerInterval);

      document.getElementById('start-btn').classList.remove('hidden');
      document.getElementById('pause-btn').classList.add('hidden');
      document.getElementById('floating-timer').classList.add('hidden');
      updateSaveButtonState();
    }

    function resetTimer() {
      pauseTimer();
      currentSet = 1;
      loopState = 'work';
      subjectElapsedSeconds = {};
      hasTimerStartedEver = false;
      updateSaveButtonState();

      if (timerMode === 'stopwatch') {
        timerSeconds = 0;
      } else if (timerMode === 'timer') {
        const mins = parseInt(document.getElementById('normal-minutes-input').value) || 30;
        targetTimerSeconds = mins * 60;
        timerSeconds = targetTimerSeconds;
      } else if (timerMode === 'alarm') {
        updateAlarmTimerTarget();
      } else if (timerMode === 'pomodoro') {
        timerSeconds = pomoWorkMin * 60;
        document.getElementById('timer-loop-status').innerText = `🔥 集中タイム (${currentSet} / ${totalSets}セット)`;
      }
      updateTimerDisplay();
      renderLapList();
      document.getElementById('floating-timer').classList.add('hidden');
      document.getElementById('lap-panel').classList.add('hidden');
    }

    function updateTimerDisplay() {
      let displaySecs = timerSeconds;
      if (timerMode === 'alarm' && isTimerRunning && alarmTargetTimestamp) {
        displaySecs = Math.max(0, Math.floor((alarmTargetTimestamp - Date.now()) / 1000));
      }

      const h = Math.floor(displaySecs / 3600);
      const m = Math.floor((displaySecs % 3600) / 60);
      const s = displaySecs % 60;

      const pad = (num) => String(num).padStart(2, '0');
      const timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;

      document.getElementById('timer-display').innerText = timeStr;
      document.getElementById('floating-display').innerText = timeStr;

      const subSelect = document.getElementById('timer-subject-select');
      const subName = subSelect.options[subSelect.selectedIndex]?.text || '計測中';
      document.getElementById('floating-label').innerText = timerMode === 'pomodoro' ? `${loopState === 'work' ? '集中' : '休憩'} (${subName})` : subName;
    }

    function renderLapList() {
      const lapListContainer = document.getElementById('lap-list');
      lapListContainer.innerHTML = '';

      const subIds = Object.keys(subjectElapsedSeconds);
      if (subIds.length === 0) {
        lapListContainer.innerHTML = '<div class="text-center text-xs text-slate-400 py-2">まだ計測データはありません</div>';
        return;
      }

      subIds.forEach((subId, index) => {
        if (subId === 'break') return;
        const secs = subjectElapsedSeconds[subId];
        const sub = window.subjects.find(s => s.id === subId) || { name: '未分類', color: '#6366f1' };
        
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;

        const row = document.createElement('div');
        row.className = "flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-white border border-slate-100";
        row.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-slate-400 font-mono">#${index + 1}</span>
            <span class="inline-flex items-center gap-1 font-medium text-slate-800">
              <span class="w-2 h-2 rounded-full" style="background-color: ${sub.color}"></span>
              ${sub.name}
            </span>
          </div>
          <span class="font-mono font-bold text-indigo-600">${timeStr}</span>
        `;
        lapListContainer.appendChild(row);
      });
    }

    function saveTimerSessionAuto(shouldReset = true) {
      let totalRecordedMins = 0;
      const subIds = Object.keys(subjectElapsedSeconds);

      if (subIds.length === 0) {
        const currentSubId = document.getElementById('timer-subject-select').value;
        if (currentSubId === 'break') {
          if (shouldReset) {
            resetTimer();
            clearActiveTask();
          }
          return;
        }
        let fallbackMins = 0;
        if (timerMode === 'stopwatch') {
          fallbackMins = Math.round(timerSeconds / 60);
        } else if (timerMode === 'timer') {
          fallbackMins = Math.round(targetTimerSeconds / 60);
        } else if (timerMode === 'alarm') {
          fallbackMins = 30;
        } else {
          fallbackMins = pomoWorkMin;
        }
        if (fallbackMins > 0) {
          subjectElapsedSeconds[currentSubId] = fallbackMins * 60;
        }
      }

      Object.keys(subjectElapsedSeconds).forEach(subId => {
        if (subId === 'break') return;
        const secs = subjectElapsedSeconds[subId];
        const mins = Math.round(secs / 60);
        if (mins > 0) {
          totalRecordedMins += mins;

          let logNote = timerMode === 'pomodoro' ? 'ポモドーロ学習' : (timerMode === 'timer' ? '通常タイマー' : (timerMode === 'alarm' ? '時刻アラーム' : 'ストップウォッチ'));
          if (activeTodoTask) {
            logNote = `[Task] ${activeTodoTask.title}`;
          }

          window.logs.push({
            id: 'log_' + Date.now() + '_' + subId,
            subjectId: subId,
            date: getTodayString(),
            minutes: mins,
            note: logNote
          });
        }
      });

      if (totalRecordedMins > 0) {
        if (activeTodoTask) {
          const targetTodo = window.todos.find(t => t.id === activeTodoTask.id);
          if (targetTodo && !targetTodo.completed) {
            targetTodo.completed = true;
            saveTodos();
          }
        }
        saveLogs();
        updateDashboardData();
        showToast(`自動保存: ${totalRecordedMins}分を記録しました！`);
      }

      subjectElapsedSeconds = {};
      if (shouldReset) {
        resetTimer();
        clearActiveTask();
      }
    }

    function saveTimerSession() {
      saveTimerSessionAuto(true);
    }

    function clearActiveTask() {
      activeTodoTask = null;
      document.getElementById('active-task-banner').classList.add('hidden');
    }

    function startProblemTimer() {
      const nameInput = document.getElementById('problem-name-input').value.trim();
      if (!nameInput) {
        showToast('問題名を入力してください');
        return;
      }
      if (isProbRunning) return;
      isProbRunning = true;

      document.getElementById('prob-start-btn').classList.add('hidden');
      document.getElementById('prob-pause-btn').classList.remove('hidden');

      probInterval = setInterval(() => {
        probSeconds++;
        updateProblemDisplay();
      }, 1000);
    }

    function pauseProblemTimer() {
      if (!isProbRunning) return;
      isProbRunning = false;
      clearInterval(probInterval);

      document.getElementById('prob-start-btn').classList.remove('hidden');
      document.getElementById('prob-pause-btn').classList.add('hidden');
    }

    function resetProblemTimer() {
      pauseProblemTimer();
      probSeconds = 0;
      updateProblemDisplay();
    }

    function updateProblemDisplay() {
      const h = Math.floor(probSeconds / 3600);
      const m = Math.floor((probSeconds % 3600) / 60);
      const s = probSeconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      document.getElementById('problem-display').innerText = `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function checkProblemComparison() {
      const name = document.getElementById('problem-name-input').value.trim();
      const banner = document.getElementById('problem-compare-banner');
      const text = document.getElementById('problem-compare-text');

      if (!name) {
        banner.classList.add('hidden');
        return;
      }

      const matches = problemLogs.filter(p => p.name === name);
      if (matches.length === 0) {
        banner.classList.add('hidden');
        return;
      }

      const lastRecord = matches[matches.length - 1];
      const diff = probSeconds - lastRecord.seconds;
      const absDiff = Math.abs(diff);

      const h = Math.floor(absDiff / 3600);
      const m = Math.floor((absDiff % 3600) / 60);
      const s = absDiff % 60;
      let diffStr = '';
      if (h > 0) diffStr += `${h}時間`;
      if (m > 0 || h > 0) diffStr += `${m}分`;
      diffStr += `${s}秒`;

      banner.classList.remove('hidden');
      if (diff === 0) {
        text.innerText = `前回 (${lastRecord.date}) と全く同じタイムです！`;
      } else if (diff < 0) {
        text.innerText = `前回 (${lastRecord.date}) より ${diffStr} 速いです！素晴らしい！`;
      } else {
        text.innerText = `前回 (${lastRecord.date}) より ${diffStr} 遅いです。次頑張ろう！`;
      }
    }

    function saveProblemRecord() {
      const name = document.getElementById('problem-name-input').value.trim();
      const subjectId = document.getElementById('prob-subject-select').value;
      if (!name) {
        showToast('問題名を入力してください');
        return;
      }
      if (probSeconds <= 0) {
        showToast('計測時間が0秒です');
        return;
      }

      const newRecord = {
        id: 'prob_' + Date.now(),
        subjectId: subjectId,
        name: name,
        seconds: probSeconds,
        date: getTodayString()
      };

      problemLogs.push(newRecord);
      localStorage.setItem('st_problem_logs', JSON.stringify(problemLogs));
      if (typeof notifyDataChanged === 'function') notifyDataChanged();

      showToast(`「${name}」のタイムを保存しました！`);
      resetProblemTimer();
      renderProblemHistory();
      document.getElementById('problem-compare-banner').classList.add('hidden');
    }

    function renderProblemHistory() {
      const tbody = document.getElementById('problem-history-tbody');
      const emptyState = document.getElementById('problem-history-empty');
      const filterSub = document.getElementById('prob-filter-subject').value;
      const searchQuery = document.getElementById('prob-search-input').value.trim().toLowerCase();

      const filterSelect = document.getElementById('prob-filter-subject');
      const currentFilterVal = filterSelect.value;
      filterSelect.innerHTML = '<option value="all">すべての科目</option>' + subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      filterSelect.value = currentFilterVal;

      tbody.innerHTML = '';

      let filtered = [...problemLogs];
      if (filterSub !== 'all') {
        filtered = filtered.filter(p => p.subjectId === filterSub);
      }
      if (searchQuery) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery));
      }

      if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      } else {
        emptyState.classList.add('hidden');
      }

      filtered.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id)).forEach(item => {
        const sub = subjects.find(s => s.id === item.subjectId) || { name: '未分類', color: '#94a3b8' };
        const h = Math.floor(item.seconds / 3600);
        const m = Math.floor((item.seconds % 3600) / 60);
        const s = item.seconds % 60;
        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/80 transition";
        tr.innerHTML = `
          <td class="py-3 px-4 font-mono text-xs text-slate-500">${item.date}</td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium" style="background-color: ${sub.color}15; color: ${sub.color}">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${sub.color}"></span>
              ${sub.name}
            </span>
          </td>
          <td class="py-3 px-4 font-semibold text-slate-800">${item.name}</td>
          <td class="py-3 px-4 font-mono font-bold text-indigo-600">${timeStr}</td>
          <td class="py-3 px-4 text-right">
            <button onclick="deleteProblemRecord('${item.id}')" class="text-slate-400 hover:text-rose-500 p-1 hover:bg-rose-50 rounded transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      lucide.createIcons();
    }

    function deleteProblemRecord(id) {
      problemLogs = problemLogs.filter(p => p.id !== id);
      localStorage.setItem('st_problem_logs', JSON.stringify(problemLogs));
      if (typeof notifyDataChanged === 'function') notifyDataChanged();
      renderProblemHistory();
      showToast('演習記録を削除しました');
    }

    function handleManualSubmit(e) {
      e.preventDefault();
      const subjectId = document.getElementById('manual-subject').value;
      const date = document.getElementById('manual-date').value;
      const hours = parseInt(document.getElementById('manual-hours').value) || 0;
      const minutes = parseInt(document.getElementById('manual-minutes').value) || 0;
      const note = document.getElementById('manual-note').value;

      const totalMinutes = (hours * 60) + minutes;

      if (totalMinutes <= 0) {
        showToast('学習時間を1分以上入力してください');
        return;
      }

      const newLog = {
        id: 'log_' + Date.now(),
        subjectId: subjectId,
        date: date,
        minutes: totalMinutes,
        note: note || '手動入力'
      };

      logs.push(newLog);
      saveLogs();

      document.getElementById('manual-note').value = '';
      showToast('学習記録を保存しました');
      updateDashboardData();
    }
