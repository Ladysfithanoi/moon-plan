/**
 * Bảng điểm — đổi ở đây là đổi toàn bộ app.
 *
 * Điểm gốc của từng loại ngày giữ như mùa trước, nhưng giờ được NHÂN theo tầng
 * hoa của chuỗi ngày: học đều thì cùng một bài được nhiều điểm hơn hẳn. Đó là
 * chỗ khác biệt giữa người học đều và người học lẻ tẻ.
 *
 * "Trả lời sai vẫn cho đi tiếp, chỉ mất phần điểm thưởng" vẫn giữ: ngày kiến
 * thức tách thành 1đ có mặt + 1đ trả lời đúng.
 */

export const SCORING = {
  /** Ngày kiến thức: có mặt 1đ, trả lời đúng thêm 1đ mỗi câu. */
  kien_thuc: { base: 1, perCorrect: 1 },
  /** Quiz tổng hợp tuần: có mặt 1đ, đạt ngưỡng nhận thêm 3đ. */
  quiz_tuan: { base: 1, bonus: 3, threshold: 0.8 },
  /** Thử thách áp dụng: nộp bài 5đ. */
  thu_thach: { base: 5 },
  /** Trạm hoa Chủ Nhật: điểm danh bằng mã 10đ + dải ruy băng của tuần. */
  webinar: { base: 10 },
  /** Case study về đích: 10đ. */
  case_study: { base: 10 },
  /** Ngày hội 20/10: không tính điểm gốc, chỉ khép bó hoa. */
  dem_hoi: { base: 0 },
} as const;

export type DayType = keyof typeof SCORING;

/**
 * Bốn tầng hoa theo độ dài chuỗi. `min` là số ngày liên tiếp tối thiểu,
 * `mult` là hệ số nhân mặc định (đổi được ở /admin/cai-dat).
 */
export const TIERS = [
  { key: 'nu', name: 'Nụ', min: 0, mult: 1, unlock: null },
  { key: 'he_no', name: 'Hé nở', min: 3, mult: 1.5, unlock: 'Mẹo thực hành ẩn của mỗi ngày' },
  { key: 'no_ro', name: 'Nở rộ', min: 7, mult: 2, unlock: 'Bài đọc mở rộng của mỗi ngày' },
  { key: 'hoa_hong', name: 'Hoa hồng', min: 14, mult: 2.5, unlock: 'Một buổi hỏi riêng 1-1 với mình' },
] as const;

export type TierIndex = 0 | 1 | 2 | 3;

/** Tầng hoa tương ứng một độ dài chuỗi. */
export function tierIndexFor(streak: number): TierIndex {
  for (let i = TIERS.length - 1; i > 0; i--) if (streak >= TIERS[i].min) return i as TierIndex;
  return 0;
}

/** Mở khoá theo tầng: mẹo ẩn ở tầng 1, đọc mở rộng ở tầng 2. */
export const UNLOCK_TIP_TIER: TierIndex = 1;
export const UNLOCK_DEEP_TIER: TierIndex = 2;

/** Mốc chuỗi đầu tiên chạm tới — mỗi mốc thưởng một lần. */
export const MILESTONES = [
  { streak: 3, kind: 'moc_3', points: 3, title: 'Hé nở', detail: 'Ba ngày liền. Từ giờ mỗi ngày có thêm một mẹo thực hành ẩn, và điểm của bạn được nhân 1,5.' },
  { streak: 7, kind: 'moc_7', points: 7, title: 'Nở rộ', detail: 'Bảy ngày liền. Bài đọc mở rộng đã mở, điểm được nhân đôi.' },
  { streak: 14, kind: 'moc_14', points: 14, title: 'Hoa hồng', detail: 'Mười bốn ngày liền — tầng cao nhất. Bạn có một buổi hỏi riêng 1-1 với mình; nhắn Messenger để hẹn giờ.' },
] as const;

/** Giọt sương cấp cho mỗi người khi tạo mã. */
export const DEWS_PER_PLAYER = 2;

/** Xác suất trúng hộp quà bí ẩn sau khi nộp thử thách áp dụng (1 lần/tuần). */
export const MYSTERY_BOX_CHANCE = 0.35;

/** Điểm thưởng khi rơi đúng ngày Bông hoa bí mật. */
export const SECRET_DAY_POINTS = 15;

/** Điểm tặng bạn mỗi lần "tặng hoa". */
export const GIFT_POINTS = 2;

/** Thưởng khi hồi xuân — quay lại học đủ 3 ngày liền sau khi cây ngủ. */
export const COMEBACK_POINTS = 5;
/** Số ngày liền cần có để hồi xuân. */
export const COMEBACK_DAYS = 3;

/**
 * Vườn chung: ngày nào có từ `threshold` người đang hoạt động học đúng hạn thì
 * ngày đó "nắng". Ai góp mặt ngày nắng được `points`; cứ `sunnyPerDew` ngày
 * nắng thì cả lớp thêm một giọt sương.
 */
export const GARDEN = { threshold: 0.6, points: 3, sunnyPerDew: 3 } as const;

/** Nhãn tiếng Việt cho từng loại ngày. */
export const DAY_TYPE_LABEL: Record<DayType, string> = {
  kien_thuc: 'Kiến thức + quiz nhanh',
  thu_thach: 'Thử thách áp dụng',
  quiz_tuan: 'Quiz tổng hợp tuần',
  webinar: 'Trạm hoa Chủ Nhật',
  case_study: 'Case study về đích',
  dem_hoi: 'Ngày hội 20/10',
};

/**
 * Ngày Trạm hoa là ngày "trung tính" của chuỗi: đến thì cây lớn thêm, vắng thì
 * cây giữ nguyên — không ai héo hoa chỉ vì bận tối Chủ Nhật.
 */
export function isNeutralDay(t: DayType | string): boolean {
  return t === 'webinar';
}

/** Lịch loại ngày dự kiến — chỉ dùng để ước tính điểm tối đa. */
export const DAY_PLAN: DayType[] = [
  'kien_thuc', 'kien_thuc', 'kien_thuc', 'webinar', // tuần 1
  'kien_thuc', 'kien_thuc', 'kien_thuc', 'kien_thuc', 'thu_thach', 'quiz_tuan', 'webinar', // tuần 2
  'kien_thuc', 'kien_thuc', 'kien_thuc', 'kien_thuc', 'thu_thach', 'quiz_tuan', 'webinar', // tuần 3
  'case_study', 'dem_hoi', // về đích
];

/** Phần thưởng nhỏ trong hộp quà bí ẩn — sửa danh sách này tuỳ mùa. */
export const MYSTERY_BOX_PRIZES: { title: string; detail: string; points: number }[] = [
  {
    title: 'Quyền hỏi ưu tiên',
    detail: 'Câu hỏi của bạn được trả lời đầu tiên ở buổi Trạm hoa Chủ Nhật tuần này.',
    points: 3,
  },
  {
    title: 'Ghi chú riêng từ mình',
    detail: 'Mình sẽ gửi riêng cho bạn phần ghi chú mở rộng của chủ đề tuần này qua Messenger.',
    points: 3,
  },
  {
    title: 'Ưu đãi thêm',
    detail: 'Bạn được cộng thêm một phần ưu đãi vào mức giảm giá cuối sự kiện.',
    points: 5,
  },
  {
    title: 'Rà soát giáo án khách nữ',
    detail: 'Gửi mình một giáo án bạn đang soạn cho khách nữ, mình xem và góp ý trực tiếp.',
    points: 5,
  },
];
