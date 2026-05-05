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
        description: 'Ông nhà giàu cho 100–5000 Peta, mỗi 6 giờ một lần.',
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
      ticketPrice3: 10,
      ticketPrice5: 25,
      matchCountToWin3: 3,
      matchCountToWin5: 3,
      symbols: [
        { id: 'sym_apple', label: 'Táo', emoji: '🍎', imageUrl: '' },
        { id: 'sym_star', label: 'Sao', emoji: '⭐', imageUrl: '' },
        { id: 'sym_gift', label: 'Quà', emoji: '🎁', imageUrl: '' },
        { id: 'sym_gem', label: 'Ngọc', emoji: '💎', imageUrl: '' },
        { id: 'sym_moon', label: 'Trăng', emoji: '🌙', imageUrl: '' },
      ],
    },
    mysteryBox: {
      outcomes: [
        { id: 'o1', label: 'Thuốc nhỏ', rarity: 'Thường', weight: 40, itemId: null },
        { id: 'o2', label: 'Mảnh quặng', rarity: 'Thường', weight: 30, itemId: null },
        { id: 'o3', label: 'Rương xanh', rarity: 'Hiếm', weight: 18, itemId: null },
        { id: 'o4', label: 'Pet shard SSR', rarity: 'SSR', weight: 8, itemId: null },
        { id: 'o5', label: 'Skin cực hiếm', rarity: 'SSR', weight: 4, itemId: null },
      ],
    },
    beggarKing: {
      minPeta: 100,
      maxPeta: 5000,
      cooldownHours: 6,
    },
    dailyFree: {
      tiers: [
        { id: 't1', tierLabel: 'Thường', itemLabel: 'Gói thức ăn C', itemId: null, dailyWeight: 50 },
        { id: 't2', tierLabel: 'Hiếm', itemLabel: 'Hộp ngẫu nhiên B', itemId: null, dailyWeight: 35 },
        { id: 't3', tierLabel: 'Siêu hiếm', itemLabel: 'Rương A', itemId: null, dailyWeight: 15 },
      ],
    },
    luckyBooth: {
      dailyResetEnabled: true,
      ticketPrice: 1,
      jackpotPeta: 10000,
    },
    slotMachine: {
      reelIcons: [
        { id: 'cherry', label: 'Cherry', emoji: '🍒', imageUrl: '' },
        { id: 'bell', label: 'Bell', emoji: '🔔', imageUrl: '' },
        { id: 'star', label: 'Star', emoji: '⭐', imageUrl: '' },
        { id: 'gem', label: 'Gem', emoji: '💎', imageUrl: '' },
        { id: 'seven', label: 'Seven', emoji: '7️⃣', imageUrl: '' },
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
    out.scratchLottery = {
      ...defaults.scratchLottery,
      ...stored.scratchLottery,
      symbols: Array.isArray(stored.scratchLottery.symbols) && stored.scratchLottery.symbols.length
        ? stored.scratchLottery.symbols
        : defaults.scratchLottery.symbols,
    };
  }

  if (stored.mysteryBox && isPlainObject(stored.mysteryBox)) {
    out.mysteryBox = {
      ...defaults.mysteryBox,
      outcomes: Array.isArray(stored.mysteryBox.outcomes) && stored.mysteryBox.outcomes.length
        ? stored.mysteryBox.outcomes
        : defaults.mysteryBox.outcomes,
    };
  }

  if (stored.beggarKing && isPlainObject(stored.beggarKing)) {
    out.beggarKing = { ...defaults.beggarKing, ...stored.beggarKing };
  }

  if (stored.dailyFree && isPlainObject(stored.dailyFree)) {
    out.dailyFree = {
      ...defaults.dailyFree,
      tiers: Array.isArray(stored.dailyFree.tiers) && stored.dailyFree.tiers.length
        ? stored.dailyFree.tiers
        : defaults.dailyFree.tiers,
    };
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
