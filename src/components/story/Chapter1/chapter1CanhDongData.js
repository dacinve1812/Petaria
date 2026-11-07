/** Chapter 1 — Những hạt giống thất lạc. Content follows the v0.2 redesign. */

export const ASSET = '/images/story/ch1/';
export const STORY_LENGTH = 8;
export const STAR_EACH = 1;
export const STAR_MAX = STORY_LENGTH;
export const CHEST_MARKS = [2, 4, 8];
export const STORAGE_KEY = 'petaria.ch1.canh-dong.v2';

export const SUMMARY =
  'Một bức thư của Sở Canh Nông đưa người chơi tới Làng Nhân Ái. Hoa vẫn nở, nhưng hạt không nảy mầm vì những Pet mang phấn bị bẫy trên đường di cư. Manh mối dẫn qua Vườn Bách Thảo, Hội Anh Hùng, rồi tới một kho hàng ở Thành Thái Dương.';

export const THEME =
  'Chăm sóc sinh vật yếu hơn, rồi học cách bảo vệ cả cộng đồng. Lợi nhuận không cho phép nhốt sự sống hay làm cả vùng mất mùa.';

const line = (speaker, text) => ({ speaker, text });

export const STAGES = [
  {
    n: 1,
    id: 'lang-nhan-ai',
    kind: 'hub',
    hubId: 'lang-nhan-ai',
    name: 'Bức thư và bông hoa không hạt',
    role: 'normal',
    tags: ['Làng Nhân Ái', 'Cốt truyện'],
    beat: 'Giao thư niêm phong cho Mira. Hoa vẫn nở, nhưng hạt không thức dậy, và Pet mang phấn chưa trở về.',
    lines: [
      line('Mira', 'Cháu đi từ Kinh Đô đến tận đây sao? Đường Hoa vẫn dễ đi chứ?'),
      line('Người chơi', 'Cháu có thư từ Bưu Điện Hoàng Gia gửi cho bà.'),
      line('Mira', 'Hoa vẫn nở, nhưng hạt lại không chịu thức dậy… Ta cứ tưởng chỉ ruộng nhà mình gặp chuyện.'),
      line('Người chơi', 'Vậy chuyện này đang xảy ra khắp nơi ạ?'),
      line('Mira', 'Có lẽ thế. Nhưng điều làm ta lo nhất là những Pet mang phấn hoa đã không trở về.'),
      line('Nhi', 'Bông lúc nào cũng về trước khi trời tối. Hôm nay em chờ mãi…'),
      line('Mira', 'Nó thường bay gần Cầu Hoa. Nhưng mấy hôm nay đàn Pet ở đó không cho ai đến gần.'),
      line('Mira', 'Nếu cháu chưa vội lên đường, giúp ta tìm một người bạn nhỏ được không?'),
    ],
  },
  {
    n: 2,
    id: 'cau-hoa',
    kind: 'encounter',
    name: 'Cầu Hoa',
    role: 'mini',
    tags: ['Mini Boss', 'Giải cứu'],
    beat: 'Thủ Lĩnh Đàn Hoa đang che chở những Pet yếu. Bông mắc trong lồng bỏ lại gần bờ cỏ. Con đầu đàn không phải kẻ bắt cóc.',
    lines: [
      line('Người kể chuyện', 'Đàn Pet không tấn công vô cớ. Chúng giữ khoảng cách, che những con nhỏ hơn ở phía sau.'),
      line('Nhi', 'Bông! Cuối cùng cậu cũng về rồi!'),
      line('Mira', 'Cảm ơn cháu. Có kẻ đặt bẫy ngay trên đường di cư… Không thể chỉ là thay đổi mùa vụ.'),
      line('Mira', 'Hãy mang mẫu hoa và chiếc khóa này tới Vườn Bách Thảo. Ở đó có người biết cách đọc những dấu hiệu của thiên nhiên.'),
    ],
  },
  {
    n: 3,
    id: 'vuon-bach-thao',
    kind: 'hub',
    hubId: 'vuon-bach-thao',
    name: 'Mùa hoa không hạt',
    role: 'normal',
    tags: ['Vườn Bách Thảo', 'Khám phá'],
    beat: 'Lyra xem mẫu hoa không phấn. Khảo sát vườn, làm quen điểm săn Pet, và thấy mùi hương nhân tạo cùng cọc đánh dấu lệch tuyến di cư.',
    lines: [
      line('Lyra', 'Đẹp thật đấy… Nhưng cháu nhìn xem, phần nhụy gần như không có dấu phấn.'),
      line('Người chơi', 'Vậy hoa vẫn nở, nhưng không tạo ra hạt giống?'),
      line('Lyra', 'Đúng. Những loài Pet mang phấn đã không ghé qua đây như mọi năm.'),
      line('Người chơi', 'Ở Cầu Hoa, cháu thấy lồng bẫy.'),
      line('Lyra', 'Đây không còn là chuyện thiếu nắng hay mưa nữa rồi.'),
    ],
  },
  {
    n: 4,
    id: 'loi-vuon-co',
    kind: 'encounter',
    name: 'Lối Vườn Cổ',
    role: 'mini',
    tags: ['Mini Boss'],
    beat: 'Pet Canh Vườn bị mồi nhử kích động. Trận này để mở lối vào vườn ươm, không phải để hại sinh vật bảo hộ.',
    lines: [
      line('Lyra', 'Nó không hung dữ. Có kẻ đã dùng mùi hương để kéo nó khỏi lối canh cũ.'),
      line('Lyra', 'Muốn điều tra bẫy trái phép và đoàn vận chuyển, chúng ta cần Hội Anh Hùng giúp đỡ.'),
      line('Lyra', 'Ta sẽ viết báo cáo. Cháu đã tận mắt thấy những gì xảy ra, cháu có thể làm chứng.'),
    ],
  },
  {
    n: 5,
    id: 'hoi-anh-hung',
    kind: 'hub',
    hubId: 'hoi-anh-hung',
    name: 'Lời hứa bảo vệ',
    role: 'normal',
    tags: ['Hội Anh Hùng', 'Nhiệm vụ'],
    beat: 'Nộp báo cáo của Lyra. Không cần gia nhập guild người chơi để đi tiếp câu chuyện.',
    lines: [
      line('Cedric', 'Người mới? Ta tưởng cậu đến đăng ký nhiệm vụ săn quái.'),
      line('Người chơi', 'Cháu mang báo cáo từ Vườn Bách Thảo. Có người đang bẫy Pet trên đường di cư.'),
      line('Cedric', 'Việc đó không thể xem nhẹ. Một đàn Pet mất đi, cả mùa màng có thể chịu ảnh hưởng.'),
      line('Cedric', 'Ta sẽ cho người kiểm tra đường thương mại. Cậu muốn cùng đi chứ?'),
    ],
  },
  {
    n: 6,
    id: 'duong-thuong-mai',
    kind: 'encounter',
    name: 'Đường Thương Mại',
    role: 'mini',
    tags: ['Mini Boss'],
    beat: 'Pet Hộ Tống của nhóm săn trái phép chặn đường. Đoàn thu gom tháo chạy, để lại phiếu hàng của một kho ở Thành Thái Dương.',
    lines: [
      line('Cedric', 'Phiếu này ghi tên một kho hàng ở Thành Thái Dương. Ta cần người đi cùng để xác minh.'),
      line('Cedric', 'Cậu đã khởi đầu bằng việc mang thư. Giờ hãy giúp chúng ta đưa những Pet đó về nhà.'),
    ],
  },
  {
    n: 7,
    id: 'thanh-thai-duong',
    kind: 'hub',
    hubId: 'thanh-thai-duong',
    name: 'Giá của một mùa hoa',
    role: 'normal',
    tags: ['Thành Thái Dương', 'Điều tra'],
    beat: 'Thành vẫn đầy lúa, ruộng ngoài thành thì thiếu hạt. Orven thu gom Pet mang phấn cho ruộng của mình. Một phiếu hàng chưa đủ để kết tội mọi thương nhân.',
    lines: [
      line('Người dân', 'Thành Thái Dương năm nay vẫn đầy lúa, nhưng các ruộng ngoài thành đã bắt đầu thiếu hạt giống.'),
      line('Cedric', 'Lạ thật. Một số kho tư nhân lại đang nhập Pet mang phấn hoa với số lượng rất lớn.'),
      line('Người quản thành', 'Nếu có bẫy trái phép, hãy mang bằng chứng. Ta không thể kết tội mọi thương nhân chỉ vì một phiếu hàng.'),
      line('Orven', 'Ta chỉ đưa những Pet ấy đến nơi có thể chăm sóc chúng tốt hơn. Lợi nhuận không phải tội lỗi.'),
      line('Người chơi', 'Chúng bị nhốt trong lồng. Còn những cánh đồng khác thì không thể kết hạt.'),
      line('Orven', 'Một mùa vụ thành công đáng giá hơn vài lời than phiền.'),
      line('Cedric', 'Nếu đó là giao thương tự nguyện thì không ai ngăn. Nhưng cậu đã đặt bẫy và khiến cả vùng phải trả giá.'),
    ],
  },
  {
    n: 8,
    id: 'kho-luong',
    kind: 'boss',
    name: 'Kho Lương Ánh Dương',
    role: 'boss',
    tags: ['Boss vùng'],
    beat: 'Thú Hộ Vệ Thương Đoàn của Orven. Pet bị thu hồi và đưa về hành lang di cư. Cánh đồng chưa hồi sinh ngay. Sổ hàng còn dấu “đường hoa cũ”.',
    lines: [
      line('Mira', 'Làng ta đã bắt đầu gieo hạt lại rồi. Còn những Pet nhỏ, chúng đã trở về đúng mùa.'),
      line('Lyra', 'Có điều… dấu vẽ trong sổ hàng này không giống bất kỳ tuyến đường nào ta từng thấy.'),
      line('Cedric', 'Nếu muốn tìm hiểu những con đường xưa, hãy thử đến Thành Vinh Quang. Đó là tòa thành cổ nhất Petaria.'),
      line('Người kể chuyện', 'Chuyến giao thư đầu tiên đã kết thúc. Nhưng ở một nơi xa hơn, một con đường khác đang chờ được tìm thấy.'),
    ],
  },
];

export const HUBS = [
  {
    id: 'lang-nhan-ai',
    name: 'Làng Nhân Ái',
    stage: 1,
    icons: ['icon-home', 'icon-shop', 'icon-potion', 'icon-chat'],
    to: '/game-center/daily-free',
    blurb: 'Mira nhận thư. Quà Nhân Ái hằng ngày là vòng lặp riêng, không gắn vào việc phải đánh boss.',
  },
  {
    id: 'vuon-bach-thao',
    name: 'Vườn Bách Thảo',
    stage: 3,
    icons: ['icon-leaf', 'icon-book', 'icon-potion', 'icon-paw'],
    to: '/hunting-world/confirm?regionId=3-1&spotName=Vườn%20Bách%20Thảo&mapId=vuon_bach_thao',
    blurb: 'Lyra đọc mẫu hoa không hạt. Săn và thu phục Pet dùng hệ thống sẵn có của vườn.',
  },
  {
    id: 'hoi-anh-hung',
    name: 'Hội Anh Hùng',
    stage: 5,
    icons: ['icon-swords', 'icon-trophy', 'icon-people', 'icon-flag'],
    to: '/tasks/monster-hunt',
    blurb: 'Cedric nhận báo cáo. Nhiệm vụ hội mở cho câu chuyện, không bắt buộc vào guild người chơi.',
  },
  {
    id: 'thanh-thai-duong',
    name: 'Thành Thái Dương',
    stage: 7,
    icons: ['icon-home', 'icon-shop', 'icon-trophy', 'icon-flag'],
    to: '/hunting-world/confirm?regionId=3-1&spotName=Thành%20Thái%20Dương&mapId=thanh_thai_duong',
    blurb: 'Thành phố mùa màng và kho hàng. Orven là tên làm việc của thương nhân thu gom Pet.',
  },
];

export const CHEST_COPY = {
  2: 'Mẫu hoa và mảnh khóa lồng đã tới tay Mira. Lối sang Vườn Bách Thảo mở ra.',
  4: 'Lyra đóng báo cáo. Hội Anh Hùng nhận vụ bẫy Pet trên đường di cư.',
  8: 'Những Pet mang phấn được đưa về đúng mùa. Trong sổ hàng còn một dấu đường hoa cũ — lối sau gợi về Thành Vinh Quang.',
};

export function emptyProgress() {
  return { cleared: 0, chests: { 2: false, 4: false, 8: false } };
}

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const cleared = Math.max(0, Math.min(STORY_LENGTH, Number(raw?.cleared) || 0));
    return {
      cleared,
      chests: {
        2: Boolean(raw?.chests?.['2'] || raw?.chests?.[2]),
        4: Boolean(raw?.chests?.['4'] || raw?.chests?.[4]),
        8: Boolean(raw?.chests?.['8'] || raw?.chests?.[8]),
      },
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function stageState(n, cleared) {
  if (n <= cleared) return 'cleared';
  if (cleared < STORY_LENGTH && n === cleared + 1) return 'current';
  return 'locked';
}

export function currentStage(cleared) {
  return cleared >= STORY_LENGTH ? STORY_LENGTH : cleared + 1;
}

export function hubForStage(n) {
  return HUBS.find((hub) => hub.stage === n) || null;
}

export function beatBox(layout, stage) {
  if (!stage) return null;
  if (stage.kind === 'hub') return layout.hubs[stage.hubId];
  return layout.beats?.[stage.id] || null;
}
