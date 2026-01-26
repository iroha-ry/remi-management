// =====================
// 定数・ランク定義
// =====================

// 1日に取りうる＋値
const ALLOWED_PLUS = [0, 1, 2, 4, 6];

const RANKS = ["D", "C1", "C2", "C3", "B1", "B2", "B3", "A1", "A2", "A3", "A4", "A5", "S", "SS"];

const DEFAULT_RANK_CONFIG = {
  D:  { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 189,    4: 453,    6: 743    } },
  C1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 927,    4: 2428,   6: 6685   } },
  C2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 2488,   4: 5678,   6: 16700  } },
  C3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 5892,   4: 12800,  6: 22000  } },

  B1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 17600,  4: 37600,  6: 84500  } },
  B2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 16800,  4: 42200,  6: 114000 } },
  B3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 28100,  4: 71100,  6: 115000 } },

  A1: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 60100,  4: 99200,  6: 201000 } },
  A2: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 83700,  4: 127000, 6: 297000 } },
  A3: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 102000, 4: 192000, 6: 384000 } },
  A4: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 129000, 4: 238000, 6: 501000 } },
  A5: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 156000, 4: 385000, 6: 606000 } },

  S:  { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 219000, 4: 541000, 6: 770000 } },
  SS: { upThreshold: 18, keepThreshold: 12, plusScore: { 2: 431000, 4: 783000, 6: 1220000} }
};

function calcCoinsFromScore(score) {
  // 目安コイン = ceil(score/3)
  return Math.ceil(Number(score) / 3);
}

function getRankConfig(rank) {
  const base = DEFAULT_RANK_CONFIG[rank] || DEFAULT_RANK_CONFIG["A1"];
  const overrideMap = state.rankConfig || {};
  const override = overrideMap[rank] || {};

  const plusScore = Object.assign({}, base.plusScore, override.plusScore || {});
  const plusCoins = {};

  // +2/+4/+6 の分だけ自動生成（他は不要）
  [2, 4, 6].forEach(p => {
    if (plusScore[p] != null) plusCoins[p] = calcCoinsFromScore(plusScore[p]);
  });

  return {
    upThreshold: override.upThreshold ?? base.upThreshold,
    keepThreshold: override.keepThreshold ?? base.keepThreshold,
    plusScore,
    plusCoins
  };
}
