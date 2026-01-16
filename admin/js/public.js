// admin/js/public.js
import { publicDocRef } from "./firebase.js";

export async function publishPublic(payload) {
  // payload は main.js 側で作る
  await publicDocRef.set(payload, { merge: true });
}
