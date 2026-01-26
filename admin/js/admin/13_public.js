// =====================
// 公開反映
// =====================

async function publishPublic({ state, calcPublicSnapshot, comment }) {
  if (!publicDocRef) throw new Error("publicDocRef is not defined");
  if (typeof calcPublicSnapshot !== "function") {
    throw new TypeError("calcPublicSnapshot is not a function");
  }

  const payload = calcPublicSnapshot(state);
  payload.publicComment = String(comment || "").trim();
  payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

  await publicDocRef.set(payload, { merge: true });
  return payload;
}

function calcPublicSnapshot(state) {
  // ここは「見せたいものだけ」に絞る
  // 例：設定 + 計画 + 7日合計 + 期間
  const { sumPlus, startDate, endDate } = calcActualSummary(); // 既存関数を利用

  return {
    currentRank: state.currentRank,
    goalType: state.goalType,
    periodStart: state.periodStart,
    skipDays: state.skipDays,
    skipDates: state.skipDates || [],
    plan: state.plan || { days: [] },

    progress: {
      sumPlus,
      periodStart: startDate ? formatDateYMD(startDate) : null,
      periodEnd: endDate ? formatDateYMD(endDate) : null
    }
  };
}

function setupPublishUI() {
  const btn = document.getElementById("publishBtn");
  const msg = document.getElementById("publishMsg");
  const input = document.getElementById("publicCommentInput");

  if (!btn || !input) return;

  btn.addEventListener("click", async () => {
    if (msg) msg.textContent = "";
    try {
      const comment = input.value || "";
      // 管理側にも保持しておく（次回ログイン時に textarea を埋められる）
      state.publicComment = comment;
      saveState();

      await publishPublic({ state, calcPublicSnapshot, comment });
      if (msg) msg.textContent = "公開OK（viewer に反映されます）";
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = `公開失敗: ${e?.code || ""} ${e?.message || ""}`;
    }
  });
}
