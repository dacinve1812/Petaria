/**
 * Cấu hình mặc định Trung tâm giải trí — merge với DB (site_game_center_config).
 */
function getDefaultGameCenterConfig() {
  return {
    version: 1,
    hubGames: [
      {
        id: 'lucky-wheel',
        path: 'lucky-wheel',
        title: 'Vòng quay may mắn',
        description: 'Luôn có ô Peta và Peta Gold; admin thêm ô vật phẩm.',
        imgSrc: '/images/entertainment/game-tile-placeholder.svg',
      },
      {
        id: 'scratch-lottery',
        path: 'scratch-lottery',
        title: 'Vé số cào',
        description: 'Vé 3 ô và vé 5 ô — cào trùng hình nhận thưởng.',
        imgSrc: '/images/entertainment/game-tile-placeholder.svg',
      },
      {
        id: 'mystery-box',
        path: 'mystery-box',
        title: 'Hộp bí ẩn',
        description: 'Cho vào một vật phẩm, nhận ngẫu nhiên theo độ hiếm.',
        imgSrc: '/images/entertainment/game-tile-placeholder.svg',
      },
      {
        id: 'beggar-king',
        path: 'beggar-king',
        title: 'Vua ăn mày',
        description: 'Ghé Làng Phú Gia xin lì xì từ trưởng làng Richies — mỗi 12 giờ một lần.',
        imgSrc: '/images/entertainment/game-tile-placeholder.svg',
      },
      {
        id: 'daily-free',
        path: 'daily-free',
        title: 'Vật phẩm miễn phí',
        description: 'Mỗi ngày nhận vật phẩm theo bậc hiếm.',
        imgSrc: '/images/entertainment/game-tile-placeholder.svg',
      },
      {
        id: 'lucky-booth',
        path: 'lucky-booth',
        title: 'Xổ số (Lucky booth)',
        description: 'Chọn dãy 4 chữ số, trúng nhận Peta cao.',
        imgSrc: '/images/entertainment/game-tile-placeholder.svg',
      },
      {
        id: 'slot-machine',
        path: 'slot-machine',
        title: 'Máy đánh bạc',
        description: 'Quay icon như casino, nhận quà theo điều kiện.',
        imgSrc: '/images/entertainment/game-tile-placeholder.svg',
      },
      {
        id: 'guess-number',
        path: 'guess-number',
        title: 'Đoán số',
        description: 'So sánh số ẩn với một mốc — cao hơn hay thấp hơn?',
        imgSrc: '/images/entertainment/game-tile-placeholder.svg',
      },
    ],
    luckyWheel: {
      maxPurchasesPerDay: 2,
      petaSlot: {
        id: '__currency_peta',
        currency: 'peta',
        label: 'Peta',
        rarity: 'Tiền tệ',
        weight: 12,
        /** Số Peta nhận khi trúng (min–max; API server có thể random trong khoảng). */
        amountMin: 100,
        amountMax: 500,
      },
      petaGoldSlot: {
        id: '__currency_petagold',
        currency: 'petagold',
        label: 'Peta Gold',
        rarity: 'Tiền tệ',
        weight: 12,
        amountMin: 1,
        amountMax: 5,
      },
      segments: [
        { id: 's1', label: 'Thuốc hồi', rarity: 'Thường', weight: 12, itemId: null, itemImage: '' },
        { id: 's3', label: 'Mảnh tinh thể', rarity: 'Hiếm', weight: 10, itemId: null, itemImage: '' },
        { id: 's4', label: 'Trứng ngẫu nhiên', rarity: 'Hiếm', weight: 10, itemId: null, itemImage: '' },
        { id: 's5', label: 'Skin giới hạn', rarity: 'SSR', weight: 8, itemId: null, itemImage: '' },
        { id: 's7', label: 'Mảnh xương', rarity: 'Thường', weight: 12, itemId: null, itemImage: '' },
        { id: 's8', label: 'Pet event', rarity: 'SSR', weight: 8, itemId: null, itemImage: '' },
      ],
      serverHistory: [
        { user: 'Alice', prize: 'Skin giới hạn', time: '2 phút trước' },
        { user: 'Bão**', prize: '1000 Peta', time: '5 phút trước' },
        { user: 'Cá**', prize: 'Mảnh tinh thể', time: '12 phút trước' },
        { user: 'Dũng', prize: '500 Peta', time: '1 giờ trước' },
      ],
    },
    scratchLottery: {
      /**
       * Vé cào luôn "trúng" theo mẫu:
       * - Vé 3 ô: luôn có 2 icon trùng (2-match)
       * - Vé 5 ô: luôn có 3 icon trùng (3-match)
       *
       * Phần thưởng phụ thuộc symbolId được chọn theo weight (tỉ lệ).
       */
      ticket3: {
        pricePeta: 10,
        dailyBuyLimit: 20,
        winMatchCount: 2,
        rewards: [
          { symbolId: 'sym_apple', rewardPeta: 1000, weight: 35 },
          { symbolId: 'sym_star', rewardPeta: 2000, weight: 30 },
          { symbolId: 'sym_gift', rewardPeta: 5000, weight: 20 },
          { symbolId: 'sym_gem', rewardPeta: 8000, weight: 10 },
          { symbolId: 'sym_moon', rewardPeta: 12000, weight: 5 },
        ],
      },
      ticket5: {
        pricePeta: 25,
        dailyBuyLimit: 10,
        winMatchCount: 3,
        rewards: [
          { symbolId: 'sym_apple', rewardPeta: 5000, weight: 35 },
          { symbolId: 'sym_star', rewardPeta: 10000, weight: 30 },
          { symbolId: 'sym_gift', rewardPeta: 25000, weight: 20 },
          { symbolId: 'sym_gem', rewardPeta: 40000, weight: 10 },
          { symbolId: 'sym_moon', rewardPeta: 60000, weight: 5 },
        ],
      },
      symbols: [
        { id: 'sym_apple', label: 'Táo', emoji: '🍎', imageUrl: '' },
        { id: 'sym_star', label: 'Sao', emoji: '⭐', imageUrl: '' },
        { id: 'sym_gift', label: 'Quà', emoji: '🎁', imageUrl: '' },
        { id: 'sym_gem', label: 'Ngọc', emoji: '💎', imageUrl: '' },
        { id: 'sym_moon', label: 'Trăng', emoji: '🌙', imageUrl: '' },
      ],
    },
    mysteryBox: {
      /**
       * Tỉ lệ theo rarity (khớp `items.rarity` sau chuẩn hóa: common | rare | epic | legendary).
       * weight tương đối; khi mở hộp: quay rarity → random 1 item trong DB có đúng rarity đó.
       */
      rarityWeights: [
        { rarity: 'common', weight: 45 },
        { rarity: 'rare', weight: 30 },
        { rarity: 'epic', weight: 18 },
        { rarity: 'legendary', weight: 7 },
      ],
    },
    beggarKing: {
      minPeta: 100,
      maxPeta: 5000,
      cooldownHours: 12,
      /**
       * Script hội thoại — admin sửa trong Game center → Vua ăn mày.
       * Token: {minPeta} {maxPeta} {cooldownHours} {remaining} {amount} {playerName}
       */
      narrative: {
        title: 'Làng Phú Gia',
        speaker: 'Richies',
        portraitSrc: '/images/character/richies.jpg',
        /** false = không dùng ảnh nền (transparent stage) */
        useBackground: false,
        backgroundSrc: '',
        typingMsPerChar: 26,
        claimLabel: 'Xin lì xì',
        lines: [
          'Chào ngươi! Ta là Richies — trưởng làng Phú Gia trên Đảo ngọc trai, giữa Biển địa đàng.',
          'Làng ta rất giàu có, và ta vốn thích lì xì cho khách ghé thăm. Mỗi lần khoảng {minPeta}–{maxPeta} Peta đấy!',
          'Chỉ có điều… khách quá đông, nên mỗi người chỉ được gặp ta một lần mỗi {cooldownHours} giờ thôi nhé.',
        ],
        cooldownLines: [
          'À, lại là ngươi à? Tiếc quá — túi lì xì dành cho ngươi hôm nay đã hết chỗ rồi.',
          'Quay lại sau {remaining} nữa nhé. Ta vẫn ở đây chờ!',
        ],
        rewardLine: 'Ha ha! Cầm lấy {amount} Peta lì xì đi — đừng khách khí với ta!',
      },
    },
    dailyFree: {
      /** Số vật phẩm nhận mỗi lần (random trong [min, max]) */
      minItemsPerClaim: 1,
      maxItemsPerClaim: 3,
      /**
       * Tỉ lệ rarity mỗi “món” trong lần nhận (random item trong catalog đúng rarity).
       * Rarity tối thiểu common (không có tier dưới common).
       */
      rarityWeights: [
        { rarity: 'common', weight: 72 },
        { rarity: 'rare', weight: 20 },
        { rarity: 'epic', weight: 7 },
        { rarity: 'legendary', weight: 1 },
      ],
    },
    luckyBooth: {
      dailyResetEnabled: true,
      /** Giá vé (Peta) — 1 vé / kỳ / người */
      ticketPrice: 10,
      /** Tổng giải jackpot chia đều cho mọi vé trùng số (nếu >1 người trùng) */
      jackpotPeta: 1000000,
    },
    slotMachine: {
      /** Giá quay mỗi lần (Peta) */
      spinPricePeta: 50000,
      /** Tối đa lượt quay / kỳ (theo global_reset_time) */
      maxPlaysPerDay: 10,
      /** Thưởng khi trúng pair (any_pair) */
      pairRewardPeta: 20000,
      reelIcons: [
        { id: 'cherry', label: 'Cherry', emoji: '🍒', imageUrl: '', reward: { kind: 'placeholder', itemId: null, spiritId: null } },
        { id: 'bell', label: 'Bell', emoji: '🔔', imageUrl: '', reward: { kind: 'placeholder', itemId: null, spiritId: null } },
        { id: 'star', label: 'Star', emoji: '⭐', imageUrl: '', reward: { kind: 'placeholder', itemId: null, spiritId: null } },
        { id: 'gem', label: 'Gem', emoji: '💎', imageUrl: '', reward: { kind: 'placeholder', itemId: null, spiritId: null } },
        { id: 'seven', label: 'Seven', emoji: '7️⃣', imageUrl: '', reward: { kind: 'placeholder', itemId: null, spiritId: null } },
      ],
      winRules: [
        {
          id: 'jackpot',
          kind: 'triple_icon',
          iconId: 'seven',
          label: 'Ba 7 — Jackpot',
          rewardDescription: 'Phần thưởng lớn',
        },
        {
          id: 'triple',
          kind: 'triple_same',
          iconId: '',
          label: 'Ba giống nhau',
          rewardDescription: 'Thưởng tốt',
        },
        {
          id: 'pair',
          kind: 'any_pair',
          iconId: '',
          label: 'Hai trùng',
          rewardDescription: 'Thưởng nhỏ',
        },
      ],
    },
    guessNumber: {
      minSecret: 1,
      maxSecret: 99,
      /** Thưởng khi đoán đúng (cao hơn / thấp hơn mốc đúng) */
      rewardPetaWin: 10000,
      /** Trừ Peta khi đoán sai */
      penaltyPetaLose: 5000,
      /** Tối đa số vòng hoàn thành / ngày (theo global_reset_time) */
      maxPlaysPerDay: 10,
    },
  };
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Deep merge: defaults + stored (stored wins on leaves / arrays).
 */
function mergeGameCenterConfig(stored) {
  const defaults = getDefaultGameCenterConfig();
  if (!stored || typeof stored !== 'object') return JSON.parse(JSON.stringify(defaults));

  const out = JSON.parse(JSON.stringify(defaults));

  if (Array.isArray(stored.hubGames) && stored.hubGames.length > 0) {
    out.hubGames = stored.hubGames.map((g, i) => ({
      ...(defaults.hubGames[i] || {}),
      ...g,
    }));
  }

  if (stored.luckyWheel && isPlainObject(stored.luckyWheel)) {
    const sw = stored.luckyWheel;
    const dw = defaults.luckyWheel;
    out.luckyWheel = {
      ...dw,
      ...sw,
      petaSlot: {
        ...dw.petaSlot,
        ...(sw.petaSlot && isPlainObject(sw.petaSlot) ? sw.petaSlot : {}),
      },
      petaGoldSlot: {
        ...dw.petaGoldSlot,
        ...(sw.petaGoldSlot && isPlainObject(sw.petaGoldSlot) ? sw.petaGoldSlot : {}),
      },
      segments: Array.isArray(sw.segments) && sw.segments.length ? sw.segments : dw.segments,
      serverHistory: Array.isArray(sw.serverHistory) ? sw.serverHistory : dw.serverHistory,
    };
  }

  if (stored.scratchLottery && isPlainObject(stored.scratchLottery)) {
    const ss = stored.scratchLottery;
    const ds = defaults.scratchLottery;

    // Back-compat: cấu hình cũ (ticketPrice3/ticketPrice5/matchCount...) → cấu hình mới ticket3/ticket5
    const ticket3FromLegacy =
      !ss.ticket3 && (ss.ticketPrice3 != null || ss.matchCountToWin3 != null)
        ? {
            ...ds.ticket3,
            pricePeta: Number(ss.ticketPrice3 ?? ds.ticket3.pricePeta),
            winMatchCount: Number(ss.matchCountToWin3 ?? ds.ticket3.winMatchCount),
          }
        : null;

    const ticket5FromLegacy =
      !ss.ticket5 && (ss.ticketPrice5 != null || ss.matchCountToWin5 != null)
        ? {
            ...ds.ticket5,
            pricePeta: Number(ss.ticketPrice5 ?? ds.ticket5.pricePeta),
            winMatchCount: Number(ss.matchCountToWin5 ?? ds.ticket5.winMatchCount),
          }
        : null;

    out.scratchLottery = {
      ...ds,
      ...ss,
      ticket3: {
        ...ds.ticket3,
        ...(isPlainObject(ss.ticket3) ? ss.ticket3 : ticket3FromLegacy || {}),
        rewards: Array.isArray(ss.ticket3?.rewards) && ss.ticket3.rewards.length ? ss.ticket3.rewards : ds.ticket3.rewards,
      },
      ticket5: {
        ...ds.ticket5,
        ...(isPlainObject(ss.ticket5) ? ss.ticket5 : ticket5FromLegacy || {}),
        rewards: Array.isArray(ss.ticket5?.rewards) && ss.ticket5.rewards.length ? ss.ticket5.rewards : ds.ticket5.rewards,
      },
      symbols:
        Array.isArray(ss.symbols) && ss.symbols.length
          ? ss.symbols
          : ds.symbols,
    };
  }

  if (stored.mysteryBox && isPlainObject(stored.mysteryBox)) {
    const sm = stored.mysteryBox;
    const dm = defaults.mysteryBox;
    let rarityWeights = dm.rarityWeights;
    if (Array.isArray(sm.rarityWeights) && sm.rarityWeights.length > 0) {
      rarityWeights = sm.rarityWeights.map((row) => ({
        rarity: String(row?.rarity ?? 'common').trim().toLowerCase(),
        weight: Math.max(0, Number(row?.weight) || 0),
      }));
    }
    out.mysteryBox = {
      ...dm,
      ...sm,
      rarityWeights,
    };
    delete out.mysteryBox.outcomes;
  }

  if (stored.beggarKing && isPlainObject(stored.beggarKing)) {
    const sb = stored.beggarKing;
    const db = defaults.beggarKing;
    const sn = isPlainObject(sb.narrative) ? sb.narrative : {};
    const dn = db.narrative || {};
    out.beggarKing = {
      ...db,
      ...sb,
      narrative: {
        ...dn,
        ...sn,
        lines:
          Array.isArray(sn.lines) && sn.lines.length > 0
            ? sn.lines
            : dn.lines,
        cooldownLines:
          Array.isArray(sn.cooldownLines) && sn.cooldownLines.length > 0
            ? sn.cooldownLines
            : dn.cooldownLines,
      },
    };
  }

  if (stored.dailyFree && isPlainObject(stored.dailyFree)) {
    const sd = stored.dailyFree;
    const dd = defaults.dailyFree;
    let rarityWeights = dd.rarityWeights;
    if (Array.isArray(sd.rarityWeights) && sd.rarityWeights.length > 0) {
      rarityWeights = sd.rarityWeights.map((rw) => ({
        rarity: String(rw?.rarity ?? 'common').trim().toLowerCase(),
        weight: Math.max(0, Number(rw?.weight) || 0),
      }));
    }
    let minItems = parseInt(sd.minItemsPerClaim, 10);
    let maxItems = parseInt(sd.maxItemsPerClaim, 10);
    if (!Number.isFinite(minItems) || minItems < 1) minItems = dd.minItemsPerClaim;
    if (!Number.isFinite(maxItems) || maxItems < 1) maxItems = dd.maxItemsPerClaim;
    minItems = Math.max(1, Math.min(20, minItems));
    maxItems = Math.max(minItems, Math.min(20, maxItems));
    out.dailyFree = {
      ...dd,
      ...sd,
      rarityWeights,
      minItemsPerClaim: minItems,
      maxItemsPerClaim: maxItems,
    };
    delete out.dailyFree.tiers;
  }

  if (stored.luckyBooth && isPlainObject(stored.luckyBooth)) {
    out.luckyBooth = { ...defaults.luckyBooth, ...stored.luckyBooth };
  }

  if (stored.slotMachine && isPlainObject(stored.slotMachine)) {
    out.slotMachine = {
      ...defaults.slotMachine,
      ...stored.slotMachine,
      reelIcons: Array.isArray(stored.slotMachine.reelIcons) && stored.slotMachine.reelIcons.length
        ? stored.slotMachine.reelIcons
        : defaults.slotMachine.reelIcons,
      winRules: Array.isArray(stored.slotMachine.winRules) && stored.slotMachine.winRules.length
        ? stored.slotMachine.winRules
        : defaults.slotMachine.winRules,
    };
  }

  if (stored.guessNumber && isPlainObject(stored.guessNumber)) {
    out.guessNumber = { ...defaults.guessNumber, ...stored.guessNumber };
  }

  if (typeof stored.version === 'number') out.version = stored.version;

  return out;
}

/** Giống `src/utils/luckyWheelSegments.js` — thứ tự ô trên đĩa khớp client. */
function buildLuckyWheelSegments(luckyWheel) {
  if (!luckyWheel) return [];
  const ps =
    luckyWheel.petaSlot && String(luckyWheel.petaSlot.currency || '').toLowerCase() === 'peta'
      ? luckyWheel.petaSlot
      : null;
  const pg =
    luckyWheel.petaGoldSlot && String(luckyWheel.petaGoldSlot.currency || '').toLowerCase() === 'petagold'
      ? luckyWheel.petaGoldSlot
      : null;
  const items = Array.isArray(luckyWheel.segments) ? luckyWheel.segments : [];
  if (!ps && !pg) return [...items];
  if (ps && !pg) return [ps, ...items];
  if (!ps && pg) return [pg, ...items];
  const firstCount = Math.ceil(items.length / 2);
  return [ps, ...items.slice(0, firstCount), pg, ...items.slice(firstCount)];
}

module.exports = {
  getDefaultGameCenterConfig,
  mergeGameCenterConfig,
  buildLuckyWheelSegments,
};
