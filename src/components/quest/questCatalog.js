export const QUEST_TYPES = [
  { id: 'main', label: 'Chính' },
  { id: 'daily', label: 'Ngày' },
  { id: 'weekly', label: 'Tuần' },
];

export const DAILY_POINT_GOAL = 100;
export const DAILY_ENOUGH_COUNT = 5;

const DAILY_POINTS = 20;

export const DAILY_QUESTS = [
  {
    id: 'daily_login',
    type: 'daily',
    title: 'Đăng nhập hôm nay',
    detail: 'Mở Petaria trong ngày. Việc này tự xong khi cậu đang ở trong vương quốc.',
    goal: 'Đăng nhập',
    progress: 1,
    total: 1,
    points: DAILY_POINTS,
    rewards: ['20 điểm ngày'],
  },
  {
    id: 'daily_feed',
    type: 'daily',
    title: 'Cho Pet ăn',
    detail: 'Ghé quán và cho Pet ăn một lần. Một bữa là đủ cho việc hôm nay.',
    goal: 'Cho Pet ăn một lần',
    progress: 0,
    total: 1,
    points: DAILY_POINTS,
    rewards: ['20 điểm ngày'],
    route: '/restaurant',
  },
  {
    id: 'daily_heal',
    type: 'daily',
    title: 'Ghé Sông Healia',
    detail: 'Đưa Pet tới Sông Healia và dùng dịch vụ hồi phục một lần.',
    goal: 'Hồi phục Pet một lần',
    progress: 0,
    total: 1,
    points: DAILY_POINTS,
    rewards: ['20 điểm ngày'],
    route: '/healia-river',
  },
  {
    id: 'daily_arena',
    type: 'daily',
    title: 'Một trận đấu trường',
    detail: 'Vào đấu trường và hoàn thành một trận Arena.',
    goal: 'Hoàn thành một trận Arena',
    progress: 0,
    total: 1,
    points: DAILY_POINTS,
    rewards: ['20 điểm ngày'],
    route: '/battle/arena',
  },
  {
    id: 'daily_shop',
    type: 'daily',
    title: 'Mua ở gian hàng',
    detail: 'Ghé cửa hàng Kinh Đô và mua một món.',
    goal: 'Mua một món',
    progress: 0,
    total: 1,
    points: DAILY_POINTS,
    rewards: ['20 điểm ngày'],
    route: '/shop',
  },
  {
    id: 'daily_home',
    type: 'daily',
    title: 'Về nhà',
    detail: 'Ghé nhà và xem Pet của cậu một lần.',
    goal: 'Vào nhà',
    progress: 0,
    total: 1,
    points: DAILY_POINTS,
    rewards: ['20 điểm ngày'],
    route: '/myhome/mypet',
  },
  {
    id: 'daily_chat',
    type: 'daily',
    title: 'Một lời trên kênh thế giới',
    detail: 'Gửi một tin nhắn ở ô chat góc phải màn hình, kênh Thế giới.',
    goal: 'Gửi một tin thế giới',
    progress: 0,
    total: 1,
    points: DAILY_POINTS,
    rewards: ['20 điểm ngày'],
  },
  {
    id: 'daily_map',
    type: 'daily',
    title: 'Mở bản đồ',
    detail: 'Mở bản đồ thế giới và nhìn các miền đất một lần.',
    goal: 'Mở bản đồ thế giới',
    progress: 0,
    total: 1,
    points: DAILY_POINTS,
    rewards: ['20 điểm ngày'],
    route: '/world-map',
  },
];

export const WEEKLY_QUESTS = [
  {
    id: 'weekly_arena',
    type: 'weekly',
    title: 'Tuần của đấu trường',
    detail: 'Thắng năm trận Arena trong tuần. Thua không tính.',
    goal: 'Thắng 5 trận Arena',
    progress: 0,
    total: 5,
    rewards: ['Quà tuần đấu trường'],
    route: '/battle/arena',
  },
  {
    id: 'weekly_feed',
    type: 'weekly',
    title: 'Bữa ăn đều đặn',
    detail: 'Cho Pet ăn bảy lần trong tuần, ở quán ăn.',
    goal: 'Cho Pet ăn 7 lần',
    progress: 0,
    total: 7,
    rewards: ['Quà tuần chăm Pet'],
    route: '/restaurant',
  },
  {
    id: 'weekly_city',
    type: 'weekly',
    title: 'Đi khắp Kinh Đô',
    detail: 'Ghé bốn địa điểm khác nhau trong Kinh Đô: nhà, quán, sông, cửa hàng hoặc đấu trường.',
    goal: 'Ghé 4 địa điểm',
    progress: 0,
    total: 4,
    rewards: ['Quà tuần dạo phố'],
  },
];

export function mainQuestsFromFlags(flags = {}) {
  const accepted = Boolean(flags.LETTER_QUEST_ACCEPTED);
  const south = Boolean(flags.FLOWER_REGION_ENTERED);
  if (!accepted) {
    return [
      {
        id: 'CH0_Q_ROWAN',
        type: 'main',
        title: 'Gặp Rowan',
        detail: 'Rowan vẫn giữ lá thư gửi bà Mira. Hãy đến Bưu Điện Kinh Đô khi cậu sẵn sàng.',
        goal: 'Đến bưu điện nhận thư từ Rowan',
        progress: 0,
        total: 1,
        done: false,
        rewards: ['Thư niêm phong'],
        route: '/mail',
      },
    ];
  }
  return [
    {
      id: 'CH0_Q08',
      type: 'main',
      title: 'Con Đường Phía Nam',
      detail: 'Ra bến tàu Kinh Đô, rồi theo chuyến tàu đến Cánh Đồng Vạn Hoa để trao thư cho bà Mira.',
      goal: 'Đến Cánh Đồng Vạn Hoa',
      progress: south ? 1 : 0,
      total: 1,
      done: south,
      rewards: ['Lên đường phía Nam'],
      route: '/home-ver2',
    },
  ];
}

export function currentMainQuests(flags) {
  const list = mainQuestsFromFlags(flags);
  const open = list.filter((quest) => !quest.done);
  return open.length ? open : list.slice(-1);
}

export function dailyScore(quests = DAILY_QUESTS) {
  const done = quests.filter((quest) => quest.progress >= quest.total).length;
  const points = Math.min(
    DAILY_POINT_GOAL,
    quests.reduce((sum, quest) => sum + (quest.progress >= quest.total ? quest.points : 0), 0)
  );
  return {
    done,
    total: quests.length,
    points,
    goal: DAILY_POINT_GOAL,
    enough: DAILY_ENOUGH_COUNT,
    ready: points >= DAILY_POINT_GOAL || done >= DAILY_ENOUGH_COUNT,
  };
}
