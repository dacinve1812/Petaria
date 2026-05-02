const fs = require('fs').promises;
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs/auction');
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

function localDateStamp(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function pruneAuctionAdminLogs() {
  let files;
  try {
    files = await fs.readdir(LOG_DIR);
  } catch {
    return;
  }
  const now = Date.now();
  for (const f of files) {
    const m = f.match(/^(\d{4})-(\d{2})-(\d{2})\.jsonl$/);
    if (!m) continue;
    const t = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)).getTime();
    if (now - t > RETENTION_MS) {
      await fs.unlink(path.join(LOG_DIR, f)).catch(() => {});
    }
  }
}

/**
 * Một dòng JSON / file (JSONL) — nhẹ, dễ grep.
 * @param {Record<string, unknown>} record
 */
async function appendAuctionAdminLog(record) {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const fn = `${localDateStamp()}.jsonl`;
    const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n';
    await fs.appendFile(path.join(LOG_DIR, fn), line, 'utf8');
    await pruneAuctionAdminLogs();
  } catch (e) {
    console.error('appendAuctionAdminLog:', e);
  }
}

async function listAuctionLogFiles() {
  try {
    const files = await fs.readdir(LOG_DIR);
    return files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** date YYYY-MM-DD */
async function readAuctionLogDay(date) {
  const safe = String(date || '').replace(/[^\d-]/g, '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return '';
  const p = path.join(LOG_DIR, `${safe}.jsonl`);
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return '';
  }
}

module.exports = {
  LOG_DIR,
  appendAuctionAdminLog,
  pruneAuctionAdminLogs,
  listAuctionLogFiles,
  readAuctionLogDay,
  localDateStamp,
};
