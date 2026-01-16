// admin/js/public.js
import { publicDocRef } from "./firebase.js";

export async function publishPublic({ state, calcPublicSnapshot, comment }) {
  // viewerが読む公開データ
  const payload = {
    publicComment: (comment ?? "").trim(),
    publicUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    publicSnapshot: calcPublicSnapshot(state) // ← admin側で作る（後述）
  };

  // merge: true にして既存フィールドを消さない
  return publicDocRef.set(payload, { merge: true });
}
