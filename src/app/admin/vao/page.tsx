import { redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import ActionForm from '@/components/ActionForm';
import { adminLogin } from '../actions';
import { isAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin');

  return (
    <>
      <TopBar />
      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Khu vực điều hành</span>
          </p>
          <h1 className="display">Trang của Trung</h1>
          <ActionForm action={adminLogin} submitLabel="Vào" busyLabel="Đang kiểm tra…" style={{ maxWidth: 360 }}>
            <div className="field">
              <label htmlFor="password">Mật khẩu</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
