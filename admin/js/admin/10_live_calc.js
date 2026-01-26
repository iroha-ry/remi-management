// =====================
// ライブ中計算機
// =====================

function updateLiveCalculator() {
  const rankLabel = document.getElementById("liveCalcRankLabel");
  const plusSelect = document.getElementById("calcPlusSelect");
  const targetScoreEl = document.getElementById("calcTargetScore");
  const currentScoreInput = document.getElementById("calcCurrentScore");
  const remainingScoreEl = document.getElementById("calcRemainingScore");
  const requiredCoinsEl = document.getElementById("calcRequiredCoins");

  if (!plusSelect || !targetScoreEl || !currentScoreInput || !remainingScoreEl || !requiredCoinsEl || !rankLabel) {
    return; // 初期ロード中など
  }

  // 現在ランクを表示
  rankLabel.textContent = state.currentRank || "-";

  const cfg = getRankConfig(state.currentRank);
  const targetPlus = Number(plusSelect.value) || 2;

  // このランクの＋2/4/6用ボーダースコアを取得
  const scoreMap = cfg.plusScore || {};
  const targetScore = scoreMap[targetPlus];

  if (!targetScore) {
    // ボーダー未設定のとき
    targetScoreEl.textContent = "-";
    remainingScoreEl.textContent = "-";
    requiredCoinsEl.textContent = "-";
    return;
  }

  targetScoreEl.textContent = formatNumber(targetScore);

  const currentScore = Number(currentScoreInput.value) || 0;
  let remainingScore = targetScore - currentScore;
  if (remainingScore < 0) remainingScore = 0;

  remainingScoreEl.textContent = formatNumber(remainingScore);

  // ★ 差分スコアを 1/3 → 10コイン単位に切り上げ
  const baseCoins = remainingScore > 0 ? Math.ceil(remainingScore / 3) : 0;

  // 最低10コイン、かつ10の位で切り上げ（例: 1→10, 11→20, 20→20）
  let requiredCoins = 0;
  if (baseCoins > 0) {
    requiredCoins = Math.ceil(baseCoins / 10) * 10;
  }

  requiredCoinsEl.textContent =
    requiredCoins > 0 ? `${formatNumber(requiredCoins)} コイン` : "0 コイン";
}

function setupLiveCalculator() {
  const plusSelect = document.getElementById("calcPlusSelect");
  const currentScoreInput = document.getElementById("calcCurrentScore");

  if (plusSelect) {
    plusSelect.addEventListener("change", () => {
      updateLiveCalculator();
    });
  }

  if (currentScoreInput) {
    currentScoreInput.addEventListener("input", () => {
      updateLiveCalculator();
    });
  }
}
