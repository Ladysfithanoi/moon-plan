import { redirect } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import LoginForm from './LoginForm';
import { getPlayerSession } from '@/lib/session';
import { eventStatus } from '@/lib/event';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function VaoPage() {
  const session = await getPlayerSession();
  if (session) redirect('/chang-duong');

  const { registrationOpen } = await getSettings();
  const canRegister = registrationOpen && eventStatus() !== 'da-xong';

  return (
    <>
      <TopBar />

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Vào cành hoa</span>
          </p>
          <h1 className="display">Chào bạn quay lại</h1>
          <p className="body">
            Đăng nhập bằng số điện thoại và mã PIN bạn đã đặt lúc đăng ký. Nếu bạn được gửi mã
            cá nhân qua Messenger, mở dòng bên dưới để vào bằng mã.
          </p>

          <LoginForm />

          {canRegister ? (
            <p className="notice info" style={{ marginTop: 22 }}>
              Chưa có tài khoản? <Link href="/dang-ky">Đăng ký ở đây</Link> — chỉ mất một phút.
            </p>
          ) : (
            <p className="notice info" style={{ marginTop: 22 }}>
              Chưa có tài khoản? Nhắn cho mình trên Messenger kèm tên bạn, mình cấp mã trong ngày.
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
