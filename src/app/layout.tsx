import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chạy dần đến Trung Thu · Precision Coach',
  description:
    'Sự kiện 47 ngày dành cho học viên PT — mỗi ngày một bước chạy, mỗi tuần một mảnh trăng, đêm rằm vòng khép lại.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#F6F2EA',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
