// ==== Firebase同期機能 ====
// 端末間でのリアルタイム同期(匿名認証 + ルームID方式)
// type="module"として読み込むこと

    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

    const netlifyFirebaseConfig = {
      apiKey: "AIzaSyAY6j40lEWfskNXqCpDWKMiOuVsF1rAAH4",
      authDomain: "study-tracker-pro-dashboard.firebaseapp.com",
      projectId: "study-tracker-pro-dashboard",
      storageBucket: "study-tracker-pro-dashboard.firebasestorage.app",
      messagingSenderId: "12330692555",
      appId: "1:12330692555:web:1baf87adf42ca3381d904e",
      measurementId: "G-CQWW6MB1KK"
    };

    let db = null;
    let auth = null;
    let autoSyncTimer = null;
    let isSyncing = false;
    let unsubscribeSnapshot = null;
    let syncReady = false;
    let pendingLocalChange = false;
    let currentSyncRoomId = '';

    // 同期状態
    // st_sync_dirty = 1 : オフラインを含め、端末側にまだサーバーへ保存していない変更がある
    // st_sync_server_version : 最後に端末へ正常に読み込んだサーバーのupdatedAt
    function isLocalDirty() {
      return localStorage.getItem('st_sync_dirty') === '1';
    }

    function markLocalDirty() {
      localStorage.setItem('st_sync_dirty', '1');
    }

    function markLocalClean(serverUpdatedAt) {
      localStorage.setItem('st_sync_dirty', '0');
      localStorage.setItem('st_sync_server_version', String(serverUpdatedAt || 0));
    }

    async function initFirebase() {
      if (db) return db;
      try {
        const app = initializeApp(netlifyFirebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        await signInAnonymously(auth);
        return db;
      } catch (e) {
        console.error("[SYNC] Firebase init error:", e);
        return null;
      }
    }

    window.updateSyncRoom = function(roomId) {
      roomId = roomId.trim();
      syncReady = false;
      pendingLocalChange = false;
      currentSyncRoomId = roomId;

      if (autoSyncTimer) {
        clearTimeout(autoSyncTimer);
        autoSyncTimer = null;
      }

      localStorage.setItem('st_sync_room', roomId);

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (roomId) {
        setupRealtimeSync(roomId);
      } else {
        updateSyncStatus('ローカル保存稼働中', 'text-emerald-600');
      }
    };

    async function setupRealtimeSync(roomId) {
      const database = await initFirebase();
      if (!database) {
        updateSyncStatus('❌ クラウド接続エラー（ローカル保存中）', 'text-rose-500');
        return;
      }

      syncReady = false;
      pendingLocalChange = false;
      currentSyncRoomId = roomId;

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      updateSyncStatus('☁️ サーバー状態を確認中...', 'text-indigo-500');
      console.log("[SYNC] 接続。dirty =", isLocalDirty());

      const docRef = doc(database, 'rooms', roomId);
      let docSnap;

      try {
        docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          const remoteUpdatedAt = Number(remoteData.updatedAt || 0);
          const lastServerVersion = Number(
            localStorage.getItem('st_sync_server_version') || '0'
          );
          const dirty = isLocalDirty();

          console.log("[SYNC] サーバー確認", {
            remoteUpdatedAt,
            lastServerVersion,
            dirty
          });

          if (!dirty) {
            // 通常の接続：ローカルに未送信変更がないので、サーバーを読み込む
            applyRemoteData(remoteData, remoteUpdatedAt);
            console.log("[SYNC] 未送信変更なし → サーバーを読み込み");
          } else if (remoteUpdatedAt === lastServerVersion) {
            // ★重要:
            // オフライン中に端末で変更した場合。
            // 最後に同期した時点からサーバーが変わっていなければ、
            // ローカル変更をサーバーへ保存してよい。
            console.log("[SYNC] オフライン変更あり。サーバーに競合なし → ローカルをpush");
            syncReady = true;
            await pushLocalDataToRemote(docRef);
          } else if (remoteUpdatedAt > lastServerVersion) {
            // 他端末で先に変更されている。古いローカルで上書きしない。
            console.warn("[SYNC] 競合検出。サーバーが先に変更されています。ローカル変更は上書きせず停止");
            localStorage.setItem(
              'st_sync_conflict_backup',
              JSON.stringify({
                savedAt: Date.now(),
                subjects: window.subjects,
                logs: window.logs,
                todos: window.todos,
                problemLogs: window.problemLogs,
                dailyGoal: window.dailyGoal,
                timeSchedules: window.timeSchedules,
                customScheduleTasks: window.customScheduleTasks,
                schedulePresets: window.schedulePresets
              })
            );
            updateSyncStatus('⚠️ サーバー変更と競合（ローカル変更を保護）', 'text-amber-600');
          } else {
            // サーバーのupdatedAtが最後の既知値より古い/不正な場合。
            // 安全側に倒して自動上書きしない。
            console.warn("[SYNC] サーバー版数が不整合。自動同期を停止");
            updateSyncStatus('⚠️ 同期状態を確認してください', 'text-amber-600');
          }
        } else {
          const dirty = isLocalDirty();

          if (dirty) {
            // サーバーにないルームで、オフライン中に実際に変更された場合のみ作成を許可
            console.log("[SYNC] ルームなし + ローカル未送信変更あり → ルーム作成");
            syncReady = true;
            await pushLocalDataToRemote(docRef);
          } else {
            // 初回接続だけで空ルームを勝手に作らない
            console.log("[SYNC] ルームなし + 変更なし → 書き込みしない");
            updateSyncStatus('☁️ ルーム待機中（書き込みなし）', 'text-amber-600');
          }
        }

        syncReady = true;
      } catch (e) {
        console.error("[SYNC] Initial sync error:", e);
        syncReady = false;
        updateSyncStatus('⚠️ 接続失敗（ローカル保存中）', 'text-rose-500');
        return;
      }

      // リアルタイム監視
      unsubscribeSnapshot = onSnapshot(docRef, (snap) => {
        if (!snap.exists() || isSyncing) return;

        const remoteData = snap.data();
        const remoteUpdatedAt = Number(remoteData.updatedAt || 0);
        const dirty = isLocalDirty();

        console.log("[SYNC] サーバー変更", {
          remoteUpdatedAt,
          dirty,
          lastServerVersion: localStorage.getItem('st_sync_server_version')
        });

        if (!dirty) {
          const localServerVersion = Number(
            localStorage.getItem('st_sync_server_version') || '0'
          );

          if (remoteUpdatedAt > localServerVersion) {
            isSyncing = true;
            try {
              console.log("[SYNC] サーバー側に変更あり → 読み込み");
              applyRemoteData(remoteData, remoteUpdatedAt);
            } finally {
              isSyncing = false;
            }
          }
        } else {
          // 未送信のローカル変更がある間は、サーバーから自動上書きしない
          console.log("[SYNC] 未送信ローカル変更あり → サーバー変更による自動上書きを停止");
        }
      }, (error) => {
        console.error("[SYNC] Snapshot error:", error);
        updateSyncStatus('⚠️ 同期エラー（ローカル保存中）', 'text-amber-500');
      });

      if (isLocalDirty()) {
        updateSyncStatus('☁️ 未送信変更を保存中...', 'text-indigo-500');
      } else {
        updateSyncStatus('✅ 自動同期中 (リアルタイム)', 'text-emerald-600');
      }
    }

    function applyRemoteData(remoteData, remoteUpdatedAt) {
      const timerSubSelect = document.getElementById('timer-subject-select');
      const currentSelectedSubject = timerSubSelect ? timerSubSelect.value : null;

      if (remoteData.subjects) window.subjects = remoteData.subjects;
      if (remoteData.logs) window.logs = remoteData.logs;
      if (remoteData.todos) window.todos = remoteData.todos;
      if (remoteData.problemLogs) window.problemLogs = remoteData.problemLogs;
      if (remoteData.dailyGoal !== undefined) window.dailyGoal = remoteData.dailyGoal;
      if (remoteData.timeSchedules) window.timeSchedules = remoteData.timeSchedules;
      if (remoteData.customScheduleTasks) window.customScheduleTasks = remoteData.customScheduleTasks;
      if (remoteData.schedulePresets) window.schedulePresets = remoteData.schedulePresets;

      localStorage.setItem('st_subjects', JSON.stringify(window.subjects));
      localStorage.setItem('st_logs', JSON.stringify(window.logs));
      localStorage.setItem('st_todos', JSON.stringify(window.todos));
      localStorage.setItem('st_problem_logs', JSON.stringify(window.problemLogs));
      localStorage.setItem('st_goal', window.dailyGoal);
      localStorage.setItem('st_time_schedules', JSON.stringify(window.timeSchedules));
      localStorage.setItem('st_custom_sched_tasks', JSON.stringify(window.customScheduleTasks));
      localStorage.setItem('st_sched_presets', JSON.stringify(window.schedulePresets));
      localStorage.setItem('st_updated_at', String(remoteUpdatedAt));

      // サーバーから正常に読み込んだので、この時点で未送信変更はない
      markLocalClean(remoteUpdatedAt);

      if (typeof renderSubjectOptions === 'function') renderSubjectOptions();
      if (typeof renderSubjectList === 'function') renderSubjectList();
      if (typeof updateDashboardData === 'function') updateDashboardData();
      if (typeof refreshActiveTodoView === 'function') refreshActiveTodoView();
      if (typeof renderProblemHistory === 'function') renderProblemHistory();
      if (typeof renderHistoryTable === 'function') renderHistoryTable();
      if (typeof renderCustomScheduleTasksList === 'function') renderCustomScheduleTasksList();
      if (typeof renderSchedulePresetsList === 'function') renderSchedulePresetsList();

      if (currentSelectedSubject && timerSubSelect) {
        timerSubSelect.value = currentSelectedSubject;
      }
    }

    async function pushLocalDataToRemote(docRef) {
      if (!syncReady || isSyncing) {
        console.log("[SYNC] push拒否: 同期準備未完了または同期中");
        return false;
      }

      const database = await initFirebase();
      if (!database) {
        console.log("[SYNC] Firebase未接続。ローカル変更は保持します");
        return false;
      }

      isSyncing = true;

      try {
        const latestSnap = await getDoc(docRef);
        const knownServerVersion = Number(
          localStorage.getItem('st_sync_server_version') || '0'
        );

        if (latestSnap.exists()) {
          const latestRemote = latestSnap.data();
          const remoteUpdatedAt = Number(latestRemote.updatedAt || 0);

          // 最後に同期した時点よりサーバーが進んでいたら上書きしない
          if (remoteUpdatedAt !== knownServerVersion) {
            console.warn("[SYNC] push中止: サーバー側が先に変更されています", {
              remoteUpdatedAt,
              knownServerVersion
            });

            localStorage.setItem(
              'st_sync_conflict_backup',
              JSON.stringify({
                savedAt: Date.now(),
                subjects: window.subjects,
                logs: window.logs,
                todos: window.todos,
                problemLogs: window.problemLogs,
                dailyGoal: window.dailyGoal,
                timeSchedules: window.timeSchedules,
                customScheduleTasks: window.customScheduleTasks,
                schedulePresets: window.schedulePresets
              })
            );

            updateSyncStatus('⚠️ サーバー変更と競合（ローカル変更を保護）', 'text-amber-600');
            return false;
          }
        } else if (knownServerVersion !== 0) {
          // 既知のサーバーが突然消えた場合も上書きしない
          console.warn("[SYNC] push中止: 以前存在したサーバールームが見つかりません");
          updateSyncStatus('⚠️ サーバーデータ消失を検出（書き込み停止）', 'text-rose-600');
          return false;
        }

        const now = Date.now();

        await setDoc(docRef, {
          subjects: window.subjects,
          logs: window.logs,
          todos: window.todos,
          problemLogs: window.problemLogs,
          dailyGoal: window.dailyGoal,
          timeSchedules: window.timeSchedules,
          customScheduleTasks: window.customScheduleTasks,
          schedulePresets: window.schedulePresets,
          updatedAt: now
        });

        localStorage.setItem('st_updated_at', String(now));
        markLocalClean(now);

        console.log("[SYNC] push完了:", now);
        updateSyncStatus('☁️ 保存完了', 'text-emerald-600');
        return true;
      } catch (e) {
        // オフラインなどで失敗してもdirtyは絶対に消さない
        console.error("[SYNC] Push failed。ローカル変更を保持:", e);
        markLocalDirty();
        updateSyncStatus('📴 オフライン変更を保持中', 'text-amber-600');
        return false;
      } finally {
        isSyncing = false;
      }
    }

    function schedulePushToRemote(roomId) {
      if (autoSyncTimer) clearTimeout(autoSyncTimer);

      autoSyncTimer = setTimeout(async () => {
        if (!syncReady || currentSyncRoomId !== roomId || !isLocalDirty()) {
          console.log("[SYNC] pushキャンセル");
          return;
        }

        const database = await initFirebase();
        if (!database) return;

        await pushLocalDataToRemote(doc(database, 'rooms', roomId));
      }, 500);
    }

    window.notifyDataChanged = function() {
      // ★変更した瞬間に「未送信」と永続化する。
      // オフラインになっても、再接続後にこのフラグを見てpushできる。
      markLocalDirty();

      const now = Date.now();
      localStorage.setItem('st_updated_at', String(now));

      const roomId = localStorage.getItem('st_sync_room');
      if (!roomId) return;

      if (!syncReady) {
        pendingLocalChange = true;
        console.log("[SYNC] 変更をローカルに保持。同期準備/オンライン復帰までpushしません");
        return;
      }

      schedulePushToRemote(roomId);
    };

    function updateSyncStatus(text, colorClass) {
      const statusText = document.getElementById('sync-status-text');
      const indicator = document.getElementById('sync-status-indicator');
      if (statusText) statusText.innerText = text;
      if (indicator) {
        indicator.className = `text-xs font-semibold flex items-center gap-1.5 ${colorClass}`;
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      const savedRoom = localStorage.getItem('st_sync_room') || '';
      const roomInput = document.getElementById('sync-room-input');

      if (roomInput && savedRoom) {
        roomInput.value = savedRoom;
        setupRealtimeSync(savedRoom);
      }
    });

    // オンライン復帰時：未送信変更があれば保存を試みる。
    window.addEventListener('online', () => {
      const savedRoom = localStorage.getItem('st_sync_room') || '';
      if (savedRoom) {
        console.log("[SYNC] オンライン復帰");
        setupRealtimeSync(savedRoom);
      }
    });

    // 画面復帰時も同じ安全な同期処理を行う
    window.addEventListener('focus', () => {
      const savedRoom = localStorage.getItem('st_sync_room') || '';
      if (savedRoom) setupRealtimeSync(savedRoom);
    });
