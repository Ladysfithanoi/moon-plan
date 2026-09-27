import Link from 'next/link';
import { redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import RegisterForm from './RegisterForm';
import { getPlayerSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { eventStatus } from '@/lib/event';

export const dynamic = 'force-dynamic';

export default async function DangKyPage() {
  if (await getPlayerSession()) redirect('/chang-duong');

  const { registrationOpen } = await getSettings();
  const finished = eventStatus() === 'da-xong';

  return (
    <>
      <TopBar />

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Đăng ký tham gia</span>
          </p>
          <h1 className="display">Gieo hạt của bạn</h1>

          {registrationOpen && !finished ? (
            <>
              <p className="body">
                Ba ô là xong. Đăng ký xong bạn vào thẳng cành hoa của mình; lần sau quay lại chỉ cần số
                điện thoại và mã PIN.
              </p>
              <RegisterForm />
              <p className="coach-note" style={{ marginTop: 22 }}>
                Đã có tài khoản? <Link href="/vao">Đăng nhập ở đây</Link>. Quên PIN thì nhắn mình qua
                Messenger để đặt lại.
              </p>
            </>
          ) : (
            <>
              <p className="body">
                {finished
                  ? 'Mùa này đã khép lại. Hẹn bạn ở mùa sau nhé.'
                  : 'Đăng ký đang tạm đóng. Nếu bạn muốn tham gia, nhắn mình qua Messenger để được cấp mã.'}
              </p>
              <Link href="/vao" className="btn-ghost">
                Đã có tài khoản — đăng nhập
              </Link>
            </>
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
