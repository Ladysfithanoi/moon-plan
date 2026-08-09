import Link from 'next/link';

export default function TopBar({
  nav,
}: {
  nav?: { href: string; label: string; here?: boolean }[];
}) {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="wordmark">
          Precision Coach
        </Link>
        {nav?.length ? (
          <nav className="topbar-nav">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={n.here ? 'here' : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        ) : (
          <span className="season-tag">MÙA TRĂNG · 2026</span>
        )}
      </div>
    </header>
  );
}
