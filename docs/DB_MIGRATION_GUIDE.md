# Database Migration Guide

Tài liệu này hướng dẫn cách cập nhật lại dữ liệu pet trong database để khớp với **logic EXP + Level + Stat mới** mỗi khi có thay đổi trong cấu trúc hoặc logic.

## Khi nào cần chạy migration?

Chạy khi bạn đã (nếu có):
- cập nhật bảng EXP (`src/data/exp_table_petaria.json`) theo công thức mới.
- cập nhật công thức tính stat mới.

Và bạn đang có dữ liệu pet thật của user trong bảng `pets`.

## Tổng quan migration sẽ làm gì?

Script `scripts/migratePetsToNewExpAndStats.js` sẽ:
- đọc toàn bộ pet trong bảng `pets` (mặc định chỉ pet của user, không phải NPC)
- tính lại **level** từ `current_exp` theo **EXP table mới**
- normalize `current_exp` tối thiểu bằng `expTable[level]` (tránh progress âm ở UI)
- tính lại **base stats** từ `(base_species, iv, level)` theo công thức mới
- giữ nguyên các bonus hiện có trong `*_added` bằng cách rebuild `final_stats = base_stats + added`
- update lại DB

## Chuẩn bị trước khi chạy

- **Backup DB** (khuyến nghị bắt buộc): export bảng `pets` và `pet_species`.
- Đảm bảo backend có cài dependencies (`mysql2`, `dotenv`) (repo hiện đã có).

## Cấu hình kết nối DB

Script đọc các biến môi trường sau:
- `DB_HOST` (default: `localhost`)
- `DB_USER` (default: `root`)
- `DB_PASSWORD` (default: rỗng)
- `DB_NAME` (default: `petaria`)

Bạn có thể set trong PowerShell trước khi chạy:

```powershell
$env:DB_HOST="localhost"
$env:DB_USER="root"
$env:DB_PASSWORD="your_password"
$env:DB_NAME="petaria"
```

## Chạy thử (không ghi DB)

```powershell
node petaria/scripts/migratePetsToNewExpAndStats.js --dry-run
```

## Chạy thật (ghi DB)

```powershell nếu ở Root (\VNPET - remake)
node petaria/scripts/migratePetsToNewExpAndStats.js
```
```powershell nếu ở \VNPET - remake\petaria
node scripts/migratePetsToNewExpAndStats.js
```

## Nếu DB có trigger trên bảng `pets`

Nếu bạn gặp lỗi dạng:
- `ER_CANT_UPDATE_USED_TABLE_IN_SF_OR_TRG`

thì database của bạn đang có trigger kiểu “AFTER UPDATE” trên `pets` và trigger đó tự `UPDATE pets` (MySQL sẽ chặn).

Bạn có thể chạy migration ở chế độ tự **backup → drop trigger → migrate → restore trigger**:

```powershell
node petaria/scripts/migratePetsToNewExpAndStats.js --drop-pets-triggers
```

## Tuỳ chọn hữu ích

- Chỉ chạy giới hạn N pet đầu tiên:

```powershell
node petaria/scripts/migratePetsToNewExpAndStats.js --limit 50 --dry-run
```

- Bao gồm NPC:

```powershell
node petaria/scripts/migratePetsToNewExpAndStats.js --include-npc --dry-run
```

- Bao gồm cả pet chưa có owner (owner_id NULL):

```powershell
node petaria/scripts/migratePetsToNewExpAndStats.js --include-unowned --dry-run
```

## Lưu ý quan trọng

- Migration này **có thể làm thay đổi level** hàng loạt vì level được suy ra lại từ `current_exp` theo EXP table mới.
- `final_stats` được rebuild theo quy tắc:
  - `base_stats` tính theo công thức mới
  - cộng thêm `*_added` (giữ nguyên bonus hiện có)
- Nếu bạn muốn reset cả `*_added` (tức là làm lại hoàn toàn từ đầu), cần script khác.

