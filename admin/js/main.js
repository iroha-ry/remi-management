// =====================
// remi-management admin main.js (single file)
// IMPORTANT: admin/index.html must load firebase-auth-compat.js
//   <script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js"></script>
// =====================

// --- auth helpers (replaces auth.js module) ---
function signInWithEmailPass(email, pass) {
  if (!email || !pass) return Promise.reject(new Error("email/pass required"));
  if (!window.firebase || !firebase.auth) return Promise.reject(new Error("firebase auth SDK missing"));
  return firebase.auth().signInWithEmailAndPassword(email, pass);
}

function setupAuth({ onLoggedIn, onLoggedOut } = {}) {
  if (!window.firebase || !firebase.auth) {
    console.error("Firebase Auth が読み込まれていません。firebase-auth-compat.js を追加してください。");
    if (typeof onLoggedOut === "function") onLoggedOut();
    return;
  }
  const auth = firebase.auth();
  auth.onAuthStateChanged(
    (user) => {
      if (user) {
        if (typeof onLoggedIn === "function") onLoggedIn(user);
      } else {
        if (typeof onLoggedOut === "function") onLoggedOut();
      }
    },
    (err) => {
      console.error("onAuthStateChanged error:", err);
      if (typeof onLoggedOut === "function") onLoggedOut();
    }
  );
}

// --- publish helper (replaces public.js module) ---
async function publishPublic({ state, calcPublicSnapshot, comment }) {
  if (!window.publicDocRef) throw new Error("publicDocRef is not defined");
  if (typeof calcPublicSnapshot !== "function") throw new Error("calcPublicSnapshot is not a function");

  const payload = calcPublicSnapshot(state, String(comment ?? "").trim());
  payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

  // 公開用ドキュメント更新
  await publicDocRef.set(payload, { merge: true });
  return payload;
}

// =====================
// Firebase 初期化
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
const auth = firebase.auth();


// 公開用
const publicDocRef = db.collection("publicStates").doc("main");

function showLogin() {
  const lv = document.getElementById("loginView");
  const av = document.getElementById("adminApp");
  if (lv) lv.style.display = "block";
  if (av) av.style.display = "none";
}

function showAdmin() {
  const lv = document.getElementById("loginView");
  const av = document.getElementById("adminApp");
  if (lv) lv.style.display = "none";
  if (av) av.style.display = "block";
}

function setupLoginUI() {
  const btn = document.getElementById("loginBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const email = (document.getElementById("loginEmail")?.value || "").trim();
    const pass  = (document.getElementById("loginPass")?.value || "").trim();
    const errEl = document.getElementById("loginError");

    if (errEl) errEl.textContent = "";

    if (!email || !pass) {
      if (errEl) errEl.textContent = "メールとパスワードを入力してください。";
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      // 成功したら onAuthStateChanged 側が動くので、ここでは何もしない
    } catch (e) {
      console.error("login failed:", e);
      if (errEl) errEl.textContent = "ログインに失敗しました（メール/パスを確認）";
    }
  });
}

function setupPublicComment() {
  const input = document.getElementById("publicCommentInput");
  const btn = document.getElementById("savePublicCommentBtn");
  if (!input || !btn) return;

  input.value = state.publicComment || "";

  btn.addEventListener("click", async () => {
    state.publicComment = (input.value || "").trim();
    await saveState();   // ← admin + public 両方更新される
    alert("公開コメントを更新しました！");
  });
}


let booted = false; // 二重初期化防止

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    stateDocRef = null;
    firestoreLoaded = false;
    showLogin();
    setupLoginUI(); // ログイン画面表示時にボタンを有効化
    return;
  }

  // ★ ログインできたので admin側の保存先を uid で確定
  // 推奨パス: /adminStates/{uid}/state/main
  stateDocRef = db.collection("adminStates").doc(user.uid).collection("state").doc("main");

  showAdmin();

  // 初回だけフル初期化（render関数やイベント登録）
  if (!booted) {
    booted = true;

    // ここはあなたの既存初期化関数を呼ぶ
    // ※ loadStateFromFirestore() は stateDocRef を使うので、この後で呼ぶこと
    initRankSelect();
    setupForm();
    setupSettings();
    setupClearAll();
    setupPlanControls();
    setupLiveCalculator();
    setupHaneCounter();
    startMidnightWatcher();
  }

  // ★ ログイン後にロード
  await loadStateFromFirestore();

  ensurePrevDayAutoPlus1();
  updateAll();
});

// 1日に取りうる＋値
const ALLOWED_PLUS = [0, 1, 2, 4, 6];

// =====================
// ランク定義 & 設定
// =====================

const RANKS = ["D", "C1", "C2", "C3", "B1", "B2", "B3", "A1", "A2", "A3", "A4", "A5", "S", "SS"];

const DEFAULT_RANK_CONFIG = {
  D:  { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 189,    4: 453,    6: 743    } },
  C1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 927,    4: 2428,   6: 6685   } },
  C2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 2488,   4: 5678,   6: 16700  } },
  C3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 5892,   4: 12800,  6: 22000  } },

  B1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 17600,  4: 37600,  6: 84500  } },
  B2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 16800,  4: 42200,  6: 114000 } },
  B3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 28100,  4: 71100,  6: 115000 } },

  A1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 60100,  4: 99200,  6: 201000 } },
  A2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 83700,  4: 127000, 6: 297000 } },
  A3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 102000, 4: 192000, 6: 384000 } },
  A4: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 129000, 4: 238000, 6: 501000 } },
  A5: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 156000, 4: 385000, 6: 606000 } },

  S:  { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 219000, 4: 541000, 6: 770000 } },
  SS: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 431000, 4: 783000, 6: 1220000} }
};



function calcCoinsFromScore(score) {
  // 目安コイン = ceil(score/3)
  return Math.ceil(Number(score) / 3);
}

function getRankConfig(rank) {
  const base = DEFAULT_RANK_CONFIG[rank] || DEFAULT_RANK_CONFIG["A1"];
  const overrideMap = state.rankConfig || {};
  const override = overrideMap[rank] || {};

  const plusScore = Object.assign({}, base.plusScore, override.plusScore || {});
  const plusCoins = {};

  // +2/+4/+6 の分だけ自動生成（他は不要）
  [2, 4, 6].forEach(p => {
    if (plusScore[p] != null) plusCoins[p] = calcCoinsFromScore(plusScore[p]);
  });

  return {
    upThreshold: override.upThreshold ?? base.upThreshold,
    keepThreshold: override.keepThreshold ?? base.keepThreshold,
    plusScore,
    plusCoins
  };
}


// =====================
// 状態
// =====================

let firestoreLoaded = false; 

const DEFAULT_STATE = {
  currentRank: "A1",
  goalType: "UP",
  coinsPerPoint: 0,     // 互換用。今は使わない。
  skipDays: 0,
  periodStart: null,
  skipDates: [],        // スキップカードを使う日（任意）
  rankConfig: {},
  plan: {
    days: []            // {offset, plannedPlus, memo}
  },
  autoPlus1PrevDay: false,
  lastPrevAutoFillYMD: null,
  entries: []           // {id, date, drp, coins, hours, memo}
  
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

function normalizePlan() {
  if (!state.plan || !Array.isArray(state.plan.days)) {
    state.plan = { days: [] };
  }
  const days = [];
  for (let i = 0; i < 7; i++) {
    let existing =
      state.plan.days.find(d => d && d.offset === i) || state.plan.days[i];
    const plannedPlus =
      existing && typeof existing.plannedPlus === "number"
        ? existing.plannedPlus
        : 0;
    const memo =
      existing && typeof existing.memo === "string" ? existing.memo : "";
    days.push({ offset: i, plannedPlus, memo });
  }
  state.plan.days = days;
}

function normalizeState() {
  if (!state.goalType) state.goalType = "UP";
  if (typeof state.skipDays !== "number") state.skipDays = 0;
  if (!Array.isArray(state.skipDates)) state.skipDates = [];
  if (!state.plan) state.plan = { days: [] };
  if (!Array.isArray(state.entries)) state.entries = [];
  if (typeof state.autoPlus1PrevDay !== "boolean") {
    state.autoPlus1PrevDay = false;
  }
  if (typeof state.lastPrevAutoFillYMD !== "string") {
    state.lastPrevAutoFillYMD = null;
  }
  
  
  normalizePlan();
}

async function loadStateFromFirestore() {
  firestoreLoaded = false;  // 毎回リセット

  try {
    const snap = await stateDocRef.get();
    if (snap.exists) {
      const data = snap.data();
      state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), data || {});
      normalizeState();
    } else {
      // 本当にドキュメントが存在しない初回だけ、ここで初期化＆保存
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      normalizeState();
      await stateDocRef.set(state);
    }
    firestoreLoaded = true;
  } catch (e) {
    console.error("Firestore 読み込み失敗:", e?.code, e?.message, e);
  }
}


function buildPublicPayload() {
  return {
    updatedAt: new Date().toISOString(),

    // リスナーに見せたいものだけ
    currentRank: state.currentRank,
    goalType: state.goalType,
    skipDays: state.skipDays,
    periodStart: state.periodStart,
    skipDates: state.skipDates || [],
    plan: state.plan || { days: [] },
    entries: state.entries || [],

    // 最新コメント（管理画面で更新する想定）
    publicComment: state.publicComment || "",

    // 必要なら公開（計算機で使うカスタム上書き）
    rankConfig: state.rankConfig || {}
  };
}

function saveState() {
  if (!stateDocRef) return Promise.resolve();

  // ★ Firestore読み込みに成功してなければ保存しない
  if (!firestoreLoaded) {
    console.warn("Firestore未読み込みのため saveState をスキップ");
    return Promise.resolve();
  }

  normalizeState();

  // ① 管理用(adminStates)へ保存
  return stateDocRef
    .set(state, { merge: true })
    .then(() => {
      console.log("Firestore(admin) 保存OK");

      // ② 公開用(publicStates)へも保存（ログイン中のみ許可されるルールなのでOK）
      const pub = buildPublicPayload();
      return publicDocRef.set(pub, { merge: true });
    })
    .then(() => {
      console.log("Firestore(public) 更新OK");
    })
    .catch(err => {
      console.error("Firestore 保存失敗:", err?.code, err?.message, err);
      // ★ここで throw すると今までの挙動が変わるので、基本は握りつぶしでOK
      // throw err;
    });
}


let haneTimerId = null;

function startHaneCounter() {
  const el = document.getElementById("haneSecondDisplay");
  if (!el) return;

  if (haneTimerId) {
    clearInterval(haneTimerId);
    haneTimerId = null;
  }

  const update = () => {
    const now = new Date();
    const sec = now.getSeconds();       // 0〜59（実際の秒）
    const remaining = 59 - sec;         // 59→0 のカウントダウン表示

    const text = String(remaining).padStart(2, "0");
    el.textContent = text;

    // 最後の10秒（09〜00）のときだけ大きく光らせる
    if (remaining <= 9) {
      el.classList.add("hane-boost");
    } else {
      el.classList.remove("hane-boost");
    }
  };

  update();
  haneTimerId = setInterval(update, 1000);
}


function setupHaneCounter() {
  startHaneCounter();
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

function pickRealisticPlus(targetPerDay) {
  for (const v of ALLOWED_PLUS) {
    if (v >= targetPerDay) return v;
  }
  return 6;
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

function sanitizePlus(v) {
  const n = Number(v);
  return ALLOWED_PLUS.includes(n) ? n : 0;
}

function genEntryId(dateStr) {
  return `${dateStr}_${Date.now()}`;
}

function findEntryIndexByDate(dateStr) {
  return (state.entries || []).findIndex(e => e && e.date === dateStr);
}

// 同じdateがあれば上書き、なければ追加
function upsertEntryByDate(dateStr, patch) {
  if (!Array.isArray(state.entries)) state.entries = [];

  const idx = findEntryIndexByDate(dateStr);

  if (idx >= 0) {
    state.entries[idx] = {
      ...state.entries[idx],
      ...patch,
      date: dateStr,
      id: state.entries[idx].id || genEntryId(dateStr)
    };
  } else {
    state.entries.push({
      id: genEntryId(dateStr),
      date: dateStr,
      drp: 0,
      coins: 0,
      hours: "",
      memo: "",
      ...patch
    });
  }
}



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
    tdDrp.textContent = `＋${entry.drp}`;

    const tdCoins = document.createElement("td");
    tdCoins.className = "text-right";
    if (entry.coins) {
      const span = document.createElement("span");
      span.className = "coin-text";
      span.textContent = `${formatNumber(entry.coins)} コイン`;
      tdCoins.appendChild(span);
    } else {
      tdCoins.textContent = "-";
    }

    const tdMemo = document.createElement("td");
    const texts = [];
    if (entry.hours) texts.push(`[時間] ${entry.hours}`);
    if (entry.memo) texts.push(entry.memo);
    tdMemo.textContent = texts.join(" / ") || "-";

    const tdActions = document.createElement("td");
    tdActions.className = "text-right";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-sm";
    editBtn.type = "button";
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", () => {
      enterEntryEditMode(tr, entry);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn-sm danger";
    delBtn.type = "button";
    delBtn.textContent = "削除";
    delBtn.style.marginLeft = "6px";
    delBtn.addEventListener("click", () => {
    if (!confirm(`${entry.date} のデータを削除しますか？`)) return;
      state.entries = state.entries.filter(e => e.id !== entry.id);
      saveState();
      updateAll();
    });

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);


    tr.appendChild(tdDate);
    tr.appendChild(tdDrp);
    tr.appendChild(tdCoins);
    tr.appendChild(tdMemo);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  }
}

function enterEntryEditMode(tr, entry) {
  tr.innerHTML = "";

  // 日付
  const tdDate = document.createElement("td");
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = entry.date || "";
  tdDate.appendChild(dateInput);

  // ＋
  const tdDrp = document.createElement("td");
  tdDrp.className = "text-right";
  const drpSelect = document.createElement("select");
  [1, 2, 4, 6].forEach(p => {
    const opt = document.createElement("option");
    opt.value = String(p);
    opt.textContent = `＋${p}`;
    if (Number(entry.drp) === p) opt.selected = true;
    drpSelect.appendChild(opt);
  });
  tdDrp.appendChild(drpSelect);

  // コイン
  const tdCoins = document.createElement("td");
  tdCoins.className = "text-right";
  const coinsInput = document.createElement("input");
  coinsInput.type = "number";
  coinsInput.min = "0";
  coinsInput.placeholder = "コイン";
  coinsInput.value = entry.coins ? String(entry.coins) : "";
  coinsInput.style.maxWidth = "140px";
  tdCoins.appendChild(coinsInput);

  // メモ
  const tdMemo = document.createElement("td");
  const memoInput = document.createElement("input");
  memoInput.type = "text";
  memoInput.placeholder = "時間/メモ";
  const texts = [];
  if (entry.hours) texts.push(entry.hours);
  if (entry.memo) texts.push(entry.memo);
  memoInput.value = texts.join(" / ");
  tdMemo.appendChild(memoInput);

  // 操作
  const tdActions = document.createElement("td");
  tdActions.className = "text-right";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-sm";
  saveBtn.type = "button";
  saveBtn.textContent = "保存";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-sm";
  cancelBtn.type = "button";
  cancelBtn.textContent = "取消";
  cancelBtn.style.marginLeft = "6px";

  saveBtn.addEventListener("click", () => {
    const newDate = dateInput.value;
    const newDrp = sanitizePlus(drpSelect.value);
    const newCoins = coinsInput.value ? Number(coinsInput.value) : 0;

    // hoursとmemoは簡易的にまとめ入力扱いでもOK
    const mergedMemo = memoInput.value.trim();

    // 同日統合（date基準で1本化運用）
    // いったん元idレコードを除外
    state.entries = (state.entries || []).filter(e => e.id !== entry.id);

    upsertEntryByDate(newDate, {
      drp: newDrp,
      coins: newCoins,
      hours: "",        // 必要なら分けてUI作る
      memo: mergedMemo
    });

    saveState();
    updateAll();
  });

  cancelBtn.addEventListener("click", () => updateAll());

  tdActions.appendChild(saveBtn);
  tdActions.appendChild(cancelBtn);

  tr.appendChild(tdDate);
  tr.appendChild(tdDrp);
  tr.appendChild(tdCoins);
  tr.appendChild(tdMemo);
  tr.appendChild(tdActions);
}


function renderSkipDateInputs() {
  const container = document.getElementById("skipDatesContainer");
  if (!container) return;
  container.innerHTML = "";

  const n = Number(state.skipDays) || 0;
  if (n <= 0) {
    // ★ skipDays=0 のときは内部もリセット
    state.skipDates = [];

    const p = document.createElement("div");
    p.className = "text-small muted";
    p.textContent = "スキップカードを使わない週です。";
    container.appendChild(p);
    return;
  }

  for (let i = 0; i < n; i++) {
    const row = document.createElement("div");
    row.className = "skip-dates-row";

    const label = document.createElement("span");
    label.className = "text-small";
    label.textContent = `スキップ${i + 1}枚目：`;

    const input = document.createElement("input");
    input.type = "date";
    input.dataset.index = String(i);
    input.value = state.skipDates?.[i] || "";

    // モバイル/PC両方でタップしたらカレンダー出しやすく
    if (input.showPicker) {
      input.addEventListener("focus", () => {
        input.showPicker();
      });
    }

    input.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.index);
      if (!state.skipDates) state.skipDates = [];
      state.skipDates[idx] = e.target.value || null;
      saveState();
    });

    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  }
}


function renderPlan() {
  const tbody = document.getElementById("planTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  normalizePlan();

  const cal = buildCalendarInfo();
  const cfg = getRankConfig(state.currentRank);

  if (!cal) {
    // 期間未設定時は「Day1〜Day7」で7行だけ出す
    for (let i = 0; i < 7; i++) {
      const day = state.plan.days[i];
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = `Day ${i + 1}`;

      const tdPlus = document.createElement("td");
      const select = document.createElement("select");
      select.dataset.planIndex = String(i);
      for (const v of ALLOWED_PLUS) {
        const opt = document.createElement("option");
        opt.value = String(v);
        opt.textContent = v === 0 ? "休み（＋0）" : `＋${v}`;
        select.appendChild(opt);
      }
      const currentVal = ALLOWED_PLUS.includes(Number(day.plannedPlus))
        ? String(day.plannedPlus)
        : "0";
      select.value = currentVal;
      select.addEventListener("change", e => {
        const idx = Number(e.target.dataset.planIndex);
        let v = Number(e.target.value);
        if (!ALLOWED_PLUS.includes(v)) v = 0;
        state.plan.days[idx].plannedPlus = v;
        saveState();
        updateAll();
      });
      tdPlus.appendChild(select);

      const tdCoins = document.createElement("td");
      tdCoins.className = "text-right";
      const plus = Number(currentVal);
      if (plus > 1 && cfg.plusCoins && cfg.plusCoins[plus] != null) {
        const span = document.createElement("span");
        span.className = "coin-text";
        span.textContent = `${formatNumber(cfg.plusCoins[plus])} コイン`;
        tdCoins.appendChild(span);
      } else if (plus === 1) {
        tdCoins.textContent = "配信ONで＋1";
      } else {
        tdCoins.textContent = "-";
      }

      const tdMemo = document.createElement("td");
      const memoInput = document.createElement("input");
      memoInput.type = "text";
      memoInput.placeholder = "メモ";
      memoInput.value = day.memo || "";
      memoInput.dataset.planIndex = String(i);
      memoInput.addEventListener("input", e => {
        const idx = Number(e.target.dataset.planIndex);
        state.plan.days[idx].memo = e.target.value;
        saveState();
      });
      tdMemo.appendChild(memoInput);

      tr.appendChild(tdDate);
      tr.appendChild(tdPlus);
      tr.appendChild(tdCoins);
      tr.appendChild(tdMemo);

      tbody.appendChild(tr);
    }

    // 合計など
    const { planTotal } = calcPlanSummary();
    const planTotalPlusEl = document.getElementById("planTotalPlus");
    const planMarginPlusEl = document.getElementById("planMarginPlus");
    const goalTypeLabel = document.getElementById("goalTypeLabel");
    const targetPlusLabel = document.getElementById("targetPlusLabel");
    const cfg2 = getRankConfig(state.currentRank);
    const targetPlus =
      state.goalType === "UP" ? cfg2.upThreshold : cfg2.keepThreshold;

    if (planTotalPlusEl) planTotalPlusEl.textContent = planTotal;
    if (goalTypeLabel)
      goalTypeLabel.textContent =
        state.goalType === "UP" ? "ランクアップ狙い" : "ランクキープ狙い";
    if (targetPlusLabel) targetPlusLabel.textContent = targetPlus;

    if (planMarginPlusEl) {
      const diff = planTotal - targetPlus;
      let text;
      if (diff === 0) text = "目標ぴったり";
      else if (diff > 0) text = `目標より +${diff}pt（余裕あり）`;
      else text = `目標まであと ${-diff}pt`;
      planMarginPlusEl.textContent = text;
    }
    return;
  }

  // ここから「期間＋スキップ日」あり
  const { dates, skipSet, activeDateToIndex } = cal;

  let planIdxMax = state.plan.days.length; // ふつうは7
  let usedPlanIdx = 0;

  for (const ds of dates) {
    const tr = document.createElement("tr");

    // 日付
    const tdDate = document.createElement("td");
    tdDate.textContent = ds;

    const tdPlus = document.createElement("td");
    const tdCoins = document.createElement("td");
    tdCoins.className = "text-right";
    const tdMemo = document.createElement("td");

    if (skipSet.has(ds)) {
      // スキップ日
      const label = document.createElement("span");
      label.textContent = "スキップ日（＋0固定）";
      tdPlus.appendChild(label);

      tdCoins.textContent = "-";

      const memo = document.createElement("span");
      memo.className = "text-small muted";
      memo.textContent = "スキップカード分の自動付与日";
      tdMemo.appendChild(memo);
    } else {
      // 非スキップ日 → 計画7日のうちのどこか
      const planIdx = activeDateToIndex[ds];
      const day = state.plan.days[planIdx] || { plannedPlus: 0, memo: "" };

      const select = document.createElement("select");
      select.dataset.planIndex = String(planIdx);
      for (const v of ALLOWED_PLUS) {
        const opt = document.createElement("option");
        opt.value = String(v);
        opt.textContent = v === 0 ? "休み（＋0）" : `＋${v}`;
        select.appendChild(opt);
      }
      const currentVal = ALLOWED_PLUS.includes(Number(day.plannedPlus))
        ? String(day.plannedPlus)
        : "0";
      select.value = currentVal;
      select.addEventListener("change", e => {
        const idx = Number(e.target.dataset.planIndex);
        let v = Number(e.target.value);
        if (!ALLOWED_PLUS.includes(v)) v = 0;
        state.plan.days[idx].plannedPlus = v;
        updateAll();
      });
      tdPlus.appendChild(select);

      const plus = Number(currentVal);
      if (plus > 1 && cfg.plusCoins && cfg.plusCoins[plus] != null) {
        const span = document.createElement("span");
        span.className = "coin-text";
        span.textContent = `${formatNumber(cfg.plusCoins[plus])} コイン`;
        tdCoins.appendChild(span);
      } else if (plus === 1) {
        tdCoins.textContent = "配信ONで＋1";
      } else {
        tdCoins.textContent = "-";
      }

      const memoInput = document.createElement("input");
      memoInput.type = "text";
      memoInput.placeholder = "メモ";
      memoInput.value = day.memo || "";
      memoInput.dataset.planIndex = String(planIdx);
      memoInput.addEventListener("input", e => {
        const idx = Number(e.target.dataset.planIndex);
        state.plan.days[idx].memo = e.target.value;
        saveState();
      });
      tdMemo.appendChild(memoInput);
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdPlus);
    tr.appendChild(tdCoins);
    tr.appendChild(tdMemo);

    tbody.appendChild(tr);
  }

  // 合計など（ここは今まで通り 7日分の合計）
  const { planTotal } = calcPlanSummary();
  const planTotalPlusEl = document.getElementById("planTotalPlus");
  const planMarginPlusEl = document.getElementById("planMarginPlus");
  const goalTypeLabel = document.getElementById("goalTypeLabel");
  const targetPlusLabel = document.getElementById("targetPlusLabel");
  const cfg2 = getRankConfig(state.currentRank);
  const targetPlus =
    state.goalType === "UP" ? cfg2.upThreshold : cfg2.keepThreshold;

  if (planTotalPlusEl) planTotalPlusEl.textContent = planTotal;
  if (goalTypeLabel)
    goalTypeLabel.textContent =
      state.goalType === "UP" ? "ランクアップ狙い" : "ランクキープ狙い";
  if (targetPlusLabel) targetPlusLabel.textContent = targetPlus;

  if (planMarginPlusEl) {
    const diff = planTotal - targetPlus;
    let text;
    if (diff === 0) text = "目標ぴったり";
    else if (diff > 0) text = `目標より +${diff}pt（余裕あり）`;
    else text = `目標まであと ${-diff}pt`;
    planMarginPlusEl.textContent = text;
  }
}

function renderDashboard() {
  const sum7El = document.getElementById("sum7");
  const needUpPointsEl = document.getElementById("needUpPoints");
  const needKeepPointsEl = document.getElementById("needKeepPoints");
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
  const cfg = getRankConfig(rank);

  const rankIndex = RANKS.indexOf(rank);
  const nextRank =
    rankIndex >= 0 && rankIndex < RANKS.length - 1
      ? RANKS[rankIndex + 1]
      : null;
  const prevRank = rankIndex > 0 ? RANKS[rankIndex - 1] : null;

  if (nextRankLabel)
    nextRankLabel.textContent = nextRank || "これ以上はありません（最上位）";
  if (prevRankLabel)
    prevRankLabel.textContent = prevRank || "これ以上はありません（最下位）";

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

  const { sumPlus, daily, startDate, endDate } = calcActualSummary();

  if (sum7El) sum7El.textContent = sumPlus;
  if (periodStartLabel)
    periodStartLabel.textContent = startDate ? formatDateYMD(startDate) : "-";
  if (periodEndLabel)
    periodEndLabel.textContent = endDate ? formatDateYMD(endDate) : "-";

  const UP_THRESHOLD = cfg.upThreshold;
  const KEEP_THRESHOLD = cfg.keepThreshold;

  if (upConditionLabel)
    upConditionLabel.textContent = `ランクアップ条件（${UP_THRESHOLD}pt以上）`;
  if (keepConditionLabel)
    keepConditionLabel.textContent = `キープ条件（${KEEP_THRESHOLD}pt以上）`;
  if (chipUpThreshold) chipUpThreshold.textContent = UP_THRESHOLD;
  if (chipKeepThreshold) chipKeepThreshold.textContent = KEEP_THRESHOLD;
  if (chipDownThreshold) chipDownThreshold.textContent = KEEP_THRESHOLD - 1;

  const needUpPoints = Math.max(0, UP_THRESHOLD - sumPlus);
  const needKeepPoints = Math.max(0, KEEP_THRESHOLD - sumPlus);
  const safeMargin =
    sumPlus === 0 && state.entries.length === 0
      ? "-"
      : sumPlus <= KEEP_THRESHOLD - 1
      ? `あと ${(KEEP_THRESHOLD - 1) - sumPlus + 1} pt でダウン域`
      : `${sumPlus - (KEEP_THRESHOLD - 1)} pt`;

  if (needUpPointsEl) needUpPointsEl.textContent = needUpPoints;
  if (needKeepPointsEl) needKeepPointsEl.textContent = needKeepPoints;
  if (safeMarginPointsEl) safeMarginPointsEl.textContent = safeMargin;

  if (progressBar) {
    const goalMax =
      state.goalType === "UP" ? UP_THRESHOLD : KEEP_THRESHOLD;
    const progress = clamp(
      goalMax > 0 ? sumPlus / goalMax : 0,
      0,
      1
    ) * 100;
    progressBar.style.width = `${progress}%`;
  }
  

  // 今日の目安（計画・スキップ日とリンク）
  if (todayTargetPtEl && todayTargetCoinsEl) {
    if (!startDate || !endDate) {
      todayTargetPtEl.textContent = "期間が未設定 or 実績がありません";
      todayTargetCoinsEl.textContent = "-";
    } else {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayStr = formatDateYMD(today);

      if (today < startDate || today > endDate) {
        todayTargetPtEl.textContent = "今日の日付はこの週の期間外です";
        todayTargetCoinsEl.textContent = "-";
      } else {
        const cal = buildCalendarInfo();
        const { skipSet, activeDateToIndex, dates } = cal;

        const targetPlus =
          state.goalType === "UP" ? UP_THRESHOLD : KEEP_THRESHOLD;
        const remainingWeek = targetPlus - sumPlus;

        if (skipSet.has(todayStr)) {
          // スキップ日
          todayTargetPtEl.textContent = "今日はスキップ日（＋0固定）です。";
          if (remainingWeek > 0) {
            todayTargetCoinsEl.textContent = `週目標までは残り ${remainingWeek}pt。非スキップ日に上乗せして調整しましょう。`;
          } else {
            todayTargetCoinsEl.textContent = "週目標はすでに達成済みです。";
          }
        } else {
          // 非スキップ日 → 7日計画のどこか
          const planIdx = activeDateToIndex[todayStr];
          const planPlusToday =
            planIdx != null ? Number(state.plan.days[planIdx].plannedPlus) || 0 : 0;
          const actualToday = daily[todayStr]?.plus || 0;

          if (planPlusToday > 0) {
            if (actualToday >= planPlusToday) {
              todayTargetPtEl.textContent = `今日の目標 ＋${planPlusToday} は達成済み（実績 ＋${actualToday}）`;
              if (remainingWeek > 0) {
                todayTargetCoinsEl.textContent = `週目標までは残り ${remainingWeek}pt。明日以降の計画で調整しましょう。`;
              } else {
                todayTargetCoinsEl.textContent = "週目標も達成済みです。";
              }
            } else {
              const diff = planPlusToday - actualToday;
              todayTargetPtEl.textContent = `今日の目標: ＋${planPlusToday}（現在 ＋${actualToday} → あと ＋${diff} 欲しい）`;
              const ps = cfg.plusScore || {};
              const pc = cfg.plusCoins || {};
              if (planPlusToday > 1 && ps[planPlusToday] != null && pc[planPlusToday] != null) {
                todayTargetCoinsEl.textContent =
                  `この日の目標に必要な最低スコア目安: ${formatNumber(
                    ps[planPlusToday]
                  )} / 目安コイン: ${formatNumber(pc[planPlusToday])} コイン`;
              } else if (planPlusToday === 1) {
                todayTargetCoinsEl.textContent =
                  "配信を1秒でもつければ＋1は確定。必要ならギフトで＋2/4/6を狙う想定で。";
              } else {
                todayTargetCoinsEl.textContent = "-";
              }
            }
          } else {
            // 計画が0のとき → 非スキップだけど今日は休み計画 or 未設定 → 残り日平均モード
            const cal2 = buildCalendarInfo();
            const { dates: allDates, skipSet: skip2 } = cal2;
            const todayIndex = allDates.indexOf(todayStr);
            const remainingActiveDays = allDates.slice(todayIndex).filter(ds => !skip2.has(ds)).length || 1;
            const remaining = targetPlus - sumPlus;

            if (remaining <= 0) {
              todayTargetPtEl.textContent = "今週の目標ptはすでに達成済み";
              todayTargetCoinsEl.textContent = "-";
            } else {
              const basePerDay = Math.ceil(remaining / remainingActiveDays);
              const realistic = pickRealisticPlus(basePerDay);
              const ps = cfg.plusScore || {};
              const pc = cfg.plusCoins || {};
              const scoreNeeded =
                realistic > 1 && ps[realistic] != null ? ps[realistic] : null;
              const coinsNeeded =
                realistic > 1 && pc[realistic] != null ? pc[realistic] : null;

              if (realistic === 0) {
                todayTargetPtEl.textContent = `理論値 ${basePerDay}pt/日ですが、今日は休みでも達成可能なペース。`;
                todayTargetCoinsEl.textContent = "-";
              } else if (realistic === 1) {
                todayTargetPtEl.textContent = `今日は＋1を取ればOK（理論値 ${basePerDay}pt/日 計算）。`;
                todayTargetCoinsEl.textContent =
                  "配信を1秒でもつける。追加コインは必須ではありません。";
              } else {
                todayTargetPtEl.textContent = `今日は ＋${realistic} を目標（理論値 ${basePerDay}pt/日 → ＋${realistic} に切り上げ）。`;
                if (scoreNeeded != null && coinsNeeded != null) {
                  todayTargetCoinsEl.textContent =
                    `最低スコア目安: ${formatNumber(scoreNeeded)} / ` +
                    `目安コイン: ${formatNumber(coinsNeeded)} コイン`;
                } else {
                  todayTargetCoinsEl.textContent = "-";
                }
              }
            }
          }
        }
      }
    }
  }
}

function updateLiveCalculator() {
  const rankLabel = document.getElementById("liveCalcRankLabel");
  const plusSelect = document.getElementById("calcPlusSelect");
  const targetScoreEl = document.getElementById("calcTargetScore");
  const currentScoreInput = document.getElementById("calcCurrentScore");
  const remainingScoreEl = document.getElementById("calcRemainingScore");
  const requiredCoinsEl = document.getElementById("calcRequiredCoins");

  if (!plusSelect || !targetScoreEl || !currentScoreInput || !remainingScoreEl || !requiredCoinsEl || !rankLabel) {
    return; // 初期ロード中など
  }

  // 現在ランクを表示
  rankLabel.textContent = state.currentRank || "-";

  const cfg = getRankConfig(state.currentRank);
  const targetPlus = Number(plusSelect.value) || 2;

  // このランクの＋2/4/6用ボーダースコアを取得
  const scoreMap = cfg.plusScore || {};
  const targetScore = scoreMap[targetPlus];

  if (!targetScore) {
    // ボーダー未設定のとき
    targetScoreEl.textContent = "-";
    remainingScoreEl.textContent = "-";
    requiredCoinsEl.textContent = "-";
    return;
  }

  targetScoreEl.textContent = formatNumber(targetScore);

  const currentScore = Number(currentScoreInput.value) || 0;
  let remainingScore = targetScore - currentScore;
  if (remainingScore < 0) remainingScore = 0;

  remainingScoreEl.textContent = formatNumber(remainingScore);

  // ★ 差分スコアを 1/3 → 10コイン単位に切り上げ
  const baseCoins = remainingScore > 0 ? Math.ceil(remainingScore / 3) : 0;

  // 最低10コイン、かつ10の位で切り上げ（例: 1→10, 11→20, 20→20）
  let requiredCoins = 0;
  if (baseCoins > 0) {
    requiredCoins = Math.ceil(baseCoins / 10) * 10;
  }
  
  requiredCoinsEl.textContent =
    requiredCoins > 0 ? `${formatNumber(requiredCoins)} コイン` : "0 コイン";
  
}

function setupLiveCalculator() {
  const plusSelect = document.getElementById("calcPlusSelect");
  const currentScoreInput = document.getElementById("calcCurrentScore");

  if (plusSelect) {
    plusSelect.addEventListener("change", () => {
      updateLiveCalculator();
    });
  }

  if (currentScoreInput) {
    currentScoreInput.addEventListener("input", () => {
      updateLiveCalculator();
    });
  }
}


function updateAll() {
  normalizeState();
  renderSkipDateInputs();
  renderPlan();
  renderEntries();
  renderDashboard();
  updateLiveCalculator();
}

// =====================
// 計画再配分
// =====================

function recalcPlanFromActual() {
  const { sumPlus, daily, startDate, endDate } = calcActualSummary();
  if (!startDate || !endDate) {
    alert("期間が未設定 or 実績がありません。先に開始日とデータを入力してください。");
    saveState();
    return;
  }

  const cfg = getRankConfig(state.currentRank);
  const targetPlus =
    state.goalType === "UP" ? cfg.upThreshold : cfg.keepThreshold;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = formatDateYMD(today);

  const cal = buildCalendarInfo();
  if (!cal) {
    alert("期間情報が取得できませんでした。開始日やスキップ設定を確認してください。");
    return;
  }
  const { activeIndexToDate } = cal;

  // ① 今日まで（≦今日）の実績＋数を合計し、計画を実績ベースに固定
  //    - 過去日：実績があればその値、なければ＋0
  //    - 当日：実績があればその値、なければ「最低＋1」で扱う
  let sumDone = 0;
  for (let idx = 0; idx < activeIndexToDate.length; idx++) {
    const ds = activeIndexToDate[idx];
    const actual = daily[ds]?.plus || 0;
    let used = actual;

    if (ds === todayStr) {
      // 当日は配信つければ＋1が確定なので、実績なしなら＋1として扱う
      if (actual === 0) {
        used = 1;
      }
    } else if (ds < todayStr) {
      // 過去日は実績がなければ本当に＋0（休み）扱い
      used = actual;
    }

    if (ds <= todayStr) {
      sumDone += used;
      if (!state.plan.days[idx]) {
        state.plan.days[idx] = { offset: idx, plannedPlus: 0, memo: "" };
      }
      state.plan.days[idx].plannedPlus = used;
    }
  }

  // ② 残り必要pt（今日までの分を引いた分）
  let remainingNeed = targetPlus - sumDone;
  if (remainingNeed < 0) remainingNeed = 0;

  // ③ 「今日より後（＞今日）」のアクティブ日を取得
  const futureIdx = [];
  for (let idx = 0; idx < activeIndexToDate.length; idx++) {
    const ds = activeIndexToDate[idx];
    if (ds > todayStr) {
      futureIdx.push(idx);
    }
  }

  if (!futureIdx.length) {
    // もう先のアクティブ日がない → そのまま
    saveState();
    updateAll();
    return;
  }

  // ④ 残り必要ptを futureIdx の日数で割って再配分（0/1/2/4/6に丸める）
  let slots = futureIdx.length;
  let remainingPoints = remainingNeed;

  for (const idx of futureIdx) {
    let newPlus = 0;
    if (remainingPoints > 0) {
      const basePerDay = Math.ceil(remainingPoints / slots);
      newPlus = pickRealisticPlus(basePerDay); // 0/1/2/4/6 に切り上げ
      if (newPlus > 6) newPlus = 6;
      remainingPoints -= newPlus;
    }
    if (!state.plan.days[idx]) {
      state.plan.days[idx] = { offset: idx, plannedPlus: 0, memo: "" };
    }
    state.plan.days[idx].plannedPlus = newPlus;
    slots--;
  }

  updateAll();
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

  if (dateInput && dateInput.showPicker) {
    dateInput.addEventListener("focus", () => {
      dateInput.showPicker();
    });
  }

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
    if (![1, 2, 4, 6].includes(drp)) {
      alert("＋数は 1 / 2 / 4 / 6 のいずれかを選んでください。");
      return;
    }

    upsertEntryByDate(date, {
      drp: sanitizePlus(drp),
      coins,
      hours,
      memo
    });
    
    saveState();
    updateAll();
    

    drpInput.value = "1";
    coinsInput.value = "";
    hoursInput.value = "";
    memoInput.value = "";
  });
}

function setupSettings() {
  const rankSelect = document.getElementById("currentRank");
  const goalTypeSelect = document.getElementById("goalType");
  const skipDaysInput = document.getElementById("skipDays");
  const periodStartInput = document.getElementById("periodStartInput");

  if (rankSelect) {
    rankSelect.value = state.currentRank;
    rankSelect.addEventListener("change", () => {
      state.currentRank = rankSelect.value;
      saveState();
    });
  }

  if (goalTypeSelect) {
    goalTypeSelect.value = state.goalType || "UP";
    goalTypeSelect.addEventListener("change", () => {
      state.goalType = goalTypeSelect.value;
      saveState();
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
  
      // ★ skipDates を skipDays に合わせて揃える
      if (!state.skipDates) state.skipDates = [];
      if (v === 0) {
        state.skipDates = [];        // ← 枚数0なら全部リセット
      } else {
        state.skipDates = state.skipDates.slice(0, v);
      }
  
      saveState();
      renderSkipDateInputs();         // UIも更新
    });
  }  

  if (periodStartInput) {
    periodStartInput.value = state.periodStart || "";
    if (periodStartInput.showPicker) {
      periodStartInput.addEventListener("focus", () => {
        periodStartInput.showPicker();
      });
    }
    periodStartInput.addEventListener("change", () => {
      state.periodStart = periodStartInput.value || null;
      saveState();
    });
  }

  const applyBtn = document.getElementById("applySettings");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      saveState();
      updateAll();
    });
  }

  const autoPrevToggle = document.getElementById("autoPlus1PrevDayToggle");
  if (autoPrevToggle) {
    autoPrevToggle.checked = !!state.autoPlus1PrevDay;
    autoPrevToggle.addEventListener("change", () => {
      state.autoPlus1PrevDay = autoPrevToggle.checked;
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

function setupPlanControls() {
  const btn = document.getElementById("recalcPlan");
  if (!btn) return;
  btn.addEventListener("click", () => {
    recalcPlanFromActual();
  });
}

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



// =====================
// 初期化
// =====================

async function initApp() {
  await loadStateFromFirestore();
  initRankSelect();
  setupForm();
  setupSettings();
  setupClearAll();
  setupPlanControls();
  setupLiveCalculator();
  setupHaneCounter();
  startMidnightWatcher();
  setupPublishUI(); 

  ensurePrevDayAutoPlus1();

  updateAll();
}

document.addEventListener("DOMContentLoaded", () => {
  showLogin();
  setupLoginUI(); // ボタンだけ先に有効化
});



let stateDocRef = null;     // ログイン後に入る
let currentUid = null;

// 画面切り替え（あなたが既にHTMLで移動済みの前提）
function showLogin() {
  document.getElementById("loginView").style.display = "block";
  document.getElementById("adminApp").style.display = "none"; // ← 管理画面全体に id="adminApp" を付けておく
}
function showApp() {
  document.getElementById("loginView").style.display = "none";
  document.getElementById("adminApp").style.display = "block";
}

// ログインボタン
function setupLoginUI() {
  const btn = document.getElementById("loginBtn");
  const errEl = document.getElementById("loginError");
  btn.addEventListener("click", async () => {
    errEl.textContent = "";
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value;
    try {
      await signInWithEmailPass(email, pass);
    } catch (e) {
      console.error(e);
      errEl.textContent = e?.message || "ログイン失敗";
    }
  });
}

function calcPublicSnapshot(state) {
  // ここは「見せたいものだけ」に絞る
  // 例：設定 + 計画 + 7日合計 + 期間
  const { sumPlus, startDate, endDate } = calcActualSummary(); // 既存関数を利用

  return {
    currentRank: state.currentRank,
    goalType: state.goalType,
    periodStart: state.periodStart,
    skipDays: state.skipDays,
    skipDates: state.skipDates || [],
    plan: state.plan || { days: [] },

    progress: {
      sumPlus,
      periodStart: startDate ? formatDateYMD(startDate) : null,
      periodEnd: endDate ? formatDateYMD(endDate) : null
    }
  };
}

function setupPublishUI() {
  const btn = document.getElementById("publishBtn");
  const msg = document.getElementById("publishMsg");
  const input = document.getElementById("publicCommentInput");

  if (!btn || !input) return;

  btn.addEventListener("click", async () => {
    if (msg) msg.textContent = "";
    try {
      const comment = input.value || "";
      await publishPublic({ state, calcPublicSnapshot, comment });
      if (msg) msg.textContent = "公開OK（viewer に反映されます）";
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = `公開失敗: ${e?.code || ""} ${e?.message || ""}`;
    }
  });
}


// ここはあなたの既存ロジックに合わせる
async function bootAfterLogin(uid, ref) {
  currentUid = uid;
  stateDocRef = ref;

  // ここで loadStateFromFirestore() → initRankSelect() → setupForm() ... を呼ぶ
  await initApp(); // ← あなたの既存 initApp をそのまま使ってOK
  showApp();
}

document.addEventListener("DOMContentLoaded", () => {
  setupLoginUI();

  setupAuth({
    onLoggedIn: bootAfterLogin,
    onLoggedOut: showLogin
  });

  showLogin();
});
