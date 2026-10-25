// ==== 初期化 ====
// DOMContentLoaded時にUIを初期描画、Service WorkerとPWA/オフライン管理を行う

// --- PWAインストール機能 ---
let deferredInstallPrompt = null;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;
const isIOSDevice = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

function updatePWAInstallUI() {
  const desktopBtn = document.getElementById('pwa-install-btn-desktop');
  const mobileBtn = document.getElementById('pwa-install-btn-mobile');

  // すでにインストール済みの場合はボタンを非表示
  if (isStandalone) {
    if (desktopBtn) desktopBtn.classList.add('hidden');
    if (mobileBtn) mobileBtn.classList.add('hidden');
    return;
  }

  // Chromium / Android / Edge (deferredPromptが取得できた場合)
  if (deferredInstallPrompt) {
    if (desktopBtn) desktopBtn.classList.remove('hidden');
    if (mobileBtn) mobileBtn.classList.remove('hidden');
    return;
  }

  // iOS Safariの場合（ホーム画面追加案内を表示可能）
  if (isIOSDevice) {
    if (desktopBtn) desktopBtn.classList.remove('hidden');
    if (mobileBtn) mobileBtn.classList.remove('hidden');
    return;
  }

  // それ以外でプロンプト未準備の場合は非表示
  if (desktopBtn) desktopBtn.classList.add('hidden');
  if (mobileBtn) mobileBtn.classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updatePWAInstallUI();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updatePWAInstallUI();
  if (typeof window.showToast === 'function') {
    window.showToast('アプリが正常にインストールされました！');
  }
});

window.handlePWAInstallClick = async function() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredInstallPrompt = null;
      updatePWAInstallUI();
    }
  } else if (isIOSDevice) {
    openIOSInstallModal();
  } else {
    if (typeof window.showToast === 'function') {
      window.showToast('ブラウザのメニューから「ホーム画面に追加」または「インストール」を選択してください');
    }
  }
};

window.openIOSInstallModal = function() {
  const modal = document.getElementById('ios-install-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeIOSInstallModal = function() {
  const modal = document.getElementById('ios-install-modal');
  if (modal) modal.classList.add('hidden');
};

// --- オンライン/オフライン接続状態の検知 ---
function updateNetworkStatus(notify = false) {
  const offlineBanner = document.getElementById('offline-indicator');
  if (offlineBanner) offlineBanner.classList.add('hidden');
}

let swRegistration = null;

function checkForSWUpdate() {
  if (swRegistration && typeof swRegistration.update === 'function') {
    swRegistration.update().catch(err => {
      console.warn('[SW] Update check error:', err);
    });
  }
}

window.addEventListener('online', () => {
  updateNetworkStatus(true);
  checkForSWUpdate();
  if (typeof initFirebase === 'function') {
    initFirebase();
  }
});
window.addEventListener('offline', () => updateNetworkStatus(true));

// --- Service Worker 登録 & 更新監視 ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        swRegistration = reg;
        console.log('[SW] Registered successfully, scope:', reg.scope);

        // 新しいWorkerがインストールされた時の監視
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version available.');
                if (typeof window.showToast === 'function') {
                  window.showToast('アプリの新バージョンを検出しました。再読み込みで最新版が適用されます。');
                }
              }
            });
          }
        });
      })
      .catch(err => {
        console.warn('[SW] Registration failed:', err);
      });
  });

  // 画面表示・復帰時 (visibilitychange) に更新を確認
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForSWUpdate();
    }
  });

  // 新しいSWがページをコントロール開始したときの通知
  let isRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing) {
      isRefreshing = true;
      if (typeof window.showToast === 'function') {
        window.showToast('最新版に更新されました！');
      }
    }
  });
}

// --- DOMContentLoaded 初期描画 ---
window.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  // 接続状況の初期判定
  updateNetworkStatus(false);
  updatePWAInstallUI();

  const manualDate = document.getElementById('manual-date');
  if (manualDate) manualDate.value = getTodayString();

  const todoStart = document.getElementById('todo-startdate-input');
  if (todoStart) todoStart.value = getTodayString();

  const todoDue = document.getElementById('todo-duedate-input');
  if (todoDue) todoDue.value = getTodayString();

  const goalInput = document.getElementById('goal-input');
  if (goalInput) goalInput.value = window.dailyGoal;
  
  const now = new Date();
  now.setHours(now.getHours() + 1);
  const hoursStr = String(now.getHours()).padStart(2, '0');
  const minsStr = String(now.getMinutes()).padStart(2, '0');
  const targetTimeInput = document.getElementById('target-time-input');
  if (targetTimeInput) targetTimeInput.value = `${hoursStr}:${minsStr}`;

  if (typeof renderSubjectOptions === 'function') renderSubjectOptions();
  if (typeof renderSubjectList === 'function') renderSubjectList();
  if (typeof updateDashboardData === 'function') updateDashboardData();
  if (typeof renderTodoList === 'function') renderTodoList();
  if (typeof renderProblemHistory === 'function') renderProblemHistory();
  if (typeof renderCustomScheduleTasksList === 'function') renderCustomScheduleTasksList();
  if (typeof renderSchedulePresetsList === 'function') renderSchedulePresetsList();
  
  if (window.subjects && window.subjects.length > 0) {
    const timerSel = document.getElementById('timer-subject-select');
    if (timerSel) timerSel.value = window.subjects[0].id;
    const probSel = document.getElementById('prob-subject-select');
    if (probSel) probSel.value = window.subjects[0].id;
  }

  if (typeof setTimerMode === 'function') {
    setTimerMode('stopwatch');
  }
  if (typeof setTodoViewMode === 'function') {
    setTodoViewMode('list');
  }

  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  const probInput = document.getElementById('problem-name-input');
  if (probInput && typeof checkProblemComparison === 'function') {
    probInput.addEventListener('input', checkProblemComparison);
  }

  // 既存データで既に条件を満たしている実績がないかチェック
  if (typeof checkAchievements === 'function') checkAchievements();

  // アイコンの再生成（動的追加ボタン用）
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
});
