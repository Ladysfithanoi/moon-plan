import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { logout } from '../vao/actions';

export const dynamic = 'force-dynamic';

export default function RoiDiPage() {
  return (
    <>
      <TopBar />
      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Thoát</span>
          </p>
          <h1 className="display">Tạm biệt hôm nay</h1>
          <p className="body">
            Thoát ra thì lần sau bạn nhập lại mã cá nhân là vào được ngay. Tiến độ của bạn được lưu
            trên máy chủ, không mất đi đâu cả.
          </p>
          <form action={logout}>
            <div className="btn-row">
              <button type="submit" className="btn-primary">
                Thoát khỏi máy này
              </button>
              <Link href="/chang-duong" className="btn-ghost">
                Quay lại chặng đường
              </Link>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
