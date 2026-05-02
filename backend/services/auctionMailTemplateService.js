const db = require('../config/database');

/** Placeholder dùng khi render: {{item_name}}, {{amount_fmt}}, {{currency_label}} */
const TEMPLATE_META = [
  {
    key: 'settle_no_bids_seller',
    labelVi: 'Hết giờ — không ai bid (người bán)',
    labelEn: 'Ended — no bids (seller)',
    placeholders: ['item_name'],
  },
  {
    key: 'settle_win_seller',
    labelVi: 'Hết giờ — bán thành công (người bán, có đính kèm tiền)',
    labelEn: 'Ended — sold (seller, currency attached)',
    placeholders: ['item_name', 'amount_fmt', 'currency_label'],
  },
  {
    key: 'settle_win_buyer',
    labelVi: 'Hết giờ — trúng đấu giá (người mua)',
    labelEn: 'Ended — you won the auction',
    placeholders: ['item_name', 'amount_fmt', 'currency_label'],
  },
  {
    key: 'buy_now_seller',
    labelVi: 'Mua ngay — người bán (có đính kèm tiền)',
    labelEn: 'Buy now — seller (currency attached)',
    placeholders: ['item_name', 'amount_fmt', 'currency_label'],
  },
  {
    key: 'buy_now_buyer',
    labelVi: 'Mua ngay — người mua',
    labelEn: 'Buy now — buyer',
    placeholders: ['item_name', 'amount_fmt', 'currency_label'],
  },
  {
    key: 'outbid_refund',
    labelVi: 'Có người bid cao hơn — hoàn tiền bid trước',
    labelEn: 'Outbid — previous bid refunded',
    placeholders: ['item_name', 'refund_fmt', 'currency_label', 'new_bid_fmt'],
  },
  {
    key: 'buy_now_refund_bidder',
    labelVi: 'Mua ngay — hoàn tiền cho người đã bid (không phải người mua)',
    labelEn: 'Buy now — bid refunded (outbid by instant purchase)',
    placeholders: ['item_name', 'refund_fmt', 'currency_label', 'buy_now_fmt'],
  },
];

const DEFAULTS = {
  vi: {
    settle_no_bids_seller: {
      subject: 'Phiên đấu giá kết thúc — không có người đấu giá',
      message:
        `Phiên đấu giá đã kết thúc nhưng không có lượt đấu giá nào.\n` +
        `Vật đã đăng: {{item_name}}.\n` +
        `Vật phẩm / tiền ký gửi đã được trả về tài khoản của bạn.`,
    },
    settle_win_seller: {
      subject: 'Bán đấu giá thành công',
      message:
        `Chúc mừng! Bạn đã bán thành công {{item_name}}.\n` +
        `Số tiền nhận được: {{amount_fmt}} {{currency_label}}.\n` +
        `Phần thưởng (tiền) đã đính kèm trong thư — vui lòng mở thư và nhấn nhận thưởng.`,
    },
    settle_win_buyer: {
      subject: 'Trúng đấu giá',
      message: `Chúc mừng bạn đã đấu giá thành công {{item_name}} với giá {{amount_fmt}} {{currency_label}}.`,
    },
    buy_now_seller: {
      subject: 'Mua ngay — bán thành công',
      message:
        `Chúc mừng! Có người chơi đã mua ngay {{item_name}}.\n` +
        `Bạn nhận được {{amount_fmt}} {{currency_label}}.\n` +
        `Phần thưởng (tiền) đính kèm thư — vui lòng mở thư và nhấn nhận thưởng.`,
    },
    buy_now_buyer: {
      subject: 'Mua đấu giá thành công',
      message: `Chúc mừng bạn đã đấu giá thành công {{item_name}} với giá {{amount_fmt}} {{currency_label}}.`,
    },
    outbid_refund: {
      subject: 'Đấu giá — có người đặt giá cao hơn',
      message:
        `Phiên đấu giá: {{item_name}}.\n` +
        `Đã có người chơi khác đặt giá cao hơn bạn (giá mới trên sàn: {{new_bid_fmt}} {{currency_label}}).\n` +
        `Số tiền bạn đã đặt trước đó ({{refund_fmt}} {{currency_label}}) đã được hoàn trực tiếp vào số dư {{currency_label}} của bạn.`,
    },
    buy_now_refund_bidder: {
      subject: 'Đấu giá — có người mua ngay',
      message:
        `Phiên đấu giá: {{item_name}}.\n` +
        `Một người chơi khác đã mua ngay với giá {{buy_now_fmt}} {{currency_label}}; phiên đấu giá đã kết thúc.\n` +
        `Tổng số tiền bạn đã đặt giá ({{refund_fmt}} {{currency_label}}) đã được hoàn trực tiếp vào số dư {{currency_label}} của bạn.`,
    },
  },
  en: {
    settle_no_bids_seller: {
      subject: 'Auction ended — no bids',
      message:
        `The auction has ended with no bids.\n` +
        `Listed asset: {{item_name}}.\n` +
        `Your listing / escrow has been returned to your account.`,
    },
    settle_win_seller: {
      subject: 'Sold successfully',
      message:
        `Congratulations! You sold {{item_name}}.\n` +
        `Amount: {{amount_fmt}} {{currency_label}}.\n` +
        `Currency is attached to this mail — open the mail and claim the reward.`,
    },
    settle_win_buyer: {
      subject: 'You won',
      message: `Congratulations! You won the auction for {{item_name}} at {{amount_fmt}} {{currency_label}}.`,
    },
    buy_now_seller: {
      subject: 'Buy now — sold',
      message:
        `Someone bought now: {{item_name}}.\n` +
        `You receive {{amount_fmt}} {{currency_label}}.\n` +
        `Currency is attached — open the mail and claim.`,
    },
    buy_now_buyer: {
      subject: 'Buy now successful',
      message: `Congratulations! You successfully bought {{item_name}} for {{amount_fmt}} {{currency_label}}.`,
    },
    outbid_refund: {
      subject: 'Auction — you were outbid',
      message:
        `Auction: {{item_name}}.\n` +
        `Another player placed a higher bid (new top bid: {{new_bid_fmt}} {{currency_label}}).\n` +
        `Your previous bid ({{refund_fmt}} {{currency_label}}) has been refunded directly to your {{currency_label}} balance.`,
    },
    buy_now_refund_bidder: {
      subject: 'Auction — sold via buy now',
      message:
        `Auction: {{item_name}}.\n` +
        `Another player used buy now at {{buy_now_fmt}} {{currency_label}}; the auction has ended.\n` +
        `Your bid total ({{refund_fmt}} {{currency_label}}) has been refunded directly to your {{currency_label}} balance.`,
    },
  },
};

function renderTemplate(str, vars) {
  if (str == null) return '';
  let out = String(str);
  const v = vars && typeof vars === 'object' ? vars : {};
  for (const [k, val] of Object.entries(v)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
    out = out.replace(re, String(val ?? ''));
  }
  return out;
}

async function ensureAuctionMailTemplatesTable(runner = db) {
  await runner.query(`
    CREATE TABLE IF NOT EXISTS auction_mail_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_key VARCHAR(64) NOT NULL,
      locale VARCHAR(8) NOT NULL DEFAULT 'vi',
      subject VARCHAR(500) NOT NULL,
      message MEDIUMTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_auction_mail_key_locale (template_key, locale)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function normalizeLocale(locale) {
  const l = String(locale || 'vi').toLowerCase();
  return l === 'en' ? 'en' : 'vi';
}

async function getAuctionMailContent(runner, templateKey, locale = 'vi') {
  const loc = normalizeLocale(locale);
  const [rows] = await runner.query(
    'SELECT subject, message FROM auction_mail_templates WHERE template_key = ? AND locale = ? LIMIT 1',
    [templateKey, loc]
  );
  if (rows.length) {
    return { subject: rows[0].subject, message: rows[0].message, source: 'db' };
  }
  const def =
    (DEFAULTS[loc] && DEFAULTS[loc][templateKey]) ||
    (DEFAULTS.vi && DEFAULTS.vi[templateKey]) || { subject: '', message: '' };
  return { subject: def.subject, message: def.message, source: 'default' };
}

async function buildAuctionMail(runner, templateKey, locale, vars) {
  const loc = normalizeLocale(locale);
  const { subject, message } = await getAuctionMailContent(runner, templateKey, loc);
  return {
    subject: renderTemplate(subject, vars),
    message: renderTemplate(message, vars),
  };
}

async function getTemplateCatalog(runner, locale = 'vi') {
  const loc = normalizeLocale(locale);
  const [rows] = await runner.query(
    'SELECT template_key, subject, message FROM auction_mail_templates WHERE locale = ?',
    [loc]
  );
  const fromDb = Object.fromEntries((rows || []).map((r) => [r.template_key, r]));

  const templates = TEMPLATE_META.map((meta) => {
    const row = fromDb[meta.key];
    const def = DEFAULTS[loc][meta.key] || DEFAULTS.vi[meta.key];
    return {
      template_key: meta.key,
      label: loc === 'en' ? meta.labelEn : meta.labelVi,
      placeholders: meta.placeholders,
      subject: row ? row.subject : def.subject,
      message: row ? row.message : def.message,
      usesDatabase: !!row,
    };
  });

  return { locale: loc, templates };
}

async function upsertTemplates(runner, locale, templates) {
  const loc = normalizeLocale(locale);
  if (!Array.isArray(templates)) {
    throw new Error('templates must be an array');
  }
  const allowed = new Set(TEMPLATE_META.map((m) => m.key));
  for (const t of templates) {
    const key = t.template_key;
    if (!key || !allowed.has(key)) continue;
    const subject = String(t.subject ?? '').slice(0, 500);
    const message = String(t.message ?? '');
    await runner.query(
      `INSERT INTO auction_mail_templates (template_key, locale, subject, message)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE subject = VALUES(subject), message = VALUES(message)`,
      [key, loc, subject, message]
    );
  }
}

module.exports = {
  TEMPLATE_META,
  DEFAULTS,
  renderTemplate,
  ensureAuctionMailTemplatesTable,
  getAuctionMailContent,
  buildAuctionMail,
  getTemplateCatalog,
  upsertTemplates,
  normalizeLocale,
};
