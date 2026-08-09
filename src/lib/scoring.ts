/**
 * Bảng điểm — đổi ở đây là đổi toàn bộ app.
 *
 * Brief chốt: ngày kiến thức +2đ · thử thách áp dụng +5đ · quiz tổng hợp tuần
 * +3đ bonus nếu ≥80% · webinar +10đ · mỗi phần case study +5đ.
 *
 * "Trả lời sai vẫn cho đi tiếp, chỉ mất phần điểm thưởng" được hiện thực bằng
 * cách tách điểm ngày kiến thức thành 1đ có mặt + 1đ trả lời đúng: sai vẫn
 * check-in được, streak vẫn giữ, chỉ mất 1đ thưởng.
 */

export const SCORING = {
  /** Ngày kiến thức: có mặt 1đ, trả lời đúng thêm 1đ → 2đ. */
  kien_thuc: { base: 1, perCorrect: 1 },
  /** Quiz tổng hợp tuần: có mặt 1đ, đạt ngưỡng nhận thêm 3đ. */
  quiz_tuan: { base: 1, bonus: 3, threshold: 0.8 },
  /** Thử thách áp dụng: nộp bài 5đ. */
  thu_thach: { base: 5 },
  /** Webinar: điểm danh bằng mã 10đ + mảnh trăng của tuần. */
  webinar: { base: 10 },
  /** Mỗi phần case study chung kết: 5đ. */
  case_study: { base: 5 },
  /** Đêm hội: không tính điểm, chỉ tổng kết. */
  dem_hoi: { base: 0 },
} as const;

export type DayType = keyof typeof SCORING;

/** Vé cứu cấp cho mỗi người khi tạo mã. */
export const FREEZES_PER_PLAYER = 2;

/** Xác suất trúng hộp quà bí ẩn sau khi nộp thử thách áp dụng (1 lần/tuần). */
export const MYSTERY_BOX_CHANCE = 0.35;

/** Điểm thưởng khi rơi đúng Ngày Thỏ Ngọc. */
export const RABBIT_DAY_POINTS = 15;

/** Điểm tặng bạn mỗi lần "tặng cà rốt". */
export const CARROT_POINTS = 2;

/** Tổng điểm tối đa có thể đạt nếu làm trọn 47 ngày (không tính quà ngẫu nhiên). */
export const MAX_POINTS =
  24 * (SCORING.kien_thuc.base + SCORING.kien_thuc.perCorrect) + // 24 ngày kiến thức
  6 * (SCORING.quiz_tuan.base + SCORING.quiz_tuan.bonus) + // 6 quiz tổng hợp
  6 * SCORING.thu_thach.base + // 6 thử thách áp dụng
  6 * SCORING.webinar.base + // 6 webinar
  4 * SCORING.case_study.base; // 4 phần case study chung kết

/** Nhãn tiếng Việt cho từng loại ngày. */
export const DAY_TYPE_LABEL: Record<DayType, string> = {
  kien_thuc: 'Kiến thức + quiz nhanh',
  thu_thach: 'Thử thách áp dụng',
  quiz_tuan: 'Quiz tổng hợp tuần',
  webinar: 'Trạm dừng gốc đa',
  case_study: 'Case study chung kết',
  dem_hoi: 'Đêm hội trăng rằm',
};

/** Phần thưởng nhỏ trong hộp quà bí ẩn — Trung sửa danh sách này tuỳ mùa. */
export const MYSTERY_BOX_PRIZES: { title: string; detail: string; points: number }[] = [
  {
    title: 'Quyền hỏi ưu tiên',
    detail: 'Câu hỏi của bạn được trả lời đầu tiên ở buổi trạm dừng gốc đa tuần này.',
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
    title: 'Rà soát giáo án',
    detail: 'Gửi mình một giáo án bất kỳ của bạn, mình xem và góp ý trực tiếp.',
    points: 5,
  },
];
