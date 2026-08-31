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
