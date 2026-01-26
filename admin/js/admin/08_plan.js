// =====================
// 7日間の＋計画
// =====================

function renderPlan() {
  const tbody = document.getElementById("planTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  normalizePlan();

  const cal = buildCalendarInfo();
  const cfg = getRankConfig(state.currentRank);

  if (!cal) {
    // 期間未設定時は「Day1〜Day7」で7行だけ出す
    for (let i = 0; i < 7; i++) {
      const day = state.plan.days[i];
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = `Day ${i + 1}`;

      const tdPlus = document.createElement("td");
      const select = document.createElement("select");
      select.dataset.planIndex = String(i);
      for (const v of ALLOWED_PLUS) {
        const opt = document.createElement("option");
        opt.value = String(v);
        opt.textContent = v === 0 ? "休み（＋0）" : `＋${v}`;
        select.appendChild(opt);
      }
      const currentVal = ALLOWED_PLUS.includes(Number(day.plannedPlus))
        ? String(day.plannedPlus)
        : "0";
      select.value = currentVal;
      select.addEventListener("change", e => {
        const idx = Number(e.target.dataset.planIndex);
        let v = Number(e.target.value);
        if (!ALLOWED_PLUS.includes(v)) v = 0;
        state.plan.days[idx].plannedPlus = v;
        saveState();
        updateAll();
      });
      tdPlus.appendChild(select);

      const tdCoins = document.createElement("td");
      tdCoins.className = "text-right";
      const plus = Number(currentVal);
      if (plus > 1 && cfg.plusCoins && cfg.plusCoins[plus] != null) {
        const span = document.createElement("span");
        span.className = "coin-text";
        span.textContent = `${formatNumber(cfg.plusCoins[plus])} コイン`;
        tdCoins.appendChild(span);
      } else if (plus === 1) {
        tdCoins.textContent = "配信ONで＋1";
      } else {
        tdCoins.textContent = "-";
      }

      const tdMemo = document.createElement("td");
      const memoInput = document.createElement("input");
      memoInput.type = "text";
      memoInput.placeholder = "メモ";
      memoInput.value = day.memo || "";
      memoInput.dataset.planIndex = String(i);
      memoInput.addEventListener("input", e => {
        const idx = Number(e.target.dataset.planIndex);
        state.plan.days[idx].memo = e.target.value;
        saveState();
      });
      tdMemo.appendChild(memoInput);

      tr.appendChild(tdDate);
      tr.appendChild(tdPlus);
      tr.appendChild(tdCoins);
      tr.appendChild(tdMemo);

      tbody.appendChild(tr);
    }

    // 合計など
    const { planTotal } = calcPlanSummary();
    const planTotalPlusEl = document.getElementById("planTotalPlus");
    const planMarginPlusEl = document.getElementById("planMarginPlus");
    const goalTypeLabel = document.getElementById("goalTypeLabel");
    const targetPlusLabel = document.getElementById("targetPlusLabel");
    const cfg2 = getRankConfig(state.currentRank);
    const targetPlus =
      state.goalType === "UP" ? cfg2.upThreshold : cfg2.keepThreshold;

    if (planTotalPlusEl) planTotalPlusEl.textContent = planTotal;
    if (goalTypeLabel)
      goalTypeLabel.textContent =
        state.goalType === "UP" ? "ランクアップ狙い" : "ランクキープ狙い";
    if (targetPlusLabel) targetPlusLabel.textContent = targetPlus;

    if (planMarginPlusEl) {
      const diff = planTotal - targetPlus;
      let text;
      if (diff === 0) text = "目標ぴったり";
      else if (diff > 0) text = `目標より +${diff}pt（余裕あり）`;
      else text = `目標まであと ${-diff}pt`;
      planMarginPlusEl.textContent = text;
    }
    return;
  }

  // ここから「期間＋スキップ日」あり
  const { dates, skipSet, activeDateToIndex } = cal;

  for (const ds of dates) {
    const tr = document.createElement("tr");

    // 日付
    const tdDate = document.createElement("td");
    tdDate.textContent = ds;

    const tdPlus = document.createElement("td");
    const tdCoins = document.createElement("td");
    tdCoins.className = "text-right";
    const tdMemo = document.createElement("td");

    if (skipSet.has(ds)) {
      // スキップ日
      const label = document.createElement("span");
      label.textContent = "スキップ日（＋0固定）";
      tdPlus.appendChild(label);

      tdCoins.textContent = "-";

      const memo = document.createElement("span");
      memo.className = "text-small muted";
      memo.textContent = "スキップカード分の自動付与日";
      tdMemo.appendChild(memo);
    } else {
      // 非スキップ日 → 計画7日のうちのどこか
      const planIdx = activeDateToIndex[ds];
      const day = state.plan.days[planIdx] || { plannedPlus: 0, memo: "" };

      const select = document.createElement("select");
      select.dataset.planIndex = String(planIdx);
      for (const v of ALLOWED_PLUS) {
        const opt = document.createElement("option");
        opt.value = String(v);
        opt.textContent = v === 0 ? "休み（＋0）" : `＋${v}`;
        select.appendChild(opt);
      }
      const currentVal = ALLOWED_PLUS.includes(Number(day.plannedPlus))
        ? String(day.plannedPlus)
        : "0";
      select.value = currentVal;
      select.addEventListener("change", e => {
        const idx = Number(e.target.dataset.planIndex);
        let v = Number(e.target.value);
        if (!ALLOWED_PLUS.includes(v)) v = 0;
        state.plan.days[idx].plannedPlus = v;
        updateAll();
      });
      tdPlus.appendChild(select);

      const plus = Number(currentVal);
      if (plus > 1 && cfg.plusCoins && cfg.plusCoins[plus] != null) {
        const span = document.createElement("span");
        span.className = "coin-text";
        span.textContent = `${formatNumber(cfg.plusCoins[plus])} コイン`;
        tdCoins.appendChild(span);
      } else if (plus === 1) {
        tdCoins.textContent = "配信ONで＋1";
      } else {
        tdCoins.textContent = "-";
      }

      const memoInput = document.createElement("input");
      memoInput.type = "text";
      memoInput.placeholder = "メモ";
      memoInput.value = day.memo || "";
      memoInput.dataset.planIndex = String(planIdx);
      memoInput.addEventListener("input", e => {
        const idx = Number(e.target.dataset.planIndex);
        state.plan.days[idx].memo = e.target.value;
        saveState();
      });
      tdMemo.appendChild(memoInput);
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdPlus);
    tr.appendChild(tdCoins);
    tr.appendChild(tdMemo);

    tbody.appendChild(tr);
  }

  // 合計など（ここは今まで通り 7日分の合計）
  const { planTotal } = calcPlanSummary();
  const planTotalPlusEl = document.getElementById("planTotalPlus");
  const planMarginPlusEl = document.getElementById("planMarginPlus");
  const goalTypeLabel = document.getElementById("goalTypeLabel");
  const targetPlusLabel = document.getElementById("targetPlusLabel");
  const cfg2 = getRankConfig(state.currentRank);
  const targetPlus =
    state.goalType === "UP" ? cfg2.upThreshold : cfg2.keepThreshold;

  if (planTotalPlusEl) planTotalPlusEl.textContent = planTotal;
  if (goalTypeLabel)
    goalTypeLabel.textContent =
      state.goalType === "UP" ? "ランクアップ狙い" : "ランクキープ狙い";
  if (targetPlusLabel) targetPlusLabel.textContent = targetPlus;

  if (planMarginPlusEl) {
    const diff = planTotal - targetPlus;
    let text;
    if (diff === 0) text = "目標ぴったり";
    else if (diff > 0) text = `目標より +${diff}pt（余裕あり）`;
    else text = `目標まであと ${-diff}pt`;
    planMarginPlusEl.textContent = text;
  }
}

// =====================
// 計画再配分
// =====================

function recalcPlanFromActual() {
  const { sumPlus, daily, startDate, endDate } = calcActualSummary();
  if (!startDate || !endDate) {
    alert("期間が未設定 or 実績がありません。先に開始日とデータを入力してください。");
    saveState();
    return;
  }

  const cfg = getRankConfig(state.currentRank);
  const targetPlus =
    state.goalType === "UP" ? cfg.upThreshold : cfg.keepThreshold;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = formatDateYMD(today);

  const cal = buildCalendarInfo();
  if (!cal) {
    alert("期間情報が取得できませんでした。開始日やスキップ設定を確認してください。");
    return;
  }
  const { activeIndexToDate } = cal;

  // ① 今日まで（≦今日）の実績＋数を合計し、計画を実績ベースに固定
  //    - 過去日：実績があればその値、なければ＋0
  //    - 当日：実績があればその値、なければ「最低＋1」で扱う
  let sumDone = 0;
  for (let idx = 0; idx < activeIndexToDate.length; idx++) {
    const ds = activeIndexToDate[idx];
    const actual = daily[ds]?.plus || 0;
    let used = actual;

    if (ds === todayStr) {
      // 当日は配信つければ＋1が確定なので、実績なしなら＋1として扱う
      if (actual === 0) {
        used = 1;
      }
    } else if (ds < todayStr) {
      // 過去日は実績がなければ本当に＋0（休み）扱い
      used = actual;
    }

    if (ds <= todayStr) {
      sumDone += used;
      if (!state.plan.days[idx]) {
        state.plan.days[idx] = { offset: idx, plannedPlus: 0, memo: "" };
      }
      state.plan.days[idx].plannedPlus = used;
    }
  }

  // ② 残り必要pt（今日までの分を引いた分）
  let remainingNeed = targetPlus - sumDone;
  if (remainingNeed < 0) remainingNeed = 0;

  // ③ 「今日より後（＞今日）」のアクティブ日を取得
  const futureIdx = [];
  for (let idx = 0; idx < activeIndexToDate.length; idx++) {
    const ds = activeIndexToDate[idx];
    if (ds > todayStr) {
      futureIdx.push(idx);
    }
  }

  if (!futureIdx.length) {
    // もう先のアクティブ日がない → そのまま
    saveState();
    updateAll();
    return;
  }

  // ④ 残り必要ptを futureIdx の日数で割って再配分（0/1/2/4/6に丸める）
  let slots = futureIdx.length;
  let remainingPoints = remainingNeed;

  for (const idx of futureIdx) {
    let newPlus = 0;
    if (remainingPoints > 0) {
      const basePerDay = Math.ceil(remainingPoints / slots);
      newPlus = pickRealisticPlus(basePerDay); // 0/1/2/4/6 に切り上げ
      if (newPlus > 6) newPlus = 6;
      remainingPoints -= newPlus;
    }
    if (!state.plan.days[idx]) {
      state.plan.days[idx] = { offset: idx, plannedPlus: 0, memo: "" };
    }
    state.plan.days[idx].plannedPlus = newPlus;
    slots--;
  }

  updateAll();
}
