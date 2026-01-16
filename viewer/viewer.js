// Firebase 初期化（admin.jsと同じ firebaseConfig をコピペ）
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

function calcCoinsFromScoreDiff(diffScore) {
  const baseCoins = diffScore > 0 ? Math.ceil(diffScore / 3) : 0;
  return baseCoins > 0 ? Math.ceil(baseCoins / 10) * 10 : 0;
}

async function loadPublic() {
  try {
    const snap = await publicDocRef.get();
    const data = snap.exists ? snap.data() : null;

    const commentEl = document.getElementById("publicComment");
    commentEl.textContent = (data && data.publicComment) ? data.publicComment : "（コメントなし）";
  } catch (e) {
    console.error("publicStates 読み込み失敗", e);
    document.getElementById("publicComment").textContent = "読み込み失敗";
  }
}

function setupCalculator() {
  const input = document.getElementById("diffScore");
  const out = document.getElementById("diffCoins");
  input.addEventListener("input", () => {
    const diff = Number(input.value) || 0;
    out.textContent = calcCoinsFromScoreDiff(diff).toLocaleString("ja-JP");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupCalculator();
  loadPublic();
});
