// =====================
// 設定 UI
// =====================

function initRankSelect() {
  const select = document.getElementById("currentRank");
  if (!select) return;
  select.innerHTML = "";
  for (const r of RANKS) {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    select.appendChild(opt);
  }
  select.value = state.currentRank;
}

function renderSkipDateInputs() {
  const container = document.getElementById("skipDatesContainer");
  if (!container) return;
  container.innerHTML = "";

  const n = Number(state.skipDays) || 0;
  if (n <= 0) {
    // ★ skipDays=0 のときは内部もリセット
    state.skipDates = [];

    const p = document.createElement("div");
    p.className = "text-small muted";
    p.textContent = "スキップカードを使わない週です。";
    container.appendChild(p);
    return;
  }

  for (let i = 0; i < n; i++) {
    const row = document.createElement("div");
    row.className = "skip-dates-row";

    const label = document.createElement("span");
    label.className = "text-small";
    label.textContent = `スキップ${i + 1}枚目：`;

    const input = document.createElement("input");
    input.type = "date";
    input.dataset.index = String(i);
    input.value = state.skipDates?.[i] || "";

    // モバイル/PC両方でタップしたらカレンダー出しやすく
    if (input.showPicker) {
      input.addEventListener("focus", () => {
        input.showPicker();
      });
    }

    input.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.index);
      if (!state.skipDates) state.skipDates = [];
      state.skipDates[idx] = e.target.value || null;
      saveState();
    });

    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  }
}

function setupSettings() {
  const rankSelect = document.getElementById("currentRank");
  const goalTypeSelect = document.getElementById("goalType");
  const skipDaysInput = document.getElementById("skipDays");
  const periodStartInput = document.getElementById("periodStartInput");

  if (rankSelect) {
    rankSelect.value = state.currentRank;
    rankSelect.addEventListener("change", () => {
      state.currentRank = rankSelect.value;
      saveState();
    });
  }

  if (goalTypeSelect) {
    goalTypeSelect.value = state.goalType || "UP";
    goalTypeSelect.addEventListener("change", () => {
      state.goalType = goalTypeSelect.value;
      saveState();
    });
  }

  if (skipDaysInput) {
    skipDaysInput.value = state.skipDays || 0;
    skipDaysInput.addEventListener("change", () => {
      let v = Number(skipDaysInput.value);
      if (isNaN(v) || v < 0) v = 0;
      if (v > 7) v = 7;
      state.skipDays = v;
      skipDaysInput.value = v;

      // ★ skipDates を skipDays に合わせて揃える
      if (!state.skipDates) state.skipDates = [];
      if (v === 0) {
        state.skipDates = [];        // ← 枚数0なら全部リセット
      } else {
        state.skipDates = state.skipDates.slice(0, v);
      }

      saveState();
      renderSkipDateInputs();         // UIも更新
    });
  }

  if (periodStartInput) {
    periodStartInput.value = state.periodStart || "";
    if (periodStartInput.showPicker) {
      periodStartInput.addEventListener("focus", () => {
        periodStartInput.showPicker();
      });
    }
    periodStartInput.addEventListener("change", () => {
      state.periodStart = periodStartInput.value || null;
      saveState();
    });
  }

  const applyBtn = document.getElementById("applySettings");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      saveState();
      updateAll();
    });
  }

  const autoPrevToggle = document.getElementById("autoPlus1PrevDayToggle");
  if (autoPrevToggle) {
    autoPrevToggle.checked = !!state.autoPlus1PrevDay;
    autoPrevToggle.addEventListener("change", () => {
      state.autoPlus1PrevDay = autoPrevToggle.checked;
      saveState();
      updateAll();
    });
  }
}

function setupClearAll() {
  const btn = document.getElementById("clearAll");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!state.entries.length) return;
    if (!confirm("保存されている全ての入力データを削除しますか？（元に戻せません）")) return;
    state.entries = [];
    saveState();
    updateAll();
  });
}

function setupPlanControls() {
  const btn = document.getElementById("recalcPlan");
  if (!btn) return;
  btn.addEventListener("click", () => {
    recalcPlanFromActual();
  });
}
