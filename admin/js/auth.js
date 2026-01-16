// admin/js/auth.js
import { auth } from "./firebase.js";

export function setupAuth({ onLoggedIn, onLoggedOut }) {
  const loginView = document.getElementById("loginView");
  const appView = document.getElementById("appView");
  const emailEl = document.getElementById("loginEmail");
  const passEl = document.getElementById("loginPass");
  const btn = document.getElementById("loginBtn");
  const errEl = document.getElementById("loginError");

  const showLogin = () => {
    if (loginView) loginView.style.display = "";
    if (appView) appView.style.display = "none";
  };
  const showApp = () => {
    if (loginView) loginView.style.display = "none";
    if (appView) appView.style.display = "";
  };

  if (btn) {
    btn.addEventListener("click", async () => {
      if (errEl) errEl.textContent = "";
      const email = (emailEl?.value || "").trim();
      const pass = (passEl?.value || "").trim();
      if (!email || !pass) {
        if (errEl) errEl.textContent = "メールとパスワードを入力してね";
        return;
      }
      try {
        await auth.signInWithEmailAndPassword(email, pass);
      } catch (e) {
        console.error("login failed", e);
        if (errEl) errEl.textContent = e?.message || "ログイン失敗";
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      showApp();
      await onLoggedIn?.(user);
    } else {
      showLogin();
      onLoggedOut?.();
    }
  });

  // 初期はログイン画面想定（onAuthStateChangedで上書きされる）
  showLogin();
}
