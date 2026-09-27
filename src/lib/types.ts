import type { DayType } from './scoring';

export type DayRow = {
  day: number;
  date: string;
  weekday: string;
  week: number;
  phase: string;
  week_theme: string;
  day_type: DayType;
  title: string;
  body: string;
  prompt: string | null;
  mechanic: string | null;
  webinar_at: string | null;
  webinar_link: string | null;
  /** Chỉ tồn tại phía server — không bao giờ đưa vào props của client component. */
  webinar_code?: string | null;
  /**
   * Nội dung mở khoá theo tầng hoa. Chỉ đọc ở server và chỉ đưa xuống trình
   * duyệt khi người chơi đã đủ tầng — xem unlockedExtras() trong game.ts.
   */
  bonus_tip?: string | null;
  bonus_deep?: string | null;
};

export type QuestionRow = {
  id: string;
  day: number;
  ord: number;
  prompt: string;
  options: string[];
  /** Chỉ tồn tại phía server. */
  correct_index?: number;
  explain: string | null;
};

/** Bản câu hỏi an toàn để gửi xuống trình duyệt (đã bỏ đáp án). */
export type PublicQuestion = {
  id: string;
  ord: number;
  prompt: string;
  options: string[];
};

export type PlayerRow = {
  id: string;
  code: string;
  display_name: string;
  contact: string | null;
  /** SĐT (0xxxxxxxxx) nếu người chơi tự đăng ký; null nếu admin tạo mã. */
  phone: string | null;
  cohort: string;
  points: number;
  streak: number;
  best_streak: number;
  /** Cột của mùa trước, không còn dùng — giọt sương thay cho vé cứu. */
  freezes_left: number;
  freezes_used: number;
  /** Tổng giọt sương được cấp riêng cho người này (chưa kể giọt từ vườn chung). */
  dews: number;
  is_active: boolean;
  joined_at: string;
};

export type CheckinRow = {
  day: number;
  correct_count: number;
  total_count: number;
  points_awarded: number;
  /** Mùa trước dùng cho vé cứu; mùa này không còn ghi dòng nào như vậy. */
  by_freeze: boolean;
  /** Làm bù sau ngày của nó — chỉ nhận điểm gốc, không nhân tầng. */
  late: boolean;
  created_at: string;
};

export type SubmissionRow = {
  id: string;
  player_id: string;
  day: number;
  kind: 'thu_thach' | 'case_study';
  body: string;
  files: { path: string; name: string; size: number }[];
  status: 'pending' | 'approved' | 'needs_work';
  /** Ghi chú riêng của Trung — không bao giờ đưa vào props của client component. */
  admin_note: string | null;
  /** Nhận xét gửi cho học viên — hiện ở trang ngày của họ. */
  player_note: string | null;
  is_best: boolean;
  created_at: string;
  updated_at: string;
};

export type RewardRow = {
  id: string;
  kind:
    | 'hop_qua'
    | 'hoa_bi_mat'
    | 'tang_hoa'
    | 'vuon_chung'
    | 'hoi_xuan'
    | 'moc_3'
    | 'moc_7'
    | 'moc_14';
  week: number | null;
  day: number | null;
  title: string;
  detail: string | null;
  points: number;
  seen: boolean;
  created_at: string;
};

/** Kết quả trả về sau khi check-in — dùng để hiện phản hồi cho người chơi. */
export type CheckinResult = {
  ok: boolean;
  message: string;
  pointsAwarded?: number;
  correctCount?: number;
  totalCount?: number;
  /** Đáp án đúng để hiện sau khi đã nộp. */
  reveal?: { questionId: string; correctIndex: number; explain: string | null }[];
  ribbonAwarded?: string;
  gifts?: { title: string; detail: string; points: number }[];
  streak?: number;
  /** Tên tầng hoa và hệ số đã nhân vào điểm của lần này. */
  tierName?: string;
  multiplier?: number;
  /** Lần này là học bù. */
  late?: boolean;
};
