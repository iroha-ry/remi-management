// admin/js/firebase.js
export const firebaseConfig = {
  apiKey: "AIzaSyAwXA9NUKbFEj8rpBOnjTDvdxtlPU914ZI",
  authDomain: "palmu-rank-tracker.firebaseapp.com",
  projectId: "palmu-rank-tracker",
  storageBucket: "palmu-rank-tracker.firebasestorage.app",
  messagingSenderId: "475887212310",
  appId: "1:475887212310:web:c4ec10f408596a887ca237"
};

firebase.initializeApp(firebaseConfig);

export const db = firebase.firestore();
export const auth = firebase.auth();

// 公開用
export const publicDocRef = db.collection("publicStates").doc("main");

// 管理用（ログイン後に uid で確定）
export function adminStateDocRef(uid) {
  return db.collection("adminStates").doc(uid).collection("state").doc("main");
}
