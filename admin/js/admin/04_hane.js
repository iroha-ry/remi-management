// =====================
// 跳ねカウント
// =====================

let haneTimerId = null;

function startHaneCounter() {
  const el = document.getElementById("haneSecondDisplay");
  if (!el) return;

  if (haneTimerId) {
    clearInterval(haneTimerId);
    haneTimerId = null;
  }

  const update = () => {
    const now = new Date();
    const sec = now.getSeconds();       // 0〜59（実際の秒）
    const remaining = 59 - sec;         // 59→0 のカウントダウン表示

    const text = String(remaining).padStart(2, "0");
    el.textContent = text;

    // 最後の10秒（09〜00）のときだけ大きく光らせる
    if (remaining <= 9) {
      el.classList.add("hane-boost");
    } else {
      el.classList.remove("hane-boost");
    }
  };

  update();
  haneTimerId = setInterval(update, 1000);
}

function setupHaneCounter() {
  startHaneCounter();
}
