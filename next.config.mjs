/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server Actions nhận file đính kèm case study (ảnh/PDF)
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
