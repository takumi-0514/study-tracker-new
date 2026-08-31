const fs = require('fs');
let code = fs.readFileSync('./js/sync.js', 'utf8');

code = code.replace(/window\.createSyncRoom = async function\(\) \{[\s\S]*?window\.joinSyncRoom = async function/m, `window.createSyncRoom = async function() {
  const roomInput = document.getElementById('sync-room-input');
  const passInput = document.getElementById('sync-password-input');
  const roomId = roomInput.value.trim();
  const password = passInput.value.trim();
  
  if (!roomId || !password) {
    if (typeof showToast === 'function') showToast("ルームIDとパスワードの両方を入力してください。");
    else alert("ルームIDとパスワードの両方を入力してください。");
    return;
  }
  
  updateSyncStatus('☁️ ルーム確認中...', 'text-indigo-500');
  const database = await initFirebase();
  if (!database) {
    if (typeof showToast === 'function') showToast("ネットワークエラーが発生しました。");
    return;
  }
  
  const docRef = doc(database, 'rooms', roomId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    if (typeof showToast === 'function') showToast("エラー: このルームIDは既に使用されています。");
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
  
  if (typeof showToast === 'function') showToast("同期ルームを新規作成し、接続しました！");
};

window.joinSyncRoom = async function`);

code = code.replace(/window\.joinSyncRoom = async function\(\) \{[\s\S]*?window\.disconnectSyncRoom = function/m, `window.joinSyncRoom = async function() {
  const roomInput = document.getElementById('sync-room-input');
  const passInput = document.getElementById('sync-password-input');
  const roomId = roomInput.value.trim();
  const password = passInput.value.trim();
  
  if (!roomId || !password) {
    if (typeof showToast === 'function') showToast("ルームIDとパスワードの両方を入力してください。");
    else alert("ルームIDとパスワードの両方を入力してください。");
    return;
  }
  
  updateSyncStatus('☁️ ルーム確認中...', 'text-indigo-500');
  const database = await initFirebase();
  if (!database) {
    if (typeof showToast === 'function') showToast("ネットワークエラーが発生しました。");
    return;
  }
  
  const docRef = doc(database, 'rooms', roomId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    if (typeof showToast === 'function') showToast("エラー: ルームが見つかりません。");
    else alert("ルームが見つかりません。IDを確認するか、「新規作成」してください。");
    updateSyncStatus('ローカル保存稼働中', 'text-emerald-600');
    return;
  }
  
  const remoteData = docSnap.data();
  if (remoteData.ciphertext) {
    const decryptedData = await decryptData(remoteData, password);
    if (!decryptedData) {
      if (typeof showToast === 'function') showToast("エラー: パスワードが間違っています。");
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
    if (typeof showToast === 'function') showToast("ルームに参加し、データを同期しました！");
  } else {
    if (typeof showToast === 'function') showToast("このルームは暗号化されていない古い形式です。");
    else alert("このルームは暗号化されていない古い形式です。");
  }
};

window.disconnectSyncRoom = function`);

code = code.replace(/window\.disconnectSyncRoom = function\(\) \{[\s\S]*?\/\/ --- 通知トリガー ---/m, `window.disconnectSyncRoom = function() {
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
  if (typeof showToast === 'function') showToast("同期設定を解除しました。");
};

// --- 通知トリガー ---`);

// DOMContentLoaded の部分も updateSyncUIState を呼ぶようにする
code = code.replace(/if \(roomInput && passInput && savedRoom && savedPass\) \{[\s\S]*?setupRealtimeSync\(savedRoom, savedPass\);\n  \}/m, `if (roomInput && passInput && savedRoom && savedPass) {
    roomInput.value = savedRoom;
    passInput.value = savedPass;
    updateSyncUIState(true);
    setupRealtimeSync(savedRoom, savedPass);
  }`);

fs.writeFileSync('./js/sync.js', code);
