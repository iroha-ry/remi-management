// admin/js/public.js
import { publicDocRef } from "./firebase.js";

function calcPublicSnapshot() {
  const comment = (document.getElementById("publicCommentInput")?.value || "").trim();

  // ダッシュボード計算に必要な最低限
  const { sumPlus, startDate, endDate } = calcActualSummary();
  const cfg = getRankConfig(state.currentRank);
  const targetPlus = state.goalType === "UP" ? cfg.upThreshold : cfg.keepThreshold;

  return {
    // viewerで使う公開情報
    currentRank: state.currentRank,
    goalType: state.goalType,
    periodStart: state.periodStart,
    skipDays: state.skipDays,
    skipDates: state.skipDates || [],
    plan: state.plan || { days: [] },

    // 進捗系（viewerで表示したいなら）
    sum7: sumPlus,
    periodStartYMD: startDate ? formatDateYMD(startDate) : null,
    periodEndYMD: endDate ? formatDateYMD(endDate) : null,
    targetPlus,

    // コメント（最新1件）
    publicComment: comment,

    // 更新日時
    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
}

export async function publishPublic() {
  const payload = calcPublicSnapshot();
  await publicDocRef.set(payload, { merge: true });
}
