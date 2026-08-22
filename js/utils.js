// ==== 共通ユーティリティ関数 ====

    function timeToMinutes(tStr) {
      if (tStr === '24:00') return 1440;
      const [h, m] = tStr.split(':').map(Number);
      return h * 60 + m;
    }

    function getTodayString() { return formatDateObj(new Date()); }

    function getNDaysAgoDate(n) { const d = new Date(); d.setDate(d.getDate() - n); return formatDateObj(d); }

    function formatDateObj(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

    function formatMinutes(mins) { return `${Math.floor(mins / 60)}h ${mins % 60}m`; }

    function showToast(message) {
      const t = document.getElementById('toast');
      document.getElementById('toast-message').innerText = message;
      t.classList.remove('translate-y-20', 'opacity-0');
      t.classList.add('translate-y-0', 'opacity-100');
      setTimeout(() => {
        t.classList.remove('translate-y-0', 'opacity-100');
        t.classList.add('translate-y-20', 'opacity-0');
      }, 3000);
    }
