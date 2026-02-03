// =====================
// Firebase 初期化（viewerは読み取り専用）
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

const publicDocRef = db.collection("publicStates").doc("main");

function startViewer() {
  publicDocRef.onSnapshot((snap) => {
    const data = snap.data() || {};
    console.log("[viewer] publicStates/main =", data);

    // 例: 表示先IDはあなたのHTMLに合わせて
    const rankEl = document.getElementById("viewerRank");
    if (rankEl) rankEl.textContent = data.currentRank || "-";

    const commentEl = document.getElementById("viewerComment");
    if (commentEl) commentEl.textContent = data.publicComment || "";
  });
}

document.addEventListener("DOMContentLoaded", startViewer);

// =====================
// 表示用ユーティリティ
// =====================
const ALLOWED_PLUS = [0, 1, 2, 4, 6];
const RANKS = ["D","C1","C2","C3","B1","B2","B3","A1","A2","A3","A4","A5","S","SS"];

// もし publicStates に rankConfig を含めてなかったとしても、最低限動くように
// （必要ライブスコア計算機が動くためのデフォルト値）
const DEFAULT_RANK_CONFIG = {
  D:  { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 210,   4: 415,   6: 676   } },
  C1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 839,   4: 2225,  6: 6113  } },
  C2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 2270,  4: 5379,  6: 15100 } },
  C3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 5356,  4: 12700, 6: 19900 } },
  B1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 17300, 4: 37700, 6: 80500  } },
  B2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 15200, 4: 39400, 6: 110000 } },
  B3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 27600, 4: 66500, 6: 113000 } },
  A1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 54700, 4: 94700, 6: 198000 } },
  A2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 85000, 4: 126000,6: 276000 } },
  A3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 94900, 4: 183000,6: 379000 } },
  A4: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 119000,4: 220000,6: 517000 } },
  A5: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 159000,4: 356000,6: 651000 } },
  S:  { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 198000,4: 489000,6: 826000 } },
  SS: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 412000,4: 763000,6: 1260000} }
};

function formatNumber(n){
  if (n == null || isNaN(n)) return "-";
  return Number(n).toLocaleString("ja-JP");
}
function clamp(v,min,max){ return Math.min(max, Math.max(min,v)); }
function parseDate(str){
  const [y,m,d] = String(str).split("-").map(Number);
  return new Date(y, m-1, d);
}
function formatDateYMD(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function calcCoinsFromScore(score){
  return Math.ceil(Number(score) / 3);
}
function sanitizePlus(v){
  const n = Number(v);
  return ALLOWED_PLUS.includes(n) ? n : 0;
}

// =====================
// 公開データ → 表示用stateへ（安全に）
// =====================
let pub = null;

function getRankConfig(rank){
  // publicStates に rankConfig があるなら優先して使う
  const base = DEFAULT_RANK_CONFIG[rank] || DEFAULT_RANK_CONFIG["A1"];
  const overrideMap = (pub && pub.rankConfig) ? pub.rankConfig : {};
  const override = overrideMap[rank] || {};

  const plusScore = Object.assign({}, base.plusScore, override.plusScore || {});
  const plusCoins = {};
  [2,4,6].forEach(p=>{
    if (plusScore[p] != null) plusCoins[p] = calcCoinsFromScore(plusScore[p]);
  });

  return {
    upThreshold: override.upThreshold ?? base.upThreshold,
    keepThreshold: override.keepThreshold ?? base.keepThreshold,
    plusScore,
    plusCoins
  };
}

function calcPeriod(){
  const entries = Array.isArray(pub?.entries) ? pub.entries : [];
  const skipDays = Number(pub?.skipDays) || 0;

  if ((!entries.length) && !pub?.periodStart){
    return { startDate:null, endDate:null };
  }

  let startDate, endDate;
  if (pub?.periodStart){
    startDate = parseDate(pub.periodStart);
    endDate = new Date(startDate.getTime());
    endDate.setDate(endDate.getDate() + 6 + skipDays);
  } else if (entries.length){
    const sorted = [...entries].filter(e=>e?.date).sort((a,b)=> b.date.localeCompare(a.date));
    const baseEnd = parseDate(sorted[0].date);
    endDate = new Date(baseEnd.getTime());
    endDate.setDate(endDate.getDate() + skipDays);
    startDate = new Date(endDate.getTime());
    startDate.setDate(startDate.getDate() - 6);
  }
  return { startDate, endDate };
}

function calcActualSummary(){
  const entries = Array.isArray(pub?.entries) ? pub.entries : [];
  const { startDate, endDate } = calcPeriod();
  if (!startDate || !endDate){
    return { sumPlus:0, daily:{}, startDate:null, endDate:null };
  }

  const daily = {};
  let sumPlus = 0;

  for (const e of entries){
    if (!e?.date) continue;
    const d = parseDate(e.date);
    if (d < startDate || d > endDate) continue;
    const key = formatDateYMD(d);
    const plus = Number(e.drp) || 0;
    sumPlus += plus;
    if (!daily[key]) daily[key] = { plus:0 };
    daily[key].plus += plus;
  }
  return { sumPlus, daily, startDate, endDate };
}

function buildCalendarInfo(){
  const { startDate, endDate } = calcPeriod();
  if (!startDate || !endDate) return null;

  const dates = [];
  let d = new Date(startDate.getTime());
  while (d <= endDate){
    dates.push(formatDateYMD(d));
    d.setDate(d.getDate()+1);
  }

  const skipSet = new Set();
  const rawSkipDates = (pub?.skipDates || []).slice(0, pub?.skipDays || 0);
  rawSkipDates.forEach(raw => {
    if (!raw) return;
    if (raw >= dates[0] && raw <= dates[dates.length - 1]) {
      skipSet.add(raw);
    }
  });

  const activeDatesAll = dates.filter(ds => !skipSet.has(ds));
  const activeDates = activeDatesAll.slice(0, 7);

  const activeDateToIndex = {};
  activeDates.forEach((ds, idx) => {
    activeDateToIndex[ds] = idx;
  });

  return { startDate, endDate, dates, skipSet, activeDateToIndex };
}

// =====================
// UI更新
// =====================
function setText(id, text){
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderTop(){
  const rank = pub?.currentRank || "A1";
  const goalType = pub?.goalType || "UP";

  setText("rankBadge", `現在ランク: ${rank}`);
  setText("goalBadge", `目標: ${goalType === "UP" ? "ランクアップ狙い" : "ランクキープ狙い"}`);
  setText("calcRank", rank);

  const c = pub?.publicComment || pub?.comment || pub?.latestComment || "";
  const updated =
    pub?.commentUpdatedAt ||
    pub?.publicUpdatedAt ||
    pub?.updatedAt ||
    null;

  setText("latestComment", c ? c : "（コメントはまだありません）");

  if (updated){
    // Firestore Timestampにも対応
    let d = null;
    if (updated?.toDate) d = updated.toDate();
    else d = new Date(updated);
    if (!isNaN(d.getTime())){
      setText("commentUpdatedAt", `更新: ${d.toLocaleString("ja-JP")}`);
    } else {
      setText("commentUpdatedAt", "");
    }
  } else {
    setText("commentUpdatedAt", "");
  }
}

function renderSummary(){
  const rank = pub?.currentRank || "A1";
  const cfg = getRankConfig(rank);
  const targetPlus = (pub?.goalType || "UP") === "UP" ? cfg.upThreshold : cfg.keepThreshold;

  const { sumPlus, daily, startDate, endDate } = calcActualSummary();

  setText("sum7", sumPlus);

  const needUp = Math.max(0, cfg.upThreshold - sumPlus);
  const needKeep = Math.max(0, cfg.keepThreshold - sumPlus);
  setText("needUp", needUp);
  setText("needKeep", needKeep);

  const periodLabel = (startDate && endDate)
    ? `期間: ${formatDateYMD(startDate)} 〜 ${formatDateYMD(endDate)}`
    : "期間: -";
  setText("periodLabel", periodLabel);

  // 判定（ざっくり）
  const statusEl = document.getElementById("statusLabel");
  if (statusEl){
    statusEl.className = "status";
    let label = "データ不足";
    if (startDate && endDate){
      if (sumPlus >= cfg.upThreshold) { label = "UP確定圏"; statusEl.classList.add("up"); }
      else if (sumPlus >= cfg.keepThreshold) { label = "KEEP圏"; statusEl.classList.add("keep"); }
      else { label = "DOWN注意"; statusEl.classList.add("down"); }
    }
    statusEl.textContent = label;
  }

  const progressBar = document.getElementById("progressBar");
  if (progressBar){
    const p = clamp(targetPlus > 0 ? (sumPlus / targetPlus) : 0, 0, 1) * 100;
    progressBar.style.width = `${p}%`;
  }

  // 今日ヒント（軽め）
  const todayHint = document.getElementById("todayHint");
  if (todayHint){
    if (!startDate || !endDate){
      todayHint.textContent = "開始日未設定でもOK。データが入ると自動で週判定します。";
    } else {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const t = formatDateYMD(today);
      const actualToday = daily[t]?.plus || 0;
      todayHint.textContent = `今日(${t})の実績: ＋${actualToday}`;
    }
  }
}

function renderPlanTable(){
  const tbody = document.getElementById("planBody");
  if (!tbody) return;

  const cal = buildCalendarInfo();
  const planDays = Array.isArray(pub?.plan?.days) ? pub.plan.days : [];
  const { daily, startDate, endDate } = calcActualSummary();

  // 期間未確定ならそれっぽい表示
  if (!cal || !cal.dates.length){
    tbody.innerHTML = `<tr><td colspan="4" class="muted">期間が未設定 or 実績がありません（管理側で開始日を入れるか、実績が入ると表示されます）</td></tr>`;
    setText("planFoot", "※表示できるデータが揃うと自動更新されます");
    return;
  }

  const { dates, skipSet, activeDateToIndex } = cal;
  const rows = [];

  // 期間が 7+skip になっている場合もあるので、見せたいのは全日付でOK（差分も出す）
  dates.forEach((ds, idx) => {
    const planIdx = activeDateToIndex[ds];
    const planned = (planIdx != null && planDays[planIdx]) ? Number(planDays[planIdx].plannedPlus || 0) : 0;
    const actual = daily[ds]?.plus || 0;
    const diff = actual - planned;

    const diffText = diff === 0 ? "±0" : (diff > 0 ? `+${diff}` : `${diff}`);
    rows.push(`
      <tr>
        <td>${ds}</td>
        <td class="r">＋${sanitizePlus(planned)}</td>
        <td class="r">＋${sanitizePlus(actual)}</td>
        <td class="r">${diffText}</td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join("");

  if (startDate && endDate){
    setText("planFoot", `※ ${formatDateYMD(startDate)}〜${formatDateYMD(endDate)} の一覧です（スキップ日がある場合は日数が増えます）`);
  } else {
    setText("planFoot", "※データに応じて自動更新されます");
  }
}

function updateCalculator(){
  const plusSelect = document.getElementById("plusSelect");
  const currentScore = document.getElementById("currentScore");
  if (!plusSelect || !currentScore) return;

  const rank = pub?.currentRank || "A1";
  const cfg = getRankConfig(rank);

  const p = Number(plusSelect.value) || 2;
  const target = cfg?.plusScore?.[p];

  if (!target){
    setText("targetScore","-");
    setText("remainScore","-");
    setText("needCoins","-");
    return;
  }

  setText("targetScore", formatNumber(target));

  const cur = Number(currentScore.value) || 0;
  let remain = target - cur;
  if (remain < 0) remain = 0;
  setText("remainScore", formatNumber(remain));

  // 差分÷3 → 10単位切上げ
  const baseCoins = remain > 0 ? Math.ceil(remain / 3) : 0;
  const need = baseCoins > 0 ? Math.ceil(baseCoins / 10) * 10 : 0;
  setText("needCoins", need ? `${formatNumber(need)} コイン` : "0 コイン");
}

function bindCalculatorEvents(){
  const plusSelect = document.getElementById("plusSelect");
  const currentScore = document.getElementById("currentScore");
  if (plusSelect) plusSelect.addEventListener("change", updateCalculator);
  if (currentScore) currentScore.addEventListener("input", updateCalculator);
}

// =====================
// Firestore購読
// =====================
function renderAll(){
  renderTop();
  renderSummary();
  renderPlanTable();
  updateCalculator();
}

function init(){
  bindCalculatorEvents();

  publicDocRef.onSnapshot((snap)=>{
    if (!snap.exists){
      pub = {};
      setText("latestComment", "（公開データがまだありません）");
      renderAll();
      return;
    }
    pub = snap.data() || {};
    renderAll();
  }, (err)=>{
    console.error("viewer Firestore read error:", err?.code, err?.message, err);
    setText("latestComment", "読み込みに失敗しました（通信 or ルール確認）");
  });
}

document.addEventListener("DOMContentLoaded", init);
