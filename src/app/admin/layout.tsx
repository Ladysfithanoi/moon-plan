import Link from 'next/link';
import { isAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/admin', label: 'Tổng quan' },
  { href: '/admin/nguoi-choi', label: 'Người chơi' },
  { href: '/admin/bai-nop', label: 'Bài nộp' },
  { href: '/admin/noi-dung', label: 'Nội dung' },
  { href: '/admin/cai-dat', label: 'Cài đặt' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();

  return (
    <>
      {admin ? (
        <header className="topbar">
          <div className="wrap-wide">
            <Link href="/admin" className="wordmark">
              Điều hành · Mùa trăng
            </Link>
            <nav className="topbar-nav">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
              <Link href="/">Trang người chơi</Link>
            </nav>
          </div>
        </header>
      ) : null}
      {children}
    </>
  );
}
