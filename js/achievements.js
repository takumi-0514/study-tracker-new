// ==== 実績(アチーブメント)システム ====
// 集計ベースの実績(しきい値系)はいつでも再チェック可能。
// イベント系(はじめて/隠し実績)は該当アクション発生時にcontext付きでチェックする。
// 一度解除した実績は、後で条件を満たさなくなっても解除済みのまま維持する。

    let ACHIEVEMENTS = [];
    let achievementsBuilt = false;

    const ACHIEVEMENT_SUBJECT_NAMES = ['国語', '数学', '英語', '理科', '社会'];

    function defAchievement(id, category, name, checkFn, hidden = false, desc = '') {
      ACHIEVEMENTS.push({ id, category, name, checkFn, hidden, desc });
    }

    // ---- 集計ヘルパー ----

    function ach_maxDailyTotalMinutes() {
      const totals = {};
      logs.forEach(l => { totals[l.date] = (totals[l.date] || 0) + l.minutes; });
      const vals = Object.values(totals);
      return vals.length ? Math.max(...vals) : 0;
    }

    function ach_maxCalendarWeekTotalMinutes() {
      const totals = {};
      logs.forEach(l => {
        const d = new Date(l.date + 'T00:00:00');
        const sunday = new Date(d);
        sunday.setDate(d.getDate() - d.getDay());
        const key = formatDateObj(sunday);
        totals[key] = (totals[key] || 0) + l.minutes;
      });
      const vals = Object.values(totals);
      return vals.length ? Math.max(...vals) : 0;
    }

    function ach_maxCalendarMonthTotalMinutes() {
      const totals = {};
      logs.forEach(l => {
        const key = l.date.slice(0, 7);
        totals[key] = (totals[key] || 0) + l.minutes;
      });
      const vals = Object.values(totals);
      return vals.length ? Math.max(...vals) : 0;
    }

    function ach_longestStreakFromTotals(dailyTotals) {
      const dates = Object.keys(dailyTotals).filter(d => dailyTotals[d] > 0).sort();
      if (dates.length === 0) return 0;
      let longest = 1, current = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1] + 'T00:00:00');
        const cur = new Date(dates[i] + 'T00:00:00');
        const diffDays = Math.round((cur - prev) / 86400000);
        if (diffDays === 1) { current++; longest = Math.max(longest, current); }
        else { current = 1; }
      }
      return longest;
    }

    function ach_longestStudyStreakDays() {
      const totals = {};
      logs.forEach(l => { totals[l.date] = (totals[l.date] || 0) + l.minutes; });
      return ach_longestStreakFromTotals(totals);
    }

    function ach_longestGoalStreakDays() {
      const totals = {};
      logs.forEach(l => { totals[l.date] = (totals[l.date] || 0) + l.minutes; });
      const goalMins = (dailyGoal || 0) * 60;
      const achievedTotals = {};
      Object.keys(totals).forEach(d => { if (totals[d] >= goalMins) achievedTotals[d] = totals[d]; });
      return ach_longestStreakFromTotals(achievedTotals);
    }

    function ach_subjectTotalMinutes(subjectName) {
      const sub = subjects.find(s => s.name === subjectName);
      if (!sub) return 0;
      return logs.filter(l => l.subjectId === sub.id).reduce((s, l) => s + l.minutes, 0);
    }

    function ach_grandTotalMinutes() {
      return logs.reduce((s, l) => s + l.minutes, 0);
    }

    function ach_longestSubjectWeeklyGoalStreakWeeks(subjectName) {
      const sub = subjects.find(s => s.name === subjectName);
      if (!sub || !(sub.weeklyGoalMinutes > 0) || logs.length === 0) return 0;
      const oldestDate = logs.map(l => l.date).sort()[0];
      const weeksBack = Math.ceil((new Date() - new Date(oldestDate + 'T00:00:00')) / (7 * 86400000)) + 1;
      let longest = 0, current = 0;
      for (let i = 0; i <= weeksBack; i++) {
        const { start, end } = getCalendarWeekRange(i);
        const mins = logs.filter(l => l.subjectId === sub.id && l.date >= start && l.date <= end)
                          .reduce((s, l) => s + l.minutes, 0);
        if (mins >= sub.weeklyGoalMinutes) { current++; longest = Math.max(longest, current); }
        else { current = 0; }
      }
      return longest;
    }

    // ---- 実績定義の構築 ----

    function buildAchievementDefs() {
      ACHIEVEMENTS = [];

      // 1. 1日の合計学習時間 (30分刻み、12時間まで)
      const dailyNames = ["はじめの一歩！","すばらしいスタート","いい調子だね！","頑張り屋さんの君へ","応援してるよ！","目標に向かって一直線","すごい集中力！","努力の成果が出てるね","君ならできる！","誇らしいよ","今日も一歩前進","頼もしい集中力","ここまで来たら本物","圧巻の一日","驚異の集中力","まさに全力投球","底知れぬ集中力","伝説級の一日","常人離れした頑張り","圧倒的な学習量","もはや職人技","驚異的な一日","限界を超えた集中","勉強の鬼"];
      for (let i = 0; i < 24; i++) {
        const mins = (i + 1) * 30;
        const label = mins < 60 ? `${mins}分` : (mins % 60 === 0 ? `${mins/60}時間` : `${Math.floor(mins/60)}時間${mins%60}分`);
        defAchievement(`daily_${mins}`, '1日の合計学習時間', dailyNames[i], () => ach_maxDailyTotalMinutes() >= mins, false, `1日の合計学習時間が${label}に達すると解除`);
      }

      // 2. 1週間の合計学習時間 (7時間刻み、70時間まで)
      const weeklyNames = ["素敵な1週間の始まり","今週も頑張ったね！","習慣になってきたよ","君の成長が嬉しいな","充実の1週間","圧巻のペース","驚くべき継続力","圧倒的な週間記録","まさに努力の結晶","一週間の頂点へ"];
      for (let i = 0; i < 10; i++) {
        const hours = (i + 1) * 7;
        defAchievement(`weekly_${hours}`, '1週間の合計学習時間', weeklyNames[i], () => ach_maxCalendarWeekTotalMinutes() >= hours * 60, false, `1週間(日〜土)の合計学習時間が${hours}時間に達すると解除`);
      }

      // 3. 1か月の合計学習時間 (10時間刻み、200時間まで)
      const monthlyNames = ["1か月お疲れ様！","着実に進んでるね","今月の目標達成！","すごい粘り強さだね","立派な積み重ね","圧巻の継続力","驚異のペース配分","月間トップクラス","圧倒的な努力量","三桁の壁突破","さらなる高みへ","驚くべき継続の証","月間チャンピオン級","圧巻の一か月","伝説の学習月間","常人離れの継続力","まさに努力の化身","圧倒的月間記録","頂点まであと少し","月間の頂へ"];
      for (let i = 0; i < 20; i++) {
        const hours = (i + 1) * 10;
        defAchievement(`monthly_${hours}`, '1か月の合計学習時間', monthlyNames[i], () => ach_maxCalendarMonthTotalMinutes() >= hours * 60, false, `1か月の合計学習時間が${hours}時間に達すると解除`);
      }

      // 4. 連続学習日数
      const streakThresholds = [3, 7, 14, 30, 90, 180, 365];
      const streakNames = ["3日坊主回避", "一週間の壁突破", "止まらない歩み", "継続は力なり", "揺るぎない習慣", "継続の達人", "皆勤賞・一年生"];
      streakThresholds.forEach((days, i) => {
        defAchievement(`streak_${days}`, '連続学習日数', streakNames[i], () => ach_longestStudyStreakDays() >= days, false, `${days}日連続で学習記録をつけると解除`);
      });

      // 5. 連続目標達成日数
      const goalStreakThresholds = [1, 3, 5, 7, 14, 30];
      const goalStreakNames = ["約束を守れたね！", "有言実行、かっこいい！", "自分との勝負に勝ってるね", "有言実行の一週間", "揺るがない意志", "目標達成マスター"];
      goalStreakThresholds.forEach((days, i) => {
        defAchievement(`goalstreak_${days}`, '連続目標達成日数', goalStreakNames[i], () => ach_longestGoalStreakDays() >= days, false, `1日の目標学習時間を${days}日連続で達成すると解除`);
      });

      // 6. 科目別週間目標達成(連続週数)
      const subjWeekThresholds = [1, 2, 4, 8, 12];
      const subjWeekTemplates = ["{s}との出会い", "{s}と仲良くなれたね", "{s}マスターへの道", "{s}の実力が育ってきた", "{s}の達人"];
      ACHIEVEMENT_SUBJECT_NAMES.forEach(sName => {
        subjWeekThresholds.forEach((weeks, i) => {
          defAchievement(`subjweek_${sName}_${weeks}`, `${sName} 週間目標達成`, subjWeekTemplates[i].replace('{s}', sName),
            () => ach_longestSubjectWeeklyGoalStreakWeeks(sName) >= weeks, false, `${sName}の週間目標を${weeks}週連続で達成すると解除`);
        });
      });

      // 7. 科目別累計学習時間
      const subjCumThresholds = [1, 3, 5, 25, 50, 75, 77, 100, 150, 200, 300];
      const subjCumTemplates = ["{s}の扉を開けて", "{s}の楽しさが分かってきた？", "{s}の基礎はバッチリ！", "{s}に夢中だね", "{s}の実力者", "{s}を極めつつある", "ラッキー7!", "{s}マイスター", "{s}の求道者", "{s}の達人", "{s}を極めた者"];
      ACHIEVEMENT_SUBJECT_NAMES.forEach(sName => {
        subjCumThresholds.forEach((hours, i) => {
          defAchievement(`subjcum_${sName}_${hours}`, `${sName} 累計学習時間`, subjCumTemplates[i].replace('{s}', sName),
            () => ach_subjectTotalMinutes(sName) >= hours * 60, false, `${sName}の累計学習時間が${hours}時間に達すると解除`);
        });
      });

      // 8. 全科目合計累計学習時間
      const grandThresholds = [1, 3, 5, 25, 50, 75, 77, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500];
      const grandNames = ["小さな一歩", "芽生えた知識", "すくすく育つ芽", "積み上がる知識", "知識の塔", "揺るぎない基盤", "ラッキー7!", "三桁の学習者", "知識の探求者", "圧倒的な蓄積", "学びの巨匠", "圧巻の知識量", "500時間の軌跡", "学習の求道者", "驚異の学習量", "知の巨人", "圧倒的な積み重ね", "1000時間の到達者", "さらなる高みへ", "知識の殿堂入り", "圧巻の学習遍歴", "頂点まであと少し", "学びを極めし者"];
      grandThresholds.forEach((hours, i) => {
        defAchievement(`grand_${hours}`, '全科目合計累計学習時間', grandNames[i], () => ach_grandTotalMinutes() >= hours * 60, false, `全科目合計の累計学習時間が${hours}時間に達すると解除`);
      });

      // 9. ToDo完了回数
      const todoThresholds = [1, 3, 5, 10, 25, 50, 75, 77, 100];
      const todoNames = ["ひとつクリア！", "順調順調！", "素晴らしい達成感", "タスク消化名人", "頼れるタスクハンター", "チェックマークの達人", "圧巻のタスク処理力", "ラッキー7!", "タスクマスター"];
      todoThresholds.forEach((count, i) => {
        defAchievement(`todocount_${count}`, 'ToDo完了回数', todoNames[i], () => (todoCompletedCount || 0) >= count, false, `ToDoを累計${count}回完了すると解除`);
      });

      // 10. ポモドーロ完走回数(25-5パターン限定)
      const pomoThresholds = [1, 3, 5, 10, 25, 50, 75, 77, 100];
      const pomoNames = ["25分集中できたね！", "メリハリが大事！", "タイマーと一緒に頑張ろう", "集中モードON", "ポモドーロの達人", "圧巻の継続力", "揺るぎない集中習慣", "ラッキー7!", "ポモドーロマスター"];
      pomoThresholds.forEach((count, i) => {
        defAchievement(`pomocount_${count}`, 'ポモドーロ完走回数', pomoNames[i], () => (pomodoroCompletedCount || 0) >= count, false, `25分学習+5分休憩のポモドーロを累計${count}回完走すると解除`);
      });

      // 11. 「はじめて」系(イベント駆動、checkFnは常にfalseを返す=通常スキャンでは解除しない)
      defAchievement('first_stopwatch', 'はじめて', '勉強開始!', () => false, false, 'ストップウォッチモードで初めて学習を記録すると解除');
      defAchievement('first_timer', 'はじめて', '勉強終了!', () => false, false, 'タイマー(カウントダウン)モードで初めて学習を記録すると解除');
      defAchievement('first_alarm', 'はじめて', '時間きっちり!', () => false, false, '時刻アラームモードで初めて学習を記録すると解除');
      defAchievement('first_pomodoro', 'はじめて', '初めましてポモドーロタイマー', () => false, false, 'ポモドーロモードで初めて学習を記録すると解除');
      defAchievement('first_todo_add', 'はじめて', '初めてのToDo追加', () => false, false, '初めてToDoを追加すると解除');
      defAchievement('first_todo_ontime', 'はじめて', '初めての期限内ToDo完了', () => false, false, '初めて期限内にToDoを完了すると解除');
      defAchievement('first_schedule_full', 'はじめて', '初めてのスケジュール24時間埋め', () => false, false, '1日のスケジュールを24時間分すべて埋めると解除');
      defAchievement('first_manual', 'はじめて', '初めての手動記録追加', () => false, false, '初めて手動で学習記録を追加すると解除');

      // 12. 隠し実績・独立単発実績(イベント駆動)
      defAchievement('hidden_late_todo', '隠し実績', '決めたことはやろう', () => false, true, '期限を過ぎてからでもToDoを完了すると解除');
      defAchievement('hidden_early_bird', '隠し実績', '早起きは三文の徳', () => false, true, '朝5時台または6時台にタイマーを開始すると解除');
      defAchievement('hidden_night_owl', '隠し実績', '深夜の学習者', () => false, true, '深夜2時台にタイマーを開始すると解除');
      defAchievement('special_all_subjects_day', '単発実績', '五教科制覇', () => false, false, '登録している全科目を同じ日に学習すると解除');
      defAchievement('special_4h_session', '単発実績', '集中力の鬼', () => false, false, '1回のセッションで連続4時間以上学習すると解除');
      defAchievement('special_6h_session', '単発実績', '頑張りすぎ、、、？', () => false, false, '1回のセッションで連続6時間以上学習すると解除');

      // 13. 実績解除率(他の全実績が確定した後、最後に評価する)
      const rateThresholds = [10, 25, 50, 75, 100];
      const rateNames = ["勉強頑張るぞお！", "勉強って楽しいな", "勉強が生活の一部になってきた", "勉強こそ我が人生", "全実績制覇！"];
      rateThresholds.forEach((pct, i) => {
        defAchievement(`unlockrate_${pct}`, '実績解除率', rateNames[i], () => {
          const others = ACHIEVEMENTS.filter(a => a.category !== '実績解除率');
          const unlockedCount = others.filter(a => unlockedAchievements[a.id]).length;
          return others.length > 0 && (unlockedCount / others.length) * 100 >= pct;
        }, false, `全実績のうち${pct}%を解除すると解除`);
      });

      achievementsBuilt = true;
    }

    // ---- 実績の解除処理 ----

    function unlockAchievement(id) {
      if (unlockedAchievements[id]) return false;
      const def = ACHIEVEMENTS.find(a => a.id === id);
      if (!def) return false;
      unlockedAchievements[id] = getTodayString();
      saveUnlockedAchievements();
      showToast(`🏆 実績解除: 「${def.name}」`);
      return true;
    }

    // ---- メインのチェック関数 ----

    function checkAchievements(context = {}) {
      if (!achievementsBuilt) buildAchievementDefs();

      let anyNewlyUnlocked = false;

      // 集計ベースの実績(実績解除率以外)を全チェック
      ACHIEVEMENTS.forEach(def => {
        if (def.category === '実績解除率' || def.category === 'はじめて' || def.category === '隠し実績' || def.category === '単発実績') return;
        if (unlockedAchievements[def.id]) return;
        try {
          if (def.checkFn()) {
            if (unlockAchievement(def.id)) anyNewlyUnlocked = true;
          }
        } catch (e) { /* 集計エラーは無視して継続 */ }
      });

      // イベント駆動の実績
      const trigger = context.trigger;

      if (trigger === 'timer_save') {
        if (context.timerMode === 'stopwatch') { if (unlockAchievement('first_stopwatch')) anyNewlyUnlocked = true; }
        if (context.timerMode === 'timer') { if (unlockAchievement('first_timer')) anyNewlyUnlocked = true; }
        if (context.timerMode === 'alarm') { if (unlockAchievement('first_alarm')) anyNewlyUnlocked = true; }
        if (context.timerMode === 'pomodoro') { if (unlockAchievement('first_pomodoro')) anyNewlyUnlocked = true; }

        if (typeof context.startHour === 'number') {
          if (context.startHour === 5 || context.startHour === 6) {
            if (unlockAchievement('hidden_early_bird')) anyNewlyUnlocked = true;
          }
          if (context.startHour === 2) {
            if (unlockAchievement('hidden_night_owl')) anyNewlyUnlocked = true;
          }
        }

        if (typeof context.sessionMinutes === 'number') {
          if (context.sessionMinutes >= 240 && unlockAchievement('special_4h_session')) anyNewlyUnlocked = true;
          if (context.sessionMinutes >= 360 && unlockAchievement('special_6h_session')) anyNewlyUnlocked = true;
        }

        if (ach_checkAllSubjectsToday()) {
          if (unlockAchievement('special_all_subjects_day')) anyNewlyUnlocked = true;
        }
      }

      if (trigger === 'manual_save') {
        if (unlockAchievement('first_manual')) anyNewlyUnlocked = true;
        if (typeof context.sessionMinutes === 'number') {
          if (context.sessionMinutes >= 240 && unlockAchievement('special_4h_session')) anyNewlyUnlocked = true;
          if (context.sessionMinutes >= 360 && unlockAchievement('special_6h_session')) anyNewlyUnlocked = true;
        }
        if (ach_checkAllSubjectsToday()) {
          if (unlockAchievement('special_all_subjects_day')) anyNewlyUnlocked = true;
        }
      }

      if (trigger === 'todo_add') {
        if (unlockAchievement('first_todo_add')) anyNewlyUnlocked = true;
      }

      if (trigger === 'todo_complete') {
        if (context.onTime) {
          if (unlockAchievement('first_todo_ontime')) anyNewlyUnlocked = true;
        } else {
          if (unlockAchievement('hidden_late_todo')) anyNewlyUnlocked = true;
        }
      }

      if (trigger === 'schedule_save') {
        if (context.dayScheduledMinutes >= 1440) {
          if (unlockAchievement('first_schedule_full')) anyNewlyUnlocked = true;
        }
      }

      // 実績解除率を最後に評価
      ACHIEVEMENTS.forEach(def => {
        if (def.category !== '実績解除率') return;
        if (unlockedAchievements[def.id]) return;
        try {
          if (def.checkFn()) {
            if (unlockAchievement(def.id)) anyNewlyUnlocked = true;
          }
        } catch (e) { /* 無視 */ }
      });

      if (anyNewlyUnlocked && typeof renderAchievementsPage === 'function') {
        renderAchievementsPage();
      }
      return anyNewlyUnlocked;
    }

    function ach_checkAllSubjectsToday() {
      if (!subjects || subjects.length === 0) return false;
      const todayStr = getTodayString();
      return subjects.every(sub => logs.some(l => l.subjectId === sub.id && l.date === todayStr));
    }

    // ---- 実績ページの描画 ----

    function renderAchievementsPage() {
      const container = document.getElementById('achievements-list');
      const countEl = document.getElementById('achievements-count');
      if (!container) return;

      if (!achievementsBuilt) buildAchievementDefs();

      const unlockedCount = ACHIEVEMENTS.filter(a => unlockedAchievements[a.id]).length;
      if (countEl) countEl.innerText = `${unlockedCount} / ${ACHIEVEMENTS.length} 解除`;

      const categories = [...new Set(ACHIEVEMENTS.map(a => a.category))];
      container.innerHTML = '';

      categories.forEach(cat => {
        const items = ACHIEVEMENTS.filter(a => a.category === cat);
        const unlockedInCat = items.filter(a => unlockedAchievements[a.id]).length;

        const section = document.createElement('div');
        section.className = 'mb-6';
        section.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-bold text-slate-700">${cat}</h4>
            <span class="text-xs text-slate-400">${unlockedInCat} / ${items.length}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-cat-grid></div>
        `;
        const grid = section.querySelector('[data-cat-grid]');

        items.forEach(a => {
          const isUnlocked = !!unlockedAchievements[a.id];
          const card = document.createElement('div');
          const revealText = isUnlocked
            ? (a.desc || (a.hidden ? '隠し実績でした！' : ''))
            : (a.hidden ? '？隠し実績です(条件は秘密)' : (a.desc || '？？？'));

          if (isUnlocked) {
            card.className = 'flex flex-col gap-1 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 cursor-pointer select-none transition hover:brightness-95';
            card.innerHTML = `
              <div class="flex items-center gap-2.5">
                <span class="text-lg flex-shrink-0">🏆</span>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-slate-800 truncate">${a.name}</div>
                  <div class="text-[10px] text-slate-400">${unlockedAchievements[a.id]}</div>
                </div>
                <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" data-chevron></i>
              </div>
              <div class="text-[10px] text-slate-500 leading-relaxed hidden pl-7 pr-1" data-reveal>${revealText}</div>
            `;
          } else {
            card.className = 'flex flex-col gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 opacity-70 cursor-pointer select-none transition hover:opacity-90';
            card.innerHTML = `
              <div class="flex items-center gap-2.5">
                <span class="text-lg flex-shrink-0">🔒</span>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-semibold text-slate-500 truncate">？？？</div>
                </div>
                <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" data-chevron></i>
              </div>
              <div class="text-[10px] text-slate-500 leading-relaxed hidden pl-7 pr-1" data-reveal>${revealText}</div>
            `;
          }

          card.addEventListener('click', () => {
            const revealEl = card.querySelector('[data-reveal]');
            const chevronEl = card.querySelector('[data-chevron]');
            revealEl.classList.toggle('hidden');
            if (chevronEl) chevronEl.style.transform = revealEl.classList.contains('hidden') ? '' : 'rotate(180deg)';
          });

          grid.appendChild(card);
        });

        container.appendChild(section);
      });
      lucide.createIcons();
    }
