// ==== Firebase同期機能 ====
// 端末間でのリアルタイム同期(匿名認証 + ルームID方式)
// パスワードによるクライアントサイド暗号化機能付き

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, initializeFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAnalytics, isSupported as isAnalyticsSupported } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

// Firestore内部ストリーム切断時のアサーションエラー(ID: ca9, b815等)を安全にキャッチして無視
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && typeof event.reason.message === 'string' && event.reason.message.includes('FIRESTORE') && event.reason.message.includes('INTERNAL ASSERTION FAILED')) {
      event.preventDefault();
      console.warn('[SYNC] Caught internal Firestore SDK assertion error, safely ignored:', event.reason.message);
    }
  });
}

// デフォルトのFirebaseプロジェクト設定 (GitHub Pagesなどの静的環境でも即時動作)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAY6j40lEWfskNXqCpDWKMiOuVsF1rAAH4",
  authDomain: "study-tracker-pro-dashboard.firebaseapp.com",
  projectId: "study-tracker-pro-dashboard",
  storageBucket: "study-tracker-pro-dashboard.firebasestorage.app",
  messagingSenderId: "12330692555",
  appId: "1:12330692555:web:1baf87adf42ca3381d904e",
  measurementId: "G-CQWW6MB1KK"
};

let netlifyFirebaseConfig = DEFAULT_FIREBASE_CONFIG;
let analytics = null;

let db = null;
let auth = null;
let autoSyncTimer = null;
let isSyncing = false;
let unsubscribeSnapshot = null;
let syncReady = false;
let pendingLocalChange = false;
let currentSyncRoomId = '';
let currentSyncPassword = '';

// --- 暗号化ユーティリティ ---
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(dataObj, password) {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encoded = enc.encode(JSON.stringify(dataObj));
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoded
  );
  
  return {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertext)
  };
}

async function decryptData(encryptedObj, password) {
  try {
    const salt = base64ToBuffer(encryptedObj.salt);
    const iv = base64ToBuffer(encryptedObj.iv);
    const ciphertext = base64ToBuffer(encryptedObj.ciphertext);
    const key = await deriveKey(password, salt);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    console.error("Decryption failed", e);
    return null;
  }
}
// -----------------------------

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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }
  try {
    if (!netlifyFirebaseConfig || !netlifyFirebaseConfig.apiKey) {
      // localStorage または既定値を使用
      const customConfigStr = localStorage.getItem('st_custom_firebase_config');
      if (customConfigStr) {
        try {
          const parsed = JSON.parse(customConfigStr);
          if (parsed && parsed.apiKey) {
            netlifyFirebaseConfig = parsed;
          }
        } catch (_) {}
      }
      if (!netlifyFirebaseConfig || !netlifyFirebaseConfig.apiKey) {
        netlifyFirebaseConfig = DEFAULT_FIREBASE_CONFIG;
      }
    }

    const app = initializeApp(netlifyFirebaseConfig);
    auth = getAuth(app);
    try {
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true
      });
    } catch (_) {
      db = getFirestore(app);
    }

    // Analytics の安全な初期化
    try {
      if (typeof isAnalyticsSupported === 'function') {
        isAnalyticsSupported().then(supported => {
          if (supported && !analytics) {
            analytics = getAnalytics(app);
          }
        }).catch(() => {});
      }
    } catch (_) {}

    await signInAnonymously(auth);
    updateGlobalConnectionStatus('online');
    return db;
  } catch (e) {
    console.warn("[SYNC] Firebase unavailable, running local-only mode:", e.message || e);
    updateGlobalConnectionStatus('offline');
    return null;
  }
}

// === Firebase 接続ステータス管理 (サイドバー & モバイルドロワー同期表示) ===
function updateGlobalConnectionStatus(status) {
  const desktopBadge = document.getElementById('desktop-firebase-status');
  const drawerBadge = document.getElementById('drawer-firebase-status');

  let text = '';
  let pillClass = '';
  let dotClass = '';

  if (status === 'online') {
    text = 'オンライン (Firebase)';
    pillClass = 'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30';
    dotClass = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse';
  } else if (status === 'checking') {
    text = '接続確認中...';
    pillClass = 'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950/80 text-sky-400 border border-sky-500/30';
    dotClass = 'w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse';
  } else {
    // offline
    text = 'オフライン (ローカル)';
    pillClass = 'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/60';
    dotClass = 'w-1.5 h-1.5 rounded-full bg-slate-400';
  }

  const renderBadge = (el) => {
    if (!el) return;
    el.className = pillClass;
    el.innerHTML = `<span class="${dotClass}"></span><span>${text}</span>`;
  };

  renderBadge(desktopBadge);
  renderBadge(drawerBadge);
}
window.updateGlobalConnectionStatus = updateGlobalConnectionStatus;

async function checkFirebaseConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateGlobalConnectionStatus('offline');
    return false;
  }
  updateGlobalConnectionStatus('checking');
  try {
    const database = await initFirebase();
    if (database) {
      updateGlobalConnectionStatus('online');
      return true;
    } else {
      updateGlobalConnectionStatus('offline');
      return false;
    }
  } catch (_) {
    updateGlobalConnectionStatus('offline');
    return false;
  }
}
window.checkFirebaseConnection = checkFirebaseConnection;

function updateSyncUIState(isConnected) {
  const roomInput = document.getElementById('sync-room-input');
  const passInput = document.getElementById('sync-password-input');
  const createBtn = document.getElementById('sync-create-btn');
  const joinBtn = document.getElementById('sync-join-btn');
  const disconnectBtn = document.getElementById('sync-disconnect-btn');
  
  if (!roomInput || !passInput) return;
  
  if (isConnected) {
    roomInput.disabled = true;
    passInput.disabled = true;
    roomInput.classList.add('opacity-60', 'bg-slate-200');
    passInput.classList.add('opacity-60', 'bg-slate-200');
    if (createBtn) createBtn.classList.add('hidden');
    if (joinBtn) joinBtn.classList.add('hidden');
    if (disconnectBtn) disconnectBtn.classList.remove('hidden');
  } else {
    roomInput.disabled = false;
    passInput.disabled = false;
    roomInput.classList.remove('opacity-60', 'bg-slate-200');
    passInput.classList.remove('opacity-60', 'bg-slate-200');
    roomInput.value = '';
    passInput.value = '';
    if (createBtn) createBtn.classList.remove('hidden');
    if (joinBtn) joinBtn.classList.remove('hidden');
    if (disconnectBtn) disconnectBtn.classList.add('hidden');
  }
}

function updateSyncStatus(text, colorClass) {
  const statusText = document.getElementById('sync-status-text');
  const indicator = document.getElementById('sync-status-indicator');
  if (statusText) statusText.innerText = text;
  if (indicator) {
    indicator.className = `text-xs font-semibold flex items-center gap-1.5 ${colorClass}`;
  }
}

function applyRemoteData(remoteData) {
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

async function pushLocalDataToRemote(docRef, password) {
  if (!syncReady || isSyncing) return false;
  const database = await initFirebase();
  if (!database) return false;
  
  isSyncing = true;
  try {
    const latestSnap = await getDoc(docRef);
    const knownServerVersion = Number(localStorage.getItem('st_sync_server_version') || '0');
    
    if (latestSnap.exists()) {
      const latestRemote = latestSnap.data();
      const remoteUpdatedAt = Number(latestRemote.updatedAt || 0);
      if (remoteUpdatedAt !== knownServerVersion) {
        console.warn("[SYNC] push中止: サーバー側が先に変更されています");
        updateSyncStatus('⚠️ サーバー変更と競合', 'text-amber-600');
        return false;
      }
    }
    
    const now = Date.now();
    const dataObj = {
      subjects: window.subjects,
      logs: window.logs,
      todos: window.todos,
      problemLogs: window.problemLogs,
      dailyGoal: window.dailyGoal,
      timeSchedules: window.timeSchedules,
      customScheduleTasks: window.customScheduleTasks,
      schedulePresets: window.schedulePresets,
    };
    
    // 暗号化
    const encrypted = await encryptData(dataObj, password);
    
    await setDoc(docRef, {
      ...encrypted,
      updatedAt: now
    });
    
    localStorage.setItem('st_updated_at', String(now));
    markLocalClean(now);
    updateSyncStatus('☁️ 保存完了', 'text-emerald-600');
    updateGlobalConnectionStatus('online');
    return true;
  } catch (e) {
    console.error("[SYNC] Push failed", e);
    markLocalDirty();
    updateSyncStatus('📴 オフライン変更を保持中', 'text-amber-600');
    updateGlobalConnectionStatus('offline');
    return false;
  } finally {
    isSyncing = false;
  }
}

async function setupRealtimeSync(roomId, password) {
  if (!roomId || !password) return;

  // すでに同一のルームで正常に監視中の場合はストリームを再生成せず維持 (ID: ca9 内部状態エラー防止)
  if (unsubscribeSnapshot && currentSyncRoomId === roomId && currentSyncPassword === password && syncReady) {
    return;
  }

  const database = await initFirebase();
  if (!database) {
    updateGlobalConnectionStatus('offline');
    return;
  }
  
  if (unsubscribeSnapshot) {
    try {
      unsubscribeSnapshot();
    } catch (_) {}
    unsubscribeSnapshot = null;
  }
  
  syncReady = false;
  currentSyncRoomId = roomId;
  currentSyncPassword = password;
  
  const docRef = doc(database, 'rooms', roomId);
  
  // リアルタイム監視
  try {
    unsubscribeSnapshot = onSnapshot(docRef, {
      next: async (snap) => {
        updateGlobalConnectionStatus('online');
        if (!snap.exists() || isSyncing) return;
        
        const remoteData = snap.data();
        const remoteUpdatedAt = Number(remoteData.updatedAt || 0);
        const dirty = isLocalDirty();
        
        if (!dirty) {
          const localServerVersion = Number(localStorage.getItem('st_sync_server_version') || '0');
          if (remoteUpdatedAt > localServerVersion) {
            isSyncing = true;
            try {
              updateSyncStatus('☁️ データ受信中...', 'text-indigo-500');
              // 復号化
              if (!remoteData.ciphertext) return; // old format or empty
              const decryptedData = await decryptData(remoteData, password);
              if (decryptedData) {
                applyRemoteData(decryptedData);
                localStorage.setItem('st_updated_at', String(remoteUpdatedAt));
                markLocalClean(remoteUpdatedAt);
                updateSyncStatus('✅ 自動同期中 (リアルタイム)', 'text-emerald-600');
              } else {
                updateSyncStatus('⚠️ パスワードエラー', 'text-rose-500');
              }
            } finally {
              isSyncing = false;
            }
          } else {
            updateSyncStatus('✅ 自動同期中 (リアルタイム)', 'text-emerald-600');
          }
        }
      },
      error: (error) => {
        console.warn("[SYNC] Snapshot stream error, self-healing:", error);
        updateSyncStatus('⚠️ 同期一時不通（再接続中...）', 'text-amber-500');
        updateGlobalConnectionStatus('offline');
        
        if (unsubscribeSnapshot) {
          try { unsubscribeSnapshot(); } catch (_) {}
          unsubscribeSnapshot = null;
        }
        syncReady = false;
        
        setTimeout(() => {
          if (currentSyncRoomId && currentSyncPassword) {
            setupRealtimeSync(currentSyncRoomId, currentSyncPassword);
          }
        }, 3000);
      }
    });
  } catch (err) {
    console.warn("[SYNC] Failed to attach onSnapshot listener:", err);
    updateGlobalConnectionStatus('offline');
    return;
  }
  
  syncReady = true;
  if (isLocalDirty()) {
    pushLocalDataToRemote(docRef, password);
  }
}

// === UI Actions ===

window.createSyncRoom = async function() {
  const roomInput = document.getElementById('sync-room-input');
  const passInput = document.getElementById('sync-password-input');
  const roomId = roomInput.value.trim();
  const password = passInput.value.trim();
  
  if (!roomId || !password) {
    if (typeof window.showToast === 'function') window.showToast("ルームIDとパスワードの両方を入力してください。");
    else alert("ルームIDとパスワードの両方を入力してください。");
    return;
  }
  
  updateSyncStatus('☁️ ルーム確認中...', 'text-indigo-500');
  const database = await initFirebase();
  if (!database) {
    updateSyncStatus('ローカル保存稼働中', 'text-emerald-600');
    if (typeof window.showToast === 'function') window.showToast("クラウド同期用のFirebase設定が見つかりません。ローカル保存モードで動作します。");
    return;
  }
  
  const docRef = doc(database, 'rooms', roomId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    if (typeof window.showToast === 'function') window.showToast("エラー: このルームIDは既に使用されています。");
    else alert("このルームIDは既に使用されています。別のIDを指定するか、「参加する」を選んでください。");
    updateSyncStatus('ローカル保存稼働中', 'text-emerald-600');
    return;
  }
  
  // 新規作成
  localStorage.setItem('st_sync_room', roomId);
  localStorage.setItem('st_sync_password', password);
  updateSyncUIState(true);
  
  syncReady = true;
  isSyncing = false;
  markLocalDirty();
  await pushLocalDataToRemote(docRef, password);
  setupRealtimeSync(roomId, password);
  
  if (typeof window.showToast === 'function') window.showToast("同期ルームを新規作成し、接続しました！");
};

window.joinSyncRoom = async function() {
  const roomInput = document.getElementById('sync-room-input');
  const passInput = document.getElementById('sync-password-input');
  const roomId = roomInput.value.trim();
  const password = passInput.value.trim();
  
  if (!roomId || !password) {
    if (typeof window.showToast === 'function') window.showToast("ルームIDとパスワードの両方を入力してください。");
    else alert("ルームIDとパスワードの両方を入力してください。");
    return;
  }
  
  updateSyncStatus('☁️ ルーム確認中...', 'text-indigo-500');
  const database = await initFirebase();
  if (!database) {
    updateSyncStatus('ローカル保存稼働中', 'text-emerald-600');
    if (typeof window.showToast === 'function') window.showToast("クラウド同期用のFirebase設定が見つかりません。ローカル保存モードで動作します。");
    return;
  }
  
  const docRef = doc(database, 'rooms', roomId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    if (typeof window.showToast === 'function') window.showToast("エラー: ルームが見つかりません。");
    else alert("ルームが見つかりません。IDを確認するか、「新規作成」してください。");
    updateSyncStatus('ローカル保存稼働中', 'text-emerald-600');
    return;
  }
  
  const remoteData = docSnap.data();
  if (remoteData.ciphertext) {
    const decryptedData = await decryptData(remoteData, password);
    if (!decryptedData) {
      if (typeof window.showToast === 'function') window.showToast("エラー: パスワードが間違っています。");
      else alert("パスワードが間違っています。");
      updateSyncStatus('ローカル保存稼働中', 'text-emerald-600');
      return;
    }
    // 参加成功
    applyRemoteData(decryptedData);
    const remoteUpdatedAt = Number(remoteData.updatedAt || 0);
    localStorage.setItem('st_updated_at', String(remoteUpdatedAt));
    markLocalClean(remoteUpdatedAt);
    
    localStorage.setItem('st_sync_room', roomId);
    localStorage.setItem('st_sync_password', password);
    updateSyncUIState(true);
    
    setupRealtimeSync(roomId, password);
    if (typeof window.showToast === 'function') window.showToast("ルームに参加し、データを同期しました！");
  } else {
    if (typeof window.showToast === 'function') window.showToast("このルームは暗号化されていない古い形式です。");
    else alert("このルームは暗号化されていない古い形式です。");
  }
};

window.disconnectSyncRoom = function() {
  localStorage.removeItem('st_sync_room');
  localStorage.removeItem('st_sync_password');
  currentSyncRoomId = '';
  currentSyncPassword = '';
  syncReady = false;
  
  updateSyncUIState(false);
  
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
  
  updateSyncStatus('ローカル保存稼働中', 'text-emerald-600');
  if (typeof window.showToast === 'function') window.showToast("同期設定を解除しました。");
};

// --- 通知トリガー ---
window.notifyDataChanged = function() {
  markLocalDirty();
  const now = Date.now();
  localStorage.setItem('st_updated_at', String(now));
  
  if (!syncReady || !currentSyncRoomId || !currentSyncPassword) {
    pendingLocalChange = true;
    return;
  }
  
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(async () => {
    if (!syncReady || !isLocalDirty()) return;
    const database = await initFirebase();
    if (!database) return;
    await pushLocalDataToRemote(doc(database, 'rooms', currentSyncRoomId), currentSyncPassword);
  }, 500);
};

// --- 初期ロード時の自動再開 & 接続確認 ---
window.addEventListener('DOMContentLoaded', () => {
  const savedRoom = localStorage.getItem('st_sync_room') || '';
  const savedPass = localStorage.getItem('st_sync_password') || '';
  const roomInput = document.getElementById('sync-room-input');
  const passInput = document.getElementById('sync-password-input');
  
  if (roomInput && passInput && savedRoom && savedPass) {
    roomInput.value = savedRoom;
    passInput.value = savedPass;
    updateSyncUIState(true);
    setupRealtimeSync(savedRoom, savedPass);
  } else {
    // 同期ルーム未設定時でもFirebaseとの接続状態をサイドバー/ドロワーに表示
    checkFirebaseConnection();
  }
});

// オンライン・オフライン・フォーカス時の再開
window.addEventListener('online', () => {
  checkFirebaseConnection();
  const savedRoom = localStorage.getItem('st_sync_room') || '';
  const savedPass = localStorage.getItem('st_sync_password') || '';
  if (savedRoom && savedPass) setupRealtimeSync(savedRoom, savedPass);
});
window.addEventListener('offline', () => {
  updateGlobalConnectionStatus('offline');
});
window.addEventListener('focus', () => {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    checkFirebaseConnection();
  }
  const savedRoom = localStorage.getItem('st_sync_room') || '';
  const savedPass = localStorage.getItem('st_sync_password') || '';
  if (savedRoom && savedPass) setupRealtimeSync(savedRoom, savedPass);
});
