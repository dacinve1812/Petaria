# TaxonomyFilterModal — hướng dẫn dùng

Tài liệu tách riêng để tra cứu nhanh component **`TaxonomyFilterModal`** và helper **`filterByTaxonomySelection`**. Liên quan schema item / `item_code`: xem `ITEM_SYSTEM_V2_MIGRATION.md`.

---

## Mục đích

- Modal bộ lọc dạng **pill**, nhiều **section** (ví dụ: Type, Category, Subtype).
- Mỗi section: **multi-select**; danh sách rỗng trong section = **không lọc** theo section đó (tương đươn “Tất cả”).
- Giữa các section: điều kiện **AND** (item phải thỏa mọi section đang có chọn).

File nguồn:

- `src/components/filters/TaxonomyFilterModal.js`
- `src/components/filters/TaxonomyFilterModal.css`

---

## Import

```javascript
import TaxonomyFilterModal, { filterByTaxonomySelection } from '../filters/TaxonomyFilterModal';
```

Điều chỉnh đường dẫn `../` tùy vị trí file (ví dụ từ `src/components/admin/` → `../filters/`).

---

## Props của `TaxonomyFilterModal`

| Prop | Kiểu | Mô tả |
|------|------|--------|
| `open` | `boolean` | `true` khi hiển thị modal |
| `onClose` | `() => void` | Đóng modal (overlay, nút ×, sau khi Áp dụng — component đã gọi `onClose` sau `onApply`) |
| `title` | `string` (tuỳ chọn) | Tiêu đề modal, mặc định `'Bộ lọc'` |
| `sections` | `FilterSection[]` | Cấu hình từng nhóm pill (xem dưới) |
| `value` | `Record<string, string[]>` | Trạng thái đang áp dụng: mỗi key = `section.id`, value = mảng `value` đã chọn |
| `onApply` | `(next: Record<string, string[]>) => void` | Gọi khi bấm **Áp dụng**; nhận object selection mới rồi đóng modal |

### Kiểu `FilterSection`

```typescript
// Tham chiếu — project có thể không dùng TypeScript
type FilterSection = {
  id: string;       // phải trùng key trong `value` / selection
  title: string;    // nhãn hiển thị (vd "Type")
  options: { value: string; label: string }[];
};
```

- `id` nên là tên trường dữ liệu hoặc id ổn định (`type`, `category`, `subtype`, …).
- `label` hiển thị trên pill; thường trùng `value` hoặc là nhãn thân thiện.

---

## Helper `filterByTaxonomySelection`

```javascript
filterByTaxonomySelection(rows, selection, fieldMap)
```

| Tham số | Mô tả |
|---------|--------|
| `rows` | Mảng object (ví dụ danh sách item) |
| `selection` | Cùng shape với `value` của modal: `{ type: ['booster'], category: [], subtype: ['def_boost'] }` |
| `fieldMap` | Map **section id** → **tên field trên mỗi row**: `{ type: 'type', category: 'category', subtype: 'subtype' }` |

- Với mỗi section, nếu mảng chọn **rỗng** → bỏ qua section đó.
- Nếu mảng **không rỗng** → row phải có `row[field]` (chuỗi hóa) nằm trong mảng đó.
- Các section có chọn được kết hợp bằng **AND**.

Ví dụ:

```javascript
const selection = {
  type: ['booster', 'equipment'],
  category: [],
  subtype: ['def_boost'],
};

const filtered = filterByTaxonomySelection(items, selection, {
  type: 'type',
  category: 'category',
  subtype: 'subtype',
});
// → item.type là booster HOẶC equipment, VÀ subtype === 'def_boost'
```

---

## State tối thiểu trên màn hình cha

1. Mở/đóng modal: `const [open, setOpen] = useState(false)`.
2. Bộ lọc đang áp dụng (đồng bộ với `value` của modal):

```javascript
const [taxonomyFilter, setTaxonomyFilter] = useState({
  type: [],
  category: [],
  subtype: [],
});
```

3. `sections` nên **`useMemo`** theo dữ liệu nguồn (tránh re-render reset draft modal không cần thiết). Ví dụ build `options` từ tập `type` / `category` / `subtype` duy nhất của danh sách đang có.

---

## Luồng tích hợp (mẫu)

```javascript
const filterSections = useMemo(
  () => [
    {
      id: 'type',
      title: 'Type',
      options: uniqueTypes.map((v) => ({ value: v, label: v })),
    },
    {
      id: 'category',
      title: 'Category',
      options: uniqueCategories.map((v) => ({ value: v, label: v })),
    },
    {
      id: 'subtype',
      title: 'Subtype',
      options: uniqueSubtypes.map((v) => ({ value: v, label: v })),
    },
  ],
  [uniqueTypes, uniqueCategories, uniqueSubtypes]
);

const displayRows = useMemo(() => {
  let rows = /* ... search hoặc nguồn gốc ... */;
  rows = filterByTaxonomySelection(rows, taxonomyFilter, {
    type: 'type',
    category: 'category',
    subtype: 'subtype',
  });
  return rows;
}, [rowsSource, taxonomyFilter /* + deps search */]);

return (
  <>
    <button type="button" onClick={() => setOpen(true)}>Bộ lọc</button>
    <TaxonomyFilterModal
      open={open}
      onClose={() => setOpen(false)}
      title="Lọc taxonomy"
      sections={filterSections}
      value={taxonomyFilter}
      onApply={setTaxonomyFilter}
    />
  </>
);
```

**Tham chiếu thực tế trong repo:** `src/components/admin/EditItems.js` (toolbar Search + nút **Bộ lọc**).

---

## Hành vi UI nhanh

- **Tất cả** trong một section: xóa mọi chọn của section đó (tương đương không lọc theo section).
- **Đặt lại**: tất cả section về rỗng (toàn bộ dữ liệu theo các section đó).
- **Áp dụng**: gọi `onApply(draft)` rồi đóng modal.
- Footer hiển thị số tiêu chí đang chọn trong draft trước khi áp dụng.

---

## Tuỳ biến / mở rộng

- Thêm section mới: thêm phần tử vào `sections`, thêm key trong `useState` ban đầu và trong `fieldMap` của `filterByTaxonomySelection`.
- Field trên row khác `id` section: dùng `fieldMap` map tuỳ ý (ví dụ section `id: 'kind'` → field `item_kind`).
- Style: chỉnh `TaxonomyFilterModal.css`; class gốc có tiền tố `taxonomy-filter-` để tránh đụng global.

---

## Liên kết

- Item system & `item_code`: `docs/ITEM_SYSTEM_V2_MIGRATION.md`
- Ví dụ dùng: Admin **Quản lý Items** — `src/components/admin/EditItems.js`
