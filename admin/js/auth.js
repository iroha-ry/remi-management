// admin/js/auth.js
import { auth, adminStateDocRef } from "./firebase.js";

export function setupAuth({
  onLoggedIn,  // (uid, stateDocRef) => void
  onLoggedOut, // () => void
}) {
  auth.onAuthStateChanged((user) => {
    if (user) {
      const ref = adminStateDocRef(user.uid);
      onLoggedIn(user.uid, ref);
    } else {
      onLoggedOut();
    }
  });
}

export async function signInWithEmailPass(email, pass) {
  return auth.signInWithEmailAndPassword(email, pass);
}

export async function signOut() {
  return auth.signOut();
}
