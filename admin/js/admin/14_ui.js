// =====================
// 画面切り替え & ログインUI
// =====================

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
  if (!btn || btn.dataset.bound) return;

  btn.dataset.bound = "1";
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
      await signInWithEmailPass(email, pass);
      // 成功したら onAuthStateChanged 側が動くので、ここでは何もしない
    } catch (e) {
      console.error("login failed:", e);
      if (errEl) errEl.textContent = "ログインに失敗しました（メール/パスを確認）";
    }
  });
}
