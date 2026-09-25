import React, { useEffect, useMemo, useState } from 'react';
import TemplatePage from './template/TemplatePage';
import './admin/EditItems.css';
import './SystemItemsPage.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const FALLBACK_IMG = '/images/placeholder.png';

const COLUMNS = [
  { key: 'name', label: 'Tên', sortable: true },
  { key: 'image_url', label: 'Hình ảnh', sortable: false },
  { key: 'description', label: 'Mô tả', sortable: true },
  { key: 'magic_value', label: 'Ma thuật', sortable: true },
  { key: 'type', label: 'Loại', sortable: true },
  { key: 'usage', label: 'Công dụng', sortable: true },
  { key: 'rarity', label: 'Độ hiếm', sortable: true },
  { key: 'obtain_method', label: 'Cách sở hữu', sortable: false },
];

const RARITY_ORDER = { common: 1, rare: 2, epic: 3, legendary: 4 };

const TYPE_LABEL_VI = {
  equipment: 'Trang bị',
  consumable: 'Tiêu hao',
  food: 'Thức ăn',
  misc: 'Linh tinh',
  material: 'Nguyên liệu',
  medicine: 'Thuốc',
  potion: 'Thuốc',
  weapon: 'Vũ khí',
  armor: 'Giáp',
  accessory: 'Phụ kiện',
  tool: 'Công cụ',
  quest: 'Nhiệm vụ',
  key: 'Chìa khóa',
  currency: 'Tiền tệ',
  egg: 'Trứng',
  spirit: 'Linh thú',
  scroll: 'Bí kíp',
  book: 'Sách',
  gem: 'Ngọc',
  box: 'Hộp',
  ticket: 'Vé',
};

function normalizeRarity(value) {
  const k = String(value ?? '').trim().toLowerCase();
  if (['common', 'rare', 'epic', 'legendary'].includes(k)) return k;
  if (['legend', 'mythic', 'unique', 'artifact'].includes(k)) return 'legendary';
  if (k === 'uncommon') return 'rare';
  return 'common';
}

function rarityLabel(value) {
  const map = {
    common: 'Thường',
    rare: 'Hiếm',
    epic: 'Cực hiếm',
    legendary: 'Legend',
  };
  return map[normalizeRarity(value)] || 'Thường';
}

function rarityClass(value) {
  return `itemdex-rarity--${normalizeRarity(value)}`;
}

function typeLabelVi(type) {
  const key = String(type ?? '').trim().toLowerCase();
  if (!key) return '—';
  return TYPE_LABEL_VI[key] || String(type).trim();
}

function itemImageSrc(imageUrl) {
  if (!imageUrl) return FALLBACK_IMG;
  const s = String(imageUrl);
  if (s.startsWith('/') || s.startsWith('http')) return s;
  return `/images/equipments/${s}`;
}

function SystemItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/itemdex`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || body.message || 'Không tải được danh mục');
        return Array.isArray(body) ? body : [];
      })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Lỗi kết nối');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const filteredSorted = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = !q
      ? [...items]
      : items.filter((item) => {
          const hay = [
            item.id,
            item.item_code,
            item.name,
            item.description,
            item.type,
            typeLabelVi(item.type),
            item.subtype,
            item.rarity,
            rarityLabel(item.rarity),
            item.usage,
            item.magic_value,
          ]
            .map((v) => String(v ?? '').toLowerCase())
            .join(' ');
          return hay.includes(q);
        });

    list.sort((a, b) => {
      const key = sortConfig.key;
      let av;
      let bv;
      if (key === 'rarity') {
        av = RARITY_ORDER[normalizeRarity(a.rarity)] || 0;
        bv = RARITY_ORDER[normalizeRarity(b.rarity)] || 0;
      } else if (key === 'type') {
        av = typeLabelVi(a.type);
        bv = typeLabelVi(b.type);
      } else if (key === 'magic_value') {
        av = a.magic_value == null ? -Infinity : Number(a.magic_value);
        bv = b.magic_value == null ? -Infinity : Number(b.magic_value);
      } else if (key === 'obtain_method') {
        av = a.obtain_method || '';
        bv = b.obtain_method || '';
      } else {
        av = a[key];
        bv = b[key];
      }

      const aNum = Number(av);
      const bNum = Number(bv);
      let cmp = 0;
      if (
        key === 'rarity' ||
        key === 'magic_value' ||
        (Number.isFinite(aNum) &&
          Number.isFinite(bNum) &&
          String(av).trim() !== '' &&
          String(bv).trim() !== '')
      ) {
        cmp = aNum - bNum;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'vi', { sensitivity: 'base' });
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [items, searchTerm, sortConfig]);

  return (
    <TemplatePage showTabs={false} showSearch={false}>
      <div className="itemdex-page">
        <div className="itemdex-header">
          <div>
            <h2 className="itemdex-title">Hệ thống vật phẩm</h2>
            <p className="itemdex-subtitle">
              Danh mục toàn bộ vật phẩm trong Petaria
              {!loading ? ` · ${filteredSorted.length}/${items.length}` : ''}
            </p>
          </div>
        </div>

        <div className="section-actions edit-items-toolbar itemdex-toolbar">
          <div className="edit-items-toolbar-right">
            <input
              type="text"
              className="edit-items-search-input"
              placeholder="Search (id, item_code, name, subtype...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? <p className="itemdex-status">Đang tải danh mục…</p> : null}
        {error ? <p className="itemdex-status itemdex-status--error">{error}</p> : null}

        {!loading && !error && (
          <div className="itemdex-table-wrap">
            <table className="itemdex-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={col.sortable ? 'is-sortable' : undefined}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      {col.label}
                      {col.sortable ? sortIndicator(col.key) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSorted.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="itemdex-empty">
                      Không tìm thấy vật phẩm phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredSorted.map((item) => (
                    <tr key={item.id}>
                      <td className="itemdex-name" data-label="Tên">
                        {item.name || '—'}
                      </td>
                      <td className="itemdex-image-cell" data-label="Hình ảnh">
                        <img
                          className="itemdex-image"
                          src={itemImageSrc(item.image_url)}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_IMG;
                          }}
                        />
                      </td>
                      <td className="itemdex-desc" data-label="Mô tả">
                        {item.description || '—'}
                      </td>
                      <td className="itemdex-magic" data-label="Ma thuật">
                        {item.magic_value != null && Number.isFinite(Number(item.magic_value))
                          ? Number(item.magic_value)
                          : '—'}
                      </td>
                      <td className="itemdex-type" data-label="Loại">
                        {typeLabelVi(item.type)}
                      </td>
                      <td className="itemdex-usage" data-label="Công dụng">
                        {item.usage || '—'}
                      </td>
                      <td data-label="Độ hiếm">
                        <span className={`itemdex-rarity ${rarityClass(item.rarity)}`}>
                          {rarityLabel(item.rarity)}
                        </span>
                      </td>
                      <td className="itemdex-obtain" data-label="Cách sở hữu">
                        {item.obtain_method || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TemplatePage>
  );
}

export default SystemItemsPage;
