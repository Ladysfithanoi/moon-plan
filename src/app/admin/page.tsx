import Link from 'next/link';
import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import { isAdmin } from '@/lib/session';
import { db } from '@/lib/supabase';
import { TOTAL_DAYS, currentDayNumber, eventStatus, vnToday } from '@/lib/event';
import { getSettings, maxPoints } from '@/lib/settings';
import { adminLogout, drawHonorRollAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  if (!(await isAdmin())) redirect('/admin/vao');

  const supabase = db();
  const today = currentDayNumber();
  const status = eventStatus();

  const settings = await getSettings();
  const weekThemes = settings.weekThemes;

  const [players, checkins, submissions, fragments, honor] = await Promise.all([
    supabase.from('players').select('id,points,streak,is_active,freezes_used'),
    supabase.from('checkins').select('day,player_id,by_freeze'),
    supabase.from('submissions').select('id,status,kind,is_best'),
    supabase.from('fragments').select('player_id,week'),
    supabase.from('honor_roll').select('week'),
  ]);

  const allPlayers = players.data ?? [];
  const allCheckins = checkins.data ?? [];
  const allSubs = submissions.data ?? [];

  const activePlayers = allPlayers.filter((p) => p.is_active).length;
  const realCheckins = allCheckins.filter((c) => !c.by_freeze);
  const doneToday = today
    ? new Set(realCheckins.filter((c) => c.day === today).map((c) => c.player_id)).size
    : 0;
  const pendingSubs = allSubs.filter((s) => s.status === 'pending').length;
  const avgCompletion =
    allPlayers.length && today
      ? Math.round((realCheckins.length / (allPlayers.length * Math.min(today, TOTAL_DAYS))) * 100)
      : 0;
  const avgPoints = allPlayers.length
    ? Math.round(allPlayers.reduce((s, p) => s + p.points, 0) / allPlayers.length)
    : 0;
  const fullSix = (() => {
    const byPlayer = new Map<string, number>();
    for (const f of fragments.data ?? []) byPlayer.set(f.player_id, (byPlayer.get(f.player_id) ?? 0) + 1);
    return [...byPlayer.values()].filter((n) => n >= 6).length;
  })();
  const drawnWeeks = new Set((honor.data ?? []).map((h) => h.week));

  const statusLabel =
    status === 'truoc' ? 'chưa khởi động' : status === 'da-xong' ? 'đã kết thúc' : `ngày ${today}/${TOTAL_DAYS}`;

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>
              {vnToday()} · {statusLabel}
            </span>
          </p>
          <h1 className="display">Tổng quan</h1>

          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi-num">{allPlayers.length}</span>
              <span className="kpi-label">người có mã ({activePlayers} đang hoạt động)</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{doneToday}</span>
              <span className="kpi-label">đã check-in hôm nay</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{avgCompletion}%</span>
              <span className="kpi-label">tỉ lệ hoàn thành trung bình</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{avgPoints}</span>
              <span className="kpi-label">điểm trung bình / {maxPoints(settings.scoring)} tối đa</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{fullSix}</span>
              <span className="kpi-label">người đủ 6 mảnh trăng</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{pendingSubs}</span>
              <span className="kpi-label">
                bài chờ đọc — <Link href="/admin/bai-nop">xem</Link>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Bảng vinh danh mềm</span>
          </p>
          <h2 className="section-title">Bốc ngẫu nhiên 10% mỗi tuần</h2>
          <p className="lede">
            Bốc lại một tuần sẽ thay thế danh sách cũ của tuần đó. Chỉ những người có check-in thật
            trong tuần mới nằm trong hộp bốc.
          </p>

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Tuần</th>
                  <th>Chủ đề</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {weekThemes.map((theme, i) => {
                  const week = i + 1;
                  const started = (today ?? 0) >= (week - 1) * 7 + 1;
                  return (
                    <tr key={week}>
                      <td className="num">{week}</td>
                      <td>{theme}</td>
                      <td>
                        {drawnWeeks.has(week) ? (
                          <span className="tag ok">đã bốc</span>
                        ) : started ? (
                          <span className="tag wait">chưa bốc</span>
                        ) : (
                          <span className="tag wait">chưa tới</span>
                        )}
                      </td>
                      <td>
                        {started ? (
                          <ActionForm action={drawHonorRollAction} submitLabel="Bốc" busyLabel="Đang bốc…" ghost>
                            <input type="hidden" name="week" value={week} />
                          </ActionForm>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap-wide">
          <form action={adminLogout}>
            <button type="submit" className="btn-ghost btn-small">
              Thoát khỏi trang điều hành
            </button>
          </form>
        </div>
      </footer>
    </>
  );
}
