// =====================
// 初期化 & 全体更新
// =====================

function updateAll() {
  normalizeState();
  renderSkipDateInputs();
  renderPlan();
  renderEntries();
  renderDashboard();
  updateLiveCalculator();
}

let booted = false; // 二重初期化防止

async function bootAfterLogin(user) {
  if (!user) return;

  stateDocRef = db.collection("adminStates").doc(user.uid).collection("state").doc("main");

  showAdmin();

  // 初回だけフル初期化（render関数やイベント登録）
  if (!booted) {
    booted = true;

    initRankSelect();
    setupForm();
    setupSettings();
    setupClearAll();
    setupPlanControls();
    setupLiveCalculator();
    setupHaneCounter();
    startMidnightWatcher();
    setupPublishUI();
  }

  // ログイン後にロード
  await loadStateFromFirestore();

  ensurePrevDayAutoPlus1();
  updateAll();
}

function handleLogout() {
  stateDocRef = null;
  firestoreLoaded = false;
  showLogin();
}

document.addEventListener("DOMContentLoaded", () => {
  showLogin();
  setupLoginUI();

  setupAuth({
    onLoggedIn: bootAfterLogin,
    onLoggedOut: handleLogout
  });
});
