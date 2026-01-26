// =====================
// ダッシュボード
// =====================

function renderDashboard() {
  const sum7El = document.getElementById("sum7");
  const needUpPointsEl = document.getElementById("needUpPoints");
  const needKeepPointsEl = document.getElementById("needKeepPoints");
  const safeMarginPointsEl = document.getElementById("safeMarginPoints");
  const progressBar = document.getElementById("progressBar");
  const statusBadge = document.getElementById("statusBadge");
  const currentRankBadges = document.getElementById("currentRankBadges");
  const nextRankLabel = document.getElementById("nextRankLabel");
  const prevRankLabel = document.getElementById("prevRankLabel");
  const periodStartLabel = document.getElementById("periodStart");
  const periodEndLabel = document.getElementById("periodEnd");
  const upConditionLabel = document.getElementById("upConditionLabel");
  const keepConditionLabel = document.getElementById("keepConditionLabel");
  const chipUpThreshold = document.getElementById("chipUpThreshold");
  const chipKeepThreshold = document.getElementById("chipKeepThreshold");
  const chipDownThreshold = document.getElementById("chipDownThreshold");
  const todayTargetPtEl = document.getElementById("todayTargetPt");
  const todayTargetCoinsEl = document.getElementById("todayTargetCoins");

  const rank = state.currentRank;
  const cfg = getRankConfig(rank);

  const rankIndex = RANKS.indexOf(rank);
  const nextRank =
    rankIndex >= 0 && rankIndex < RANKS.length - 1
      ? RANKS[rankIndex + 1]
      : null;
  const prevRank = rankIndex > 0 ? RANKS[rankIndex - 1] : null;

  if (nextRankLabel)
    nextRankLabel.textContent = nextRank || "これ以上はありません（最上位）";
  if (prevRankLabel)
    prevRankLabel.textContent = prevRank || "これ以上はありません（最下位）";

  if (currentRankBadges) {
    currentRankBadges.innerHTML = "";
    const rankBadge = document.createElement("span");
    rankBadge.className = "badge badge-rank";
    rankBadge.textContent = `現在ランク: ${rank}`;
    currentRankBadges.appendChild(rankBadge);
    if (nextRank) {
      const nextBadge = document.createElement("span");
      nextBadge.className = "badge badge-keep";
      nextBadge.textContent = `次: ${nextRank}`;
      currentRankBadges.appendChild(nextBadge);
    }
  }

  const { sumPlus, daily, startDate, endDate } = calcActualSummary();

  if (sum7El) sum7El.textContent = sumPlus;
  if (periodStartLabel)
    periodStartLabel.textContent = startDate ? formatDateYMD(startDate) : "-";
  if (periodEndLabel)
    periodEndLabel.textContent = endDate ? formatDateYMD(endDate) : "-";

  const UP_THRESHOLD = cfg.upThreshold;
  const KEEP_THRESHOLD = cfg.keepThreshold;

  if (upConditionLabel)
    upConditionLabel.textContent = `ランクアップ条件（${UP_THRESHOLD}pt以上）`;
  if (keepConditionLabel)
    keepConditionLabel.textContent = `キープ条件（${KEEP_THRESHOLD}pt以上）`;
  if (chipUpThreshold) chipUpThreshold.textContent = UP_THRESHOLD;
  if (chipKeepThreshold) chipKeepThreshold.textContent = KEEP_THRESHOLD;
  if (chipDownThreshold) chipDownThreshold.textContent = KEEP_THRESHOLD - 1;

  const needUpPoints = Math.max(0, UP_THRESHOLD - sumPlus);
  const needKeepPoints = Math.max(0, KEEP_THRESHOLD - sumPlus);
  const safeMargin =
    sumPlus === 0 && state.entries.length === 0
      ? "-"
      : sumPlus <= KEEP_THRESHOLD - 1
      ? `あと ${(KEEP_THRESHOLD - 1) - sumPlus + 1} pt でダウン域`
      : `${sumPlus - (KEEP_THRESHOLD - 1)} pt`;

  if (needUpPointsEl) needUpPointsEl.textContent = needUpPoints;
  if (needKeepPointsEl) needKeepPointsEl.textContent = needKeepPoints;
  if (safeMarginPointsEl) safeMarginPointsEl.textContent = safeMargin;

  if (progressBar) {
    const goalMax =
      state.goalType === "UP" ? UP_THRESHOLD : KEEP_THRESHOLD;
    const progress = clamp(
      goalMax > 0 ? sumPlus / goalMax : 0,
      0,
      1
    ) * 100;
    progressBar.style.width = `${progress}%`;
  }

  // 今日の目安（計画・スキップ日とリンク）
  if (todayTargetPtEl && todayTargetCoinsEl) {
    if (!startDate || !endDate) {
      todayTargetPtEl.textContent = "期間が未設定 or 実績がありません";
      todayTargetCoinsEl.textContent = "-";
    } else {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayStr = formatDateYMD(today);

      if (today < startDate || today > endDate) {
        todayTargetPtEl.textContent = "今日の日付はこの週の期間外です";
        todayTargetCoinsEl.textContent = "-";
      } else {
        const cal = buildCalendarInfo();
        const { skipSet, activeDateToIndex, dates } = cal;

        const targetPlus =
          state.goalType === "UP" ? UP_THRESHOLD : KEEP_THRESHOLD;
        const remainingWeek = targetPlus - sumPlus;

        if (skipSet.has(todayStr)) {
          // スキップ日
          todayTargetPtEl.textContent = "今日はスキップ日（＋0固定）です。";
          if (remainingWeek > 0) {
            todayTargetCoinsEl.textContent = `週目標までは残り ${remainingWeek}pt。非スキップ日に上乗せして調整しましょう。`;
          } else {
            todayTargetCoinsEl.textContent = "週目標はすでに達成済みです。";
          }
        } else {
          // 非スキップ日 → 7日計画のどこか
          const planIdx = activeDateToIndex[todayStr];
          const planPlusToday =
            planIdx != null ? Number(state.plan.days[planIdx].plannedPlus) || 0 : 0;
          const actualToday = daily[todayStr]?.plus || 0;

          if (planPlusToday > 0) {
            if (actualToday >= planPlusToday) {
              todayTargetPtEl.textContent = `今日の目標 ＋${planPlusToday} は達成済み（実績 ＋${actualToday}）`;
              if (remainingWeek > 0) {
                todayTargetCoinsEl.textContent = `週目標までは残り ${remainingWeek}pt。明日以降の計画で調整しましょう。`;
              } else {
                todayTargetCoinsEl.textContent = "週目標も達成済みです。";
              }
            } else {
              const diff = planPlusToday - actualToday;
              todayTargetPtEl.textContent = `今日の目標: ＋${planPlusToday}（現在 ＋${actualToday} → あと ＋${diff} 欲しい）`;
              const ps = cfg.plusScore || {};
              const pc = cfg.plusCoins || {};
              if (planPlusToday > 1 && ps[planPlusToday] != null && pc[planPlusToday] != null) {
                todayTargetCoinsEl.textContent =
                  `この日の目標に必要な最低スコア目安: ${formatNumber(
                    ps[planPlusToday]
                  )} / 目安コイン: ${formatNumber(pc[planPlusToday])} コイン`;
              } else if (planPlusToday === 1) {
                todayTargetCoinsEl.textContent =
                  "配信を1秒でもつければ＋1は確定。必要ならギフトで＋2/4/6を狙う想定で。";
              } else {
                todayTargetCoinsEl.textContent = "-";
              }
            }
          } else {
            // 計画が0のとき → 非スキップだけど今日は休み計画 or 未設定 → 残り日平均モード
            const cal2 = buildCalendarInfo();
            const { dates: allDates, skipSet: skip2 } = cal2;
            const todayIndex = allDates.indexOf(todayStr);
            const remainingActiveDays = allDates.slice(todayIndex).filter(ds => !skip2.has(ds)).length || 1;
            const remaining = targetPlus - sumPlus;

            if (remaining <= 0) {
              todayTargetPtEl.textContent = "今週の目標ptはすでに達成済み";
              todayTargetCoinsEl.textContent = "-";
            } else {
              const basePerDay = Math.ceil(remaining / remainingActiveDays);
              const realistic = pickRealisticPlus(basePerDay);
              const ps = cfg.plusScore || {};
              const pc = cfg.plusCoins || {};
              const scoreNeeded =
                realistic > 1 && ps[realistic] != null ? ps[realistic] : null;
              const coinsNeeded =
                realistic > 1 && pc[realistic] != null ? pc[realistic] : null;

              if (realistic === 0) {
                todayTargetPtEl.textContent = `理論値 ${basePerDay}pt/日ですが、今日は休みでも達成可能なペース。`;
                todayTargetCoinsEl.textContent = "-";
              } else if (realistic === 1) {
                todayTargetPtEl.textContent = `今日は＋1を取ればOK（理論値 ${basePerDay}pt/日 計算）。`;
                todayTargetCoinsEl.textContent =
                  "配信を1秒でもつける。追加コインは必須ではありません。";
              } else {
                todayTargetPtEl.textContent = `今日は ＋${realistic} を目標（理論値 ${basePerDay}pt/日 → ＋${realistic} に切り上げ）。`;
                if (scoreNeeded != null && coinsNeeded != null) {
                  todayTargetCoinsEl.textContent =
                    `最低スコア目安: ${formatNumber(scoreNeeded)} / ` +
                    `目安コイン: ${formatNumber(coinsNeeded)} コイン`;
                } else {
                  todayTargetCoinsEl.textContent = "-";
                }
              }
            }
          }
        }
      }
    }
  }
}
