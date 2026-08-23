// ==== 共通ユーティリティ関数 ====

    function timeToMinutes(tStr) {
      if (tStr === '24:00') return 1440;
      const [h, m] = tStr.split(':').map(Number);
      return h * 60 + m;
    }

    function getTodayString() { return formatDateObj(new Date()); }

    function getNDaysAgoDate(n) { const d = new Date(); d.setDate(d.getDate() - n); return formatDateObj(d); }

    // 日曜〜土曜の暦週で「今週」の開始日・終了日を返す。
    // weekOffset=0が今週、1が先週、2が2週間前…という単位で遡る。
    function getCalendarWeekRange(weekOffset = 0) {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=日, 6=土
      const sunday = new Date(now);
      sunday.setDate(now.getDate() - dayOfWeek - (weekOffset * 7));
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      return { start: formatDateObj(sunday), end: formatDateObj(saturday) };
    }

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
