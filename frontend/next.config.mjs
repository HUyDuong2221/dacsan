const API = process.env.API_INTERNAL_URL || 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Trình duyệt chỉ nói chuyện với Next (same-origin); Next chuyển tiếp /api và /media sang FastAPI.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/media/:path*', destination: `${API}/media/:path*` },
    ];
  },
};

export default nextConfig;
