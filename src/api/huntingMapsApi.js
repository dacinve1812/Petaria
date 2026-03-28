const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** @param {string} token */
export async function fetchAdminHuntingMaps(token) {
  const r = await fetch(`${API_BASE}/api/admin/hunting-maps`, {
    headers: { ...authHeaders(token) },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

/**
 * @param {string} token
 * @param {import('../utils/huntingMapsStorage').HuntingMapRecord} body
 */
export async function createAdminHuntingMap(token, body) {
  const r = await fetch(`${API_BASE}/api/admin/hunting-maps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || r.statusText);
  return data;
}

/**
 * @param {string} token
 * @param {string} id
 * @param {import('../utils/huntingMapsStorage').HuntingMapRecord} body
 */
export async function updateAdminHuntingMap(token, id, body) {
  const r = await fetch(`${API_BASE}/api/admin/hunting-maps/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || r.statusText);
  return data;
}

/**
 * Cập nhật nếu map đã có trong DB; nếu chưa có (PUT 404 — thường gặp khi map chỉ từng lưu local) thì tạo mới (POST).
 * @param {string} token
 * @param {string} id
 * @param {import('../utils/huntingMapsStorage').HuntingMapRecord} body
 */
export async function upsertAdminHuntingMap(token, id, body) {
  const url = `${API_BASE}/api/admin/hunting-maps/${encodeURIComponent(id)}`;
  let r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  let data = await r.json().catch(() => ({}));
  if (r.status === 404) {
    r = await fetch(`${API_BASE}/api/admin/hunting-maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(body),
    });
    data = await r.json().catch(() => ({}));
    if (r.status === 409) {
      r = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(body),
      });
      data = await r.json().catch(() => ({}));
    }
  }
  if (!r.ok) throw new Error(data.message || r.statusText);
  return data;
}

/** @param {string} token @param {string} id */
export async function deleteAdminHuntingMap(token, id) {
  const r = await fetch(`${API_BASE}/api/admin/hunting-maps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token) },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || r.statusText);
  return data;
}

/** Chi tiết map cho game (public) */
export async function fetchPublicHuntingMap(id) {
  const r = await fetch(`${API_BASE}/api/hunting/maps/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  return r.json();
}

/** Danh sách rút gọn (public) */
export async function fetchPublicHuntingMapList() {
  const r = await fetch(`${API_BASE}/api/hunting/maps`);
  if (!r.ok) return [];
  return r.json();
}
