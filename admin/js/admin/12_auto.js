// =====================
// 日付変化・自動＋1
// =====================

function getYesterdayStr() {
  const now = new Date();
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  y.setDate(y.getDate() - 1);
  return formatDateYMD(y);
}

function ensurePrevDayAutoPlus1() {
  if (!state.autoPlus1PrevDay) return;

  const yesterdayStr = getYesterdayStr();

  // 同じ前日には1回だけ
  if (state.lastPrevAutoFillYMD === yesterdayStr) return;

  // 前日のentriesが既にあるなら何もしない（フラグだけ更新）
  const idx = findEntryIndexByDate(yesterdayStr);
  if (idx >= 0) {
    state.lastPrevAutoFillYMD = yesterdayStr;
    saveState();
    return;
  }

  // 前日未入力 → ＋1補完（drp=1）
  upsertEntryByDate(yesterdayStr, {
    drp: 1,
    coins: 0,
    hours: "",
    memo: "auto +1 (prev day)"
  });

  state.lastPrevAutoFillYMD = yesterdayStr;
  saveState();
}

let lastDayStr = null;
let midnightWatcherId = null;

function startMidnightWatcher() {
  if (midnightWatcherId) {
    clearInterval(midnightWatcherId);
    midnightWatcherId = null;
  }

  const tick = async () => {
    const now = new Date();
    const todayStr = formatDateYMD(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

    if (!lastDayStr) lastDayStr = todayStr;

    // 日付が変わった瞬間を検知
    if (todayStr !== lastDayStr) {
      lastDayStr = todayStr;
      ensurePrevDayAutoPlus1();
      updateAll();
    }
  };

  tick();
  midnightWatcherId = setInterval(tick, 60 * 1000); // 1分ごとで十分軽い
}
