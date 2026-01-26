// =====================
// 実績入力・一覧
// =====================

function genEntryId(dateStr) {
  return `${dateStr}_${Date.now()}`;
}

function findEntryIndexByDate(dateStr) {
  return (state.entries || []).findIndex(e => e && e.date === dateStr);
}

// 同じdateがあれば上書き、なければ追加
function upsertEntryByDate(dateStr, patch) {
  if (!Array.isArray(state.entries)) state.entries = [];

  const idx = findEntryIndexByDate(dateStr);

  if (idx >= 0) {
    state.entries[idx] = {
      ...state.entries[idx],
      ...patch,
      date: dateStr,
      id: state.entries[idx].id || genEntryId(dateStr)
    };
  } else {
    state.entries.push({
      id: genEntryId(dateStr),
      date: dateStr,
      drp: 0,
      coins: 0,
      hours: "",
      memo: "",
      ...patch
    });
  }
}

function renderEntries() {
  const tbody = document.querySelector("#entriesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!state.entries.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "text-small muted";
    td.textContent = "まだデータがありません。上のフォームから追加してください。";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const sorted = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
  const limited = sorted.slice(0, 30);

  for (const entry of limited) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = entry.date;

    const tdDrp = document.createElement("td");
    tdDrp.className = "text-right";
    tdDrp.textContent = `＋${entry.drp}`;

    const tdCoins = document.createElement("td");
    tdCoins.className = "text-right";
    if (entry.coins) {
      const span = document.createElement("span");
      span.className = "coin-text";
      span.textContent = `${formatNumber(entry.coins)} コイン`;
      tdCoins.appendChild(span);
    } else {
      tdCoins.textContent = "-";
    }

    const tdMemo = document.createElement("td");
    const texts = [];
    if (entry.hours) texts.push(`[時間] ${entry.hours}`);
    if (entry.memo) texts.push(entry.memo);
    tdMemo.textContent = texts.join(" / ") || "-";

    const tdActions = document.createElement("td");
    tdActions.className = "text-right";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-sm";
    editBtn.type = "button";
    editBtn.textContent = "編集";
    editBtn.addEventListener("click", () => {
      enterEntryEditMode(tr, entry);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn-sm danger";
    delBtn.type = "button";
    delBtn.textContent = "削除";
    delBtn.style.marginLeft = "6px";
    delBtn.addEventListener("click", () => {
      if (!confirm(`${entry.date} のデータを削除しますか？`)) return;
      state.entries = state.entries.filter(e => e.id !== entry.id);
      saveState();
      updateAll();
    });

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdDate);
    tr.appendChild(tdDrp);
    tr.appendChild(tdCoins);
    tr.appendChild(tdMemo);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  }
}

function enterEntryEditMode(tr, entry) {
  tr.innerHTML = "";

  // 日付
  const tdDate = document.createElement("td");
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = entry.date || "";
  tdDate.appendChild(dateInput);

  // ＋
  const tdDrp = document.createElement("td");
  tdDrp.className = "text-right";
  const drpSelect = document.createElement("select");
  [1, 2, 4, 6].forEach(p => {
    const opt = document.createElement("option");
    opt.value = String(p);
    opt.textContent = `＋${p}`;
    if (Number(entry.drp) === p) opt.selected = true;
    drpSelect.appendChild(opt);
  });
  tdDrp.appendChild(drpSelect);

  // コイン
  const tdCoins = document.createElement("td");
  tdCoins.className = "text-right";
  const coinsInput = document.createElement("input");
  coinsInput.type = "number";
  coinsInput.min = "0";
  coinsInput.placeholder = "コイン";
  coinsInput.value = entry.coins ? String(entry.coins) : "";
  coinsInput.style.maxWidth = "140px";
  tdCoins.appendChild(coinsInput);

  // メモ
  const tdMemo = document.createElement("td");
  const memoInput = document.createElement("input");
  memoInput.type = "text";
  memoInput.placeholder = "時間/メモ";
  const texts = [];
  if (entry.hours) texts.push(entry.hours);
  if (entry.memo) texts.push(entry.memo);
  memoInput.value = texts.join(" / ");
  tdMemo.appendChild(memoInput);

  // 操作
  const tdActions = document.createElement("td");
  tdActions.className = "text-right";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-sm";
  saveBtn.type = "button";
  saveBtn.textContent = "保存";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-sm";
  cancelBtn.type = "button";
  cancelBtn.textContent = "取消";
  cancelBtn.style.marginLeft = "6px";

  saveBtn.addEventListener("click", () => {
    const newDate = dateInput.value;
    const newDrp = sanitizePlus(drpSelect.value);
    const newCoins = coinsInput.value ? Number(coinsInput.value) : 0;

    // hoursとmemoは簡易的にまとめ入力扱いでもOK
    const mergedMemo = memoInput.value.trim();

    // 同日統合（date基準で1本化運用）
    // いったん元idレコードを除外
    state.entries = (state.entries || []).filter(e => e.id !== entry.id);

    upsertEntryByDate(newDate, {
      drp: newDrp,
      coins: newCoins,
      hours: "",        // 必要なら分けてUI作る
      memo: mergedMemo
    });

    saveState();
    updateAll();
  });

  cancelBtn.addEventListener("click", () => updateAll());

  tdActions.appendChild(saveBtn);
  tdActions.appendChild(cancelBtn);

  tr.appendChild(tdDate);
  tr.appendChild(tdDrp);
  tr.appendChild(tdCoins);
  tr.appendChild(tdMemo);
  tr.appendChild(tdActions);
}

function setupForm() {
  const form = document.getElementById("entryForm");
  const dateInput = document.getElementById("date");
  const drpInput = document.getElementById("drp");
  const coinsInput = document.getElementById("coins");
  const hoursInput = document.getElementById("hours");
  const memoInput = document.getElementById("memo");

  if (!form) return;

  dateInput.value = todayString();

  if (dateInput && dateInput.showPicker) {
    dateInput.addEventListener("focus", () => {
      dateInput.showPicker();
    });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const date = dateInput.value;
    const drp = Number(drpInput.value);
    const coins = coinsInput.value ? Number(coinsInput.value) : 0;
    const hours = hoursInput.value.trim();
    const memo = memoInput.value.trim();

    if (!date || isNaN(drp)) {
      alert("日付と＋数を入力してください。");
      return;
    }
    if (![1, 2, 4, 6].includes(drp)) {
      alert("＋数は 1 / 2 / 4 / 6 のいずれかを選んでください。");
      return;
    }

    upsertEntryByDate(date, {
      drp: sanitizePlus(drp),
      coins,
      hours,
      memo
    });

    saveState();
    updateAll();

    drpInput.value = "1";
    coinsInput.value = "";
    hoursInput.value = "";
    memoInput.value = "";
  });
}
