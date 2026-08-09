import { redirect } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import LoginForm from './LoginForm';
import { getPlayerSession } from '@/lib/session';
import { eventStatus } from '@/lib/event';

export const dynamic = 'force-dynamic';

export default async function VaoPage() {
  const session = await getPlayerSession();
  if (session) redirect('/chang-duong');

  const beforeStart = eventStatus() === 'truoc';

  return (
    <>
      <TopBar />

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Vào chặng đường</span>
          </p>
          <h1 className="display">Mã của bạn</h1>
          <p className="body">
            Mỗi người chạy có một mã riêng. Nhập mã vào đây là bạn thấy được vòng trăng của mình —
            không cần mật khẩu, không cần đăng ký thêm gì.
          </p>

          <LoginForm />

          {beforeStart ? (
            <p className="notice info" style={{ marginTop: 22 }}>
              Sự kiện khởi động ngày 10/08/2026. Nếu bạn chưa có mã, comment &quot;THAM GIA&quot; dưới
              bài khởi động trên trang TrungPrecisionCoach — mình sẽ gửi mã qua Messenger.
            </p>
          ) : (
            <p className="notice info" style={{ marginTop: 22 }}>
              Chưa có mã? Nhắn cho mình trên Messenger kèm tên bạn, mình cấp mã trong ngày.
            </p>
          )}
        </div>
      </section>

      <footer>
        <div className="wrap">
          <Link href="/">Quay lại trang giới thiệu</Link>
        </div>
      </footer>
    </>
  );
}
