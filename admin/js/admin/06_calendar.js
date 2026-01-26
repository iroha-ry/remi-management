// =====================
// 期間 & 集計
// =====================

function calcPeriod() {
  if (!state.entries.length && !state.periodStart) {
    return { startDate: null, endDate: null };
  }

  const skip = Number(state.skipDays) || 0;
  let startDate;
  let endDate;

  if (state.periodStart) {
    startDate = parseDate(state.periodStart);
    endDate = new Date(startDate.getTime());
    endDate.setDate(endDate.getDate() + 6 + skip);
  } else if (state.entries.length) {
    const sorted = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
    const baseEnd = parseDate(sorted[0].date);
    endDate = new Date(baseEnd.getTime());
    endDate.setDate(endDate.getDate() + skip);
    startDate = new Date(endDate.getTime());
    startDate.setDate(startDate.getDate() - 6);
  }

  return { startDate, endDate };
}

function calcActualSummary() {
  const { startDate, endDate } = calcPeriod();
  if (!startDate || !endDate) {
    return { sumPlus: 0, sumCoins: 0, daily: {}, startDate: null, endDate: null };
  }

  const daily = {};
  let sumPlus = 0;
  let sumCoins = 0;

  for (const e of state.entries) {
    if (!e.date) continue;
    const d = parseDate(e.date);
    if (d < startDate || d > endDate) continue;

    const key = formatDateYMD(d);
    const plus = Number(e.drp) || 0;
    const coins = Number(e.coins) || 0;

    sumPlus += plus;
    sumCoins += coins;

    if (!daily[key]) daily[key] = { plus: 0, coins: 0 };
    daily[key].plus += plus;
    daily[key].coins += coins;
  }

  return { sumPlus, sumCoins, daily, startDate, endDate };
}

function calcPlanSummary() {
  normalizePlan();
  let planTotal = 0;
  for (const d of state.plan.days) {
    planTotal += Number(d.plannedPlus) || 0;
  }
  return { planTotal };
}

function buildCalendarInfo() {
  const { startDate, endDate } = calcPeriod();
  if (!startDate || !endDate) return null;

  // 期間内の全日付（7 + スキップ枚数 日ぶん）
  const dates = [];
  let d = new Date(startDate.getTime());
  while (d <= endDate) {
    dates.push(formatDateYMD(d));
    d.setDate(d.getDate() + 1);
  }

  // ★ skipDays の数だけスキップ日を有効にする
  const skipSet = new Set();
  const rawSkipDates = (state.skipDates || []).slice(0, state.skipDays || 0);
  rawSkipDates.forEach(raw => {
    if (!raw) return;
    if (raw >= dates[0] && raw <= dates[dates.length - 1]) {
      skipSet.add(raw);
    }
  });

  // 非スキップ日を抽出
  const activeDatesAll = dates.filter(ds => !skipSet.has(ds));

  // 非スキップ日が7日を超える場合は、先頭7日だけを「計画対象」とする
  const activeDates = activeDatesAll.slice(0, 7);

  // インデックス <-> 日付 マップを作成
  const activeIndexToDate = [];
  const activeDateToIndex = {};
  activeDates.forEach((ds, idx) => {
    activeIndexToDate[idx] = ds;
    activeDateToIndex[ds] = idx;
  });

  return {
    startDate,
    endDate,
    dates,              // 期間内の全日（テーブル行に使う）
    skipSet,            // スキップ日セット
    activeIndexToDate,  // 0〜6 → 非スキップ日付
    activeDateToIndex   // 非スキップ日付 → 0〜6
  };
}
