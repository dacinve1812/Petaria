/**
 * Nội dung mặc định cho 4 khối trang chủ (Thông Báo, Diễn đàn, Lưu ý, World Map).
 * Thông Báo, Diễn đàn, Lưu ý dùng mảng items[] (label/link/text/color/isNew); World Map giữ HTML.
 */

/** @typedef {{ text: string, link?: string, color?: string, isNew?: boolean, prefix?: string }} ContentBlockItem */

const NOTICE_ITEMS = [
  { prefix: 'Event', text: 'KM nạp Petagold qua thẻ cào và thưởng peta, exp khi train pet', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=1059984&postcount=75', color: 'red', isNew: true },
  { prefix: 'Tính năng', text: 'Giới hạn 3 tài khoản/1 IP', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=934402&postcount=59', color: 'red', isNew: true },
  { prefix: 'Tính năng', text: 'Cấp độ, Điểm kinh nghiệm người chơi', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=924284&postcount=54', color: 'red' },
  { prefix: 'Auto', text: 'Auto luyện cấp dành cho trình duyệt Firefox / Internet Explorer', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=920496&postcount=14', color: 'red' },
  { prefix: 'News', text: 'Phóng thích thú cưng nhận peta', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=870541&postcount=49', color: 'red' },
  { prefix: 'Event', text: 'Nhiệm vụ Thần thú', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=830783&postcount=21', color: 'red' },
  { prefix: 'Đấu giá', text: 'Sàn đấu giá đặc biệt', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showthread.php?goto=newpost&t=62062', color: 'red' },
  { prefix: 'Event', text: 'Khiên hoàng kim thiên giáp', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=812698&postcount=20', color: 'red' },
  { prefix: 'Tính năng', text: 'Tính năng đoạt vũ khí của đối phương', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=781751&postcount=42', color: 'red' },
  { prefix: 'Tính năng', text: 'Hệ thống đăng ký nhân đôi điểm kinh nghiệm', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=532887&postcount=30', color: 'red' },
  { prefix: 'News', text: 'Vấn đề về giao dịch và giải quyết tranh chấp', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showthread.php?p=383696#post383696', color: 'red' },
  { prefix: 'Cảnh báo', text: 'Trình trang lừa đảo, gian lận trên Petaria', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showthread.php?p=166406#post166406', color: 'red' },
  { prefix: 'Thông báo', text: 'Lợi ích Người giới thiệu', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showthread.php?p=158071#post158071', color: 'red' },
];

const FORUM_ITEMS = [
  { text: 'Trao đổi, giao lưu với các thành viên khác thông qua forum', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum', color: 'orange' },
  { text: 'Các vấn đề về giao dịch', link: 'https://web.archive.org/web/20140329030556/http://vnpet.com/forum/showthread.php?t=34658', color: 'orange' },
  { text: 'Đăng ký giao dịch ngoài chức năng của web', link: 'https://web.archive.org/web/20140329030556/http://vnpet.com/forum/showthread.php?t=70908', color: 'orange' },
  { text: 'Tình trạng lừa đảo, gian lận trên Petaria', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showthread.php?p=166406#post166406', color: 'orange' },
  { text: 'Giới hạn đăng nhập 3 tài khoản/1 IP/1 ngày:', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=934402&postcount=59', color: 'orange' },
  { text: 'Hỏi đáp các vấn đề trong game', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/forumdisplay.php?f=57', color: 'orange' },
  { text: 'Ý kiến của cư dân', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/forumdisplay.php?f=24', color: 'orange' },
];

const NOTES_ITEMS = [
  { text: 'Lợi ích người giới thiệu', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showthread.php?p=158071#post158071', color: 'orange' },
  { text: 'Cấp độ, điểm kinh nghiệm người chơi', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=924284&postcount=54', color: 'orange' },
  { text: 'Ngày vàng phóng thích thú cưng', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=870541&postcount=49', color: 'orange' },
  { text: 'Tính năng đoạt vũ khí đối phương', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=781751&postcount=42', color: 'orange' },
  { text: '5. Đăng ký nhân đôi điểm kinh nghiệm', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=532887&postcount=30', color: 'orange' },
  { text: 'Auto luyện cấp dành cho trình duyệt Firefox / Internet Explorer', link: 'https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=920496&postcount=14', color: 'orange' },
];

export const DEFAULT_CONTENT_BLOCKS = {
  notice: { items: NOTICE_ITEMS },
  forum: { items: FORUM_ITEMS },
  notes: { items: NOTES_ITEMS },
  worldmap: {
    html: `<div style="text-align:center">
  <font color="darkgreen" size="+1"><b><a href="#"><img src="/map.png" alt="PETARIA WORLD MAP" height="290" style="max-width:100%;height:auto"><br>&lt;&lt;&lt; PETARIA WORLD MAP &gt;&gt;&gt;</a></b></font>
</div>`,
    css: `.homepage-block-worldmap {
  position: relative;
  z-index: 5;
  padding: 12px;
}
.homepage-block-worldmap a {
  text-decoration: underline;
}`,
  },
};

export const CONTENT_BLOCK_KEYS = ['notice', 'forum', 'notes', 'worldmap'];
export const CONTENT_BLOCK_LABELS = {
  notice: 'Nội dung Thông Báo',
  forum: 'Nội dung Thông tin Diễn đàn',
  notes: 'Nội dung Lưu ý',
  worldmap: 'Nội dung World Map',
};

/** Block dùng danh sách items (notice, forum, notes) */
export const LIST_BLOCK_KEYS = ['notice', 'forum', 'notes'];
