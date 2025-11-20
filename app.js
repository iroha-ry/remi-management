// =====================
// Firebase 初期化（あなたの config をそのまま使用）
// =====================

const firebaseConfig = {
  apiKey: "AIzaSyAwXA9NUKbFEj8rpBOnjTDvdxtlPU914ZI",
  authDomain: "palmu-rank-tracker.firebaseapp.com",
  projectId: "palmu-rank-tracker",
  storageBucket: "palmu-rank-tracker.firebasestorage.app",
  messagingSenderId: "475887212310",
  appId: "1:475887212310:web:c4ec10f408596a887ca237"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// このアプリ全体の状態を保存するドキュメント
const STATE_COLLECTION = "palmuStates";
const STATE_DOC_ID = "main"; // ライバー1人分ならこれでOK
const stateDocRef = db.collection(STATE_COLLECTION).doc(STATE_DOC_ID);

// =====================
// ランク定義 & デフォルト設定
// =====================

const RANKS = ["D", "C1", "C2", "C3", "B1", "B2", "B3", "A1", "A2", "A3", "A4", "A5", "S", "SS"];

/**
 * ランクごとのデフォ設定（必要に応じて書き換え OK）
 * upThreshold   : 7日間でUPに必要な合計pt
 * keepThreshold : 7日間でKEEPに必要な合計pt
 * coinsPerPoint : 1ptあたりのざっくりコイン数
 */
const DEFAULT_RANK_CONFIG = {
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

// Firestore に rankConfig があればそれで上書きできる
function getRankConfig(rank) {
  const base = DEFAULT_RANK_CONFIG[rank] || DEFAULT_RANK_CONFIG["A1"];
  const overrideMap = state.rankConfig || {};
  const override = overrideMap[rank] || {};
  return {
    upThreshold: override.upThreshold ?? base.upThreshold,
    keepThreshold: override.keepThreshold ?? base.keepThreshold,
    coinsPerPoint: override.coinsPerPoint ?? base.coinsPerPoint
  };
}

// =====================
// 状態管理
// =====================

const DEFAULT_STATE = {
  currentRank: "A1",
  coinsPerPoint: 0,      // 手動上書き用（0ならランク設定を使う）
  skipDays: 0,           // スキップカード（日数）
  periodStart: null,     // 「この日から7日間スタート」の開始日 (YYYY-MM-DD)
  entries: [],           // {id, date, drp, coins, hours, memo}
  rankConfig: {}         // ランクごとの個別設定（Firestoreから編集したい場合用）
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = cloneDefaultState();

// Firestore から state を読み込む
async function loadStateFromFirestore() {
  try {
    const snap = await stateDocRef.get();
    if (snap.exists) {
      const data = snap.data();
      state = Object.assign(cloneDefaultState(), data);
    } else {
      state = cloneDefaultState();
      await stateDocRef.set(state);
    }
  } catch (e) {
    console.error("Firestoreからの読み込みに失敗しました:", e);
    state = cloneDefaultState();
  }
}

// Firestore に state を保存
function saveState() {
  stateDocRef
    .set(state)
    .catch(err => console.error("Firestoreへの保存に失敗しました:", err));
}

// =====================
// ユーティリティ
// =====================

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

function dateDiffInDays(a, b) {
  const ONE_DAY = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utc2 - utc1) / ONE_DAY);
}

// 有効な 1pt あたりコイン数（手動入力 > ランク設定）
function effectiveCoinsPerPoint(rank) {
  const cfg = getRankConfig(rank);
  const manual = Number(state.coinsPerPoint) || 0;
  if (manual > 0) return manual;
  return cfg.coinsPerPoint || 0;
}

// =====================
// 7日間の期間計算（開始日＋スキップ対応）
// =====================

/**
 * 7日間集計（periodStart + skipDays を考慮）
 *
 * - periodStart が設定されていれば
 *     startDate = periodStart
 *     endDate   = startDate + 6日 + skipDays
 * - 未設定なら
 *     baseEnd   = 最新入力日
 *     endDate   = baseEnd + skipDays
 *     startDate = endDate - 6日
 */
function calcPeriod() {
  if (!state.entries.length) {
    return { sum: 0, startDate: null, endDate: null };
  }

  const skip = Number(state.skipDays) || 0;
  let startDate;
  let endDate;

  if (state.periodStart) {
    // ユーザー指定の開始日
    startDate = parseDate(state.periodStart);
    endDate = new Date(startDate.getTime());
    endDate.setDate(endDate.getDate() + 6 + skip);
  } else {
    // 最新日から逆算するモード
    const sorted = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
    const baseEnd = parseDate(sorted[0].date);
    endDate = new Date(baseEnd.getTime());
    endDate.setDate(endDate.getDate() + skip);
    startDate = new Date(endDate.getTime());
    startDate.setDate(startDate.getDate() - 6);
  }

  let sum = 0;
  for (const e of state.entries) {
    const d = parseDate(e.date);
    if (d >= startDate && d <= endDate) {
      sum += Number(e.drp) || 0;
    }
  }

  return { sum, startDate, endDate };
}

// 「今日＋◯pt取るには？」の計画計算
function calcPlan(sum, endDate, upThreshold) {
  if (!endDate) {
    return { remainingDays: 0, targetPerDay: 0, remainingForUp: upThreshold - sum };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  let remainingDays = dateDiffInDays(today, end) + 1; // 今日を含める
  if (remainingDays < 0) remainingDays = 0;

  const remainingForUp = Math.max(0, upThreshold - sum);
  let targetPerDay = 0;
  if (remainingDays > 0 && remainingForUp > 0) {
    targetPerDay = Math.ceil(remainingForUp / remainingDays);
  }

  return { remainingDays, targetPerDay, remainingForUp };
}

// =====================
// レンダリング
// =====================

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
  const periodStartLabel = document.getElementById("periodStart");
  const periodEndLabel = document.getElementById("periodEnd");
  const upConditionLabel = document.getElementById("upConditionLabel");
  const keepConditionLabel = document.getElementById("keepConditionLabel");
  const chipUpThreshold = document.getElementById("chipUpThreshold");
  const chipKeepThreshold = document.getElementById("chipKeepThreshold");
  const chipDownThreshold = document.getElementById("chipDownThreshold");
  const todayTargetPtEl = document.getElementById("todayTargetPt");
  const todayTargetCoinsEl = document.getElementById("todayTargetCoins");

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
  const { sum, startDate, endDate } = calcPeriod();
  if (sum7El) sum7El.textContent = sum;

  if (periodStartLabel) periodStartLabel.textContent = startDate ? formatDateYMD(startDate) : "-";
  if (periodEndLabel) periodEndLabel.textContent = endDate ? formatDateYMD(endDate) : "-";

  const UP_THRESHOLD = cfg.upThreshold;
  const KEEP_THRESHOLD = cfg.keepThreshold;

  if (upConditionLabel) upConditionLabel.textContent = `ランクアップ条件（${UP_THRESHOLD}pt以上）`;
  if (keepConditionLabel) keepConditionLabel.textContent = `キープ条件（${KEEP_THRESHOLD}pt以上）`;
  if (chipUpThreshold) chipUpThreshold.textContent = UP_THRESHOLD;
  if (chipKeepThreshold) chipKeepThreshold.textContent = KEEP_THRESHOLD;
  if (chipDownThreshold) chipDownThreshold.textContent = KEEP_THRESHOLD - 1;

  const needUpPoints = Math.max(0, UP_THRESHOLD - sum);
  const needKeepPoints = Math.max(0, KEEP_THRESHOLD - sum);
  const safeMargin =
    sum === 0 && state.entries.length === 0
      ? "-"
      : sum <= KEEP_THRESHOLD - 1
      ? `あと ${(KEEP_THRESHOLD - 1) - sum + 1} pt でダウン域`
      : `${sum - (KEEP_THRESHOLD - 1)} pt`;

  if (needUpPointsEl) needUpPointsEl.textContent = needUpPoints;
  if (needKeepPointsEl) needKeepPointsEl.textContent = needKeepPoints;
  if (safeMarginPointsEl) safeMarginPointsEl.textContent = safeMargin;

  // コイン換算
  const cpp = effectiveCoinsPerPoint(rank);
  if (cpp > 0) {
    if (needUpCoinsEl) needUpCoinsEl.textContent = needUpPoints > 0 ? formatNumber(needUpPoints * cpp) : "0";
    if (needKeepCoinsEl) needKeepCoinsEl.textContent = needKeepPoints > 0 ? formatNumber(needKeepPoints * cpp) : "0";
  } else {
    if (needUpCoinsEl) needUpCoinsEl.textContent = "-";
    if (needKeepCoinsEl) needKeepCoinsEl.textContent = "-";
  }

  // プログレスバー
  if (progressBar) {
    const progress = clamp(sum / UP_THRESHOLD, 0, 1) * 100;
    progressBar.style.width = `${progress}%`;
  }

  // 判定
  if (statusBadge) {
    let statusText = "データ不足";
    let badgeClass = "badge badge-keep";

    if (state.entries.length === 0) {
      statusText = "データ不足";
      badgeClass = "badge badge-keep";
    } else if (sum >= UP_THRESHOLD) {
      statusText = `UP条件クリア（${UP_THRESHOLD}pt以上）`;
      badgeClass = "badge badge-up";
    } else if (sum >= KEEP_THRESHOLD) {
      statusText = `KEEP条件クリア（${KEEP_THRESHOLD}〜${UP_THRESHOLD - 1}pt）`;
      badgeClass = "badge badge-keep";
    } else {
      statusText = `DOWN域（〜${KEEP_THRESHOLD - 1}pt）`;
      badgeClass = "badge badge-down";
    }

    statusBadge.className = badgeClass;
    statusBadge.textContent = statusText;
  }

  // 今日のノルマ（UPを目指す場合）
  const plan = calcPlan(sum, endDate, UP_THRESHOLD);
  if (todayTargetPtEl && todayTargetCoinsEl) {
    if (plan.remainingDays <= 0 || plan.remainingForUp <= 0) {
      todayTargetPtEl.textContent = "UP条件はすでに達成 or 期間終了";
      todayTargetCoinsEl.textContent = "-";
    } else {
      todayTargetPtEl.textContent =
        `${plan.targetPerDay} pt / 日（残り${plan.remainingDays}日でUP目標）`;
      const cpp2 = cpp;
      if (cpp2 > 0) {
        todayTargetCoinsEl.textContent =
          `${formatNumber(plan.targetPerDay * cpp2)} コイン`;
      } else {
        todayTargetCoinsEl.textContent = "-";
      }
    }
  }
}

function updateAll() {
  renderEntries();
  renderDashboard();
  saveState();
}

// =====================
// イベントハンドラ
// =====================

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
    updateAll();

    drpInput.value = "";
    coinsInput.value = "";
    hoursInput.value = "";
    memoInput.value = "";
  });
}

function setupSettings() {
  const rankSelect = document.getElementById("currentRank");
  const cppInput = document.getElementById("coinsPerPoint");
  const skipDaysInput = document.getElementById("skipDays");
  const periodStartInput = document.getElementById("periodStartInput"); // 「7日間開始日」用

  if (rankSelect) {
    rankSelect.value = state.currentRank;
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

  if (periodStartInput) {
    periodStartInput.value = state.periodStart || "";
    periodStartInput.addEventListener("change", () => {
      state.periodStart = periodStartInput.value || null;
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

// =====================
// 初期化
// =====================

async function initApp() {
  await loadStateFromFirestore();
  initRankSelect();
  setupForm();
  setupSettings();
  setupClearAll();
  updateAll();
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
