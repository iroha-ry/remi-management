// =====================
// Auth
// =====================

function setupAuth({ onLoggedIn, onLoggedOut }) {
  auth.onAuthStateChanged(
    (user) => {
      if (user) onLoggedIn && onLoggedIn(user);
      else onLoggedOut && onLoggedOut();
    },
    (err) => console.error("Auth state error:", err)
  );
}

function signInWithEmailPass(email, password) {
  return auth.signInWithEmailAndPassword(String(email || ""), String(password || ""));
}
