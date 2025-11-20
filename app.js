// ====== ランク定義 & ランクごとの設定 ======
const RANKS = ["D", "C1", "C2", "C3", "B1", "B2", "B3", "A1", "A2", "A3", "A4", "A5", "S", "SS"];

/**
 * ランクごとの必要スコア & コイン目安
 * ここにあなたが持ってるデータを入れてOK
 *
 * upThreshold  : ランクアップ判定に使う「7日合計pt」の下限
 * keepThreshold: キープ判定に使う下限（〜UP未満がKEEP）
 * coinsPerPoint: 1ptあたりのざっくりコイン数
 */
const RANK_CONFIG = {
  // サンプル：全部同じでもOK。後で実際の数値に書き換えて。
  D:  { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 0 },
  C1: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 0 },
  C2: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 0 },
  C3: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 0 },
  B1: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 0 },
  B2: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 0 },
  B3: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 0 },
  A1: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 2000 },
  A2: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 2200 },
  A3: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 2500 },
  A4: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 2800 },
  A5: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 3000 },
  S:  { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 3500 },
  SS: { upThreshold: 18, keepThreshold: 12, coinsPerPoint: 4000 }
};

const DEFAULT_THRESHOLDS = {
  upThreshold: 18,
  keepThreshold: 12
};

function getRankConfig(rank) {
  const cfg = RANK_CONFIG[rank] || {};
  return {
    upThreshold: cfg.upThreshold ?? DEFAULT_THRESHOLDS.upThreshold,
    keepThreshold: cfg.keepThreshold ?? DEFAULT_THRESHOLDS.keepThreshold,
    coinsPerPoint: cfg.coinsPerPoint ?? 0
  };
}

// ====== 状態管理 ======
const STORAGE_KEY = "palmuRankState_v3";

const DEFAULT_STATE = {
  currentRank: "A1",
  coinsPerPoint: 0,   // 手動上書き用
  skipDays: 0,        // スキップカード（日数）
  entries: []         // {id, date: "YYYY-MM-DD", drp, coins, hours, memo}
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return Object.assign(structuredClone(DEFAULT_STATE), parsed);
  } catch (e) {
    console.error("Failed to load state:", e);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ====== ユーティリティ ======
function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatNumber(n) {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("ja-JP");
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

// ====== レンダリング ======
function initRankSelect() {
  const select = document.getElementById("currentRank");
  if (!select) return;
  select.innerHTML = "";
  for (const r of RANKS) {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    select.appendChild(opt);
  }
  select.value = state.currentRank;
}

function renderEntries() {
  const tbody = document.querySelector("#entriesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!state.entries.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "text-small muted";
    td.textContent = "まだデータがありません。上のフォームから追加してください。";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const sorted = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
  const limited = sorted.slice(0, 30);

  for (const entry of limited) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = entry.date;

    const tdDrp = document.createElement("td");
    tdDrp.className = "text-right";
    tdDrp.textContent = `${entry.drp} pt`;

    const tdCoins = document.createElement("td");
    tdCoins.className = "text-right";
    tdCoins.textContent = entry.coins ? `${formatNumber(entry.coins)} コイン` : "-";

    const tdMemo = document.createElement("td");
    const texts = [];
    if (entry.hours) texts.push(`[時間] ${entry.hours}`);
    if (entry.memo) texts.push(entry.memo);
    tdMemo.textContent = texts.join(" / ") || "-";

    const tdActions = document.createElement("td");
    tdActions.className = "text-right";
    const delBtn = document.createElement("button");
    delBtn.className = "btn-sm danger";
    delBtn.type = "button";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", () => {
      if (!confirm(`${entry.date} のデータを削除しますか？`)) return;
      state.entries = state.entries.filter(e => e.id !== entry.id);
      saveState();
      updateAll();
    });
    tdActions.appendChild(delBtn);

    tr.appendChild(tdDate);
    tr.appendChild(tdDrp);
    tr.appendChild(tdCoins);
    tr.appendChild(tdMemo);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  }
}

/**
 * 7日間集計（スキップカード考慮）
 * - 最新入力日を baseEnd とする
 * - evaluationEnd = baseEnd + skipDays
 * - evaluationStart = evaluationEnd - 6日
 * - その期間に入る日付の＋数を合計
 */
function calcLast7Days() {
  if (!state.entries.length) return { sum7: 0, startDate: null, endDate: null };

  const sorted = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
  const latestDate = parseDate(sorted[0].date);

  const evaluationEnd = new Date(latestDate.getTime());
  const skip = Number(state.skipDays) || 0;
  if (skip > 0) {
    evaluationEnd.setDate(evaluationEnd.getDate() + skip);
  }

  const evaluationStart = new Date(evaluationEnd.getTime());
  evaluationStart.setDate(evaluationStart.getDate() - 6);

  let sum7 = 0;
  for (const e of state.entries) {
    const d = parseDate(e.date);
    if (d >= evaluationStart && d <= evaluationEnd) {
      sum7 += Number(e.drp) || 0;
    }
  }

  return { sum7, startDate: evaluationStart, endDate: evaluationEnd };
}

function renderDashboard() {
  const sum7El = document.getElementById("sum7");
  const needUpPointsEl = document.getElementById("needUpPoints");
  const needKeepPointsEl = document.getElementById("needKeepPoints");
  const needUpCoinsEl = document.getElementById("needUpCoins");
  const needKeepCoinsEl = document.getElementById("needKeepCoins");
  const safeMarginPointsEl = document.getElementById("safeMarginPoints");
  const progressBar = document.getElementById("progressBar");
  const statusBadge = document.getElementById("statusBadge");
  const currentRankBadges = document.getElementById("currentRankBadges");
  const nextRankLabel = document.getElementById("nextRankLabel");
  const prevRankLabel = document.getElementById("prevRankLabel");
  const periodStartEl = document.getElementById("periodStart");
  const periodEndEl = document.getElementById("periodEnd");
  const upConditionLabel = document.getElementById("upConditionLabel");
  const keepConditionLabel = document.getElementById("keepConditionLabel");
  const chipUpThreshold = document.getElementById("chipUpThreshold");
  const chipKeepThreshold = document.getElementById("chipKeepThreshold");
  const chipDownThreshold = document.getElementById("chipDownThreshold");

  if (!sum7El) return;

  const rank = state.currentRank;
  const rankIndex = RANKS.indexOf(rank);
  const nextRank = rankIndex >= 0 && rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1] : null;
  const prevRank = rankIndex > 0 ? RANKS[rankIndex - 1] : null;

  const cfg = getRankConfig(rank);

  // ランク表示
  if (nextRankLabel) nextRankLabel.textContent = nextRank || "これ以上はありません（最上位）";
  if (prevRankLabel) prevRankLabel.textContent = prevRank || "これ以上はありません（最下位）";

  if (currentRankBadges) {
    currentRankBadges.innerHTML = "";
    const rankBadge = document.createElement("span");
    rankBadge.className = "badge badge-rank";
    rankBadge.textContent = `現在ランク: ${rank}`;
    currentRankBadges.appendChild(rankBadge);
    if (nextRank) {
      const nextBadge = document.createElement("span");
      nextBadge.className = "badge badge-keep";
      nextBadge.textContent = `次: ${nextRank}`;
      currentRankBadges.appendChild(nextBadge);
    }
  }

  // 7日間集計
  const { sum7, startDate, endDate } = calcLast7Days();
  sum7El.textContent = sum7;

  if (periodStartEl) periodStartEl.textContent = startDate ? formatDateYMD(startDate) : "-";
  if (periodEndEl) periodEndEl.textContent = endDate ? formatDateYMD(endDate) : "-";

  const UP_THRESHOLD = cfg.upThreshold;
  const KEEP_THRESHOLD = cfg.keepThreshold;

  if (upConditionLabel) upConditionLabel.textContent = `ランクアップ条件（${UP_THRESHOLD}pt以上）`;
  if (keepConditionLabel) keepConditionLabel.textContent = `キープ条件（${KEEP_THRESHOLD}pt以上）`;

  if (chipUpThreshold) chipUpThreshold.textContent = UP_THRESHOLD;
  if (chipKeepThreshold) chipKeepThreshold.textContent = KEEP_THRESHOLD;
  if (chipDownThreshold) chipDownThreshold.textContent = KEEP_THRESHOLD - 1;

  const needUpPoints = Math.max(0, UP_THRESHOLD - sum7);
  const needKeepPoints = Math.max(0, KEEP_THRESHOLD - sum7);
  const safeMargin =
    sum7 === 0 && state.entries.length === 0
      ? "-"
      : sum7 <= KEEP_THRESHOLD - 1
      ? `あと ${(KEEP_THRESHOLD - 1) - sum7 + 1} pt でダウン域`
      : `${sum7 - (KEEP_THRESHOLD - 1)} pt`;

  if (needUpPointsEl) needUpPointsEl.textContent = needUpPoints;
  if (needKeepPointsEl) needKeepPointsEl.textContent = needKeepPoints;
  if (safeMarginPointsEl) safeMarginPointsEl.textContent = safeMargin;

  // コイン換算（ランク設定 → 手動入力の順で優先）
  let cpp = Number(state.coinsPerPoint) || 0;
  if (!cpp && cfg.coinsPerPoint) {
    cpp = cfg.coinsPerPoint;
  }

  if (cpp > 0) {
    if (needUpCoinsEl) needUpCoinsEl.textContent = needUpPoints > 0 ? formatNumber(needUpPoints * cpp) : "0";
    if (needKeepCoinsEl) needKeepCoinsEl.textContent = needKeepPoints > 0 ? formatNumber(needKeepPoints * cpp) : "0";
  } else {
    if (needUpCoinsEl) needUpCoinsEl.textContent = "-";
    if (needKeepCoinsEl) needKeepCoinsEl.textContent = "-";
  }

  // プログレスバー（UPに対する達成度）
  if (progressBar) {
    const progress = clamp(sum7 / UP_THRESHOLD, 0, 1) * 100;
    progressBar.style.width = `${progress}%`;
  }

  // 判定
  if (statusBadge) {
    let statusText = "データ不足";
    let badgeClass = "badge badge-keep";

    if (state.entries.length === 0) {
      statusText = "データ不足";
      badgeClass = "badge badge-keep";
    } else if (sum7 >= UP_THRESHOLD) {
      statusText = `UP条件クリア（${UP_THRESHOLD}pt以上）`;
      badgeClass = "badge badge-up";
    } else if (sum7 >= KEEP_THRESHOLD) {
      statusText = `KEEP条件クリア（${KEEP_THRESHOLD}〜${UP_THRESHOLD - 1}pt）`;
      badgeClass = "badge badge-keep";
    } else {
      statusText = `DOWN域（〜${KEEP_THRESHOLD - 1}pt）`;
      badgeClass = "badge badge-down";
    }

    statusBadge.className = badgeClass;
    statusBadge.textContent = statusText;
  }
}

function updateAll() {
  renderEntries();
  renderDashboard();
  saveState();
}

// ====== イベント登録 ======
function setupForm() {
  const form = document.getElementById("entryForm");
  const dateInput = document.getElementById("date");
  const drpInput = document.getElementById("drp");
  const coinsInput = document.getElementById("coins");
  const hoursInput = document.getElementById("hours");
  const memoInput = document.getElementById("memo");

  if (!form) return;

  dateInput.value = todayString();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const date = dateInput.value;
    const drp = Number(drpInput.value);
    const coins = coinsInput.value ? Number(coinsInput.value) : 0;
    const hours = hoursInput.value.trim();
    const memo = memoInput.value.trim();

    if (!date || isNaN(drp)) {
      alert("日付と＋数を入力してください。");
      return;
    }

    const entry = {
      id: `${date}_${Date.now()}`,
      date,
      drp,
      coins,
      hours,
      memo
    };
    state.entries.push(entry);
    saveState();

    drpInput.value = "";
    coinsInput.value = "";
    hoursInput.value = "";
    memoInput.value = "";

    updateAll();
  });
}

function setupSettings() {
  const rankSelect = document.getElementById("currentRank");
  const cppInput = document.getElementById("coinsPerPoint");
  const skipDaysInput = document.getElementById("skipDays");

  if (rankSelect) {
    rankSelect.addEventListener("change", () => {
      state.currentRank = rankSelect.value;
      saveState();
      updateAll();
    });
  }

  if (cppInput) {
    cppInput.value = state.coinsPerPoint || "";
    cppInput.addEventListener("change", () => {
      state.coinsPerPoint = Number(cppInput.value) || 0;
      saveState();
      updateAll();
    });
  }

  if (skipDaysInput) {
    skipDaysInput.value = state.skipDays || 0;
    skipDaysInput.addEventListener("change", () => {
      let v = Number(skipDaysInput.value);
      if (isNaN(v) || v < 0) v = 0;
      if (v > 7) v = 7;
      state.skipDays = v;
      skipDaysInput.value = v;
      saveState();
      updateAll();
    });
  }
}

function setupClearAll() {
  const btn = document.getElementById("clearAll");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!state.entries.length) return;
    if (!confirm("保存されている全ての入力データを削除しますか？（元に戻せません）")) return;
    state.entries = [];
    saveState();
    updateAll();
  });
}

// ====== 初期化 ======
document.addEventListener("DOMContentLoaded", () => {
  initRankSelect();
  setupForm();
  setupSettings();
  setupClearAll();
  updateAll();
});
