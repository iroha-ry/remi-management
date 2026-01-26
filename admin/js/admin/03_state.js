// =====================
// 状態
// =====================

let firestoreLoaded = false;
let stateDocRef = null;     // ログイン後に入る
let currentUid = null;

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
