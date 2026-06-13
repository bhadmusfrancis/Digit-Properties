/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow listing video uploads up to 50MB through the dev/proxy pipeline (small default can truncate bodies).
    proxyClientMaxBodySize: '55mb',
  },
  serverExternalPackages: ['sharp', 'tesseract.js'],
  images: {
    // Listing photos live on Cloudinary and bypass Vercel optimization; these settings cover
    // the remaining remote images (OAuth avatars, seed assets) and reduce transformation count.
    minimumCacheTTL: 2678400, // 31 days — listing media rarely changes
    formats: ['image/webp'],
    qualities: [75],
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [80, 112, 152, 256, 280, 384, 520],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'platform-lookaside.fbsbx.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  // Consolidate the apex domain onto the canonical www host so Google does not
  // index both and report "Duplicate, Google chose a different canonical".
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'digitproperties.com' }],
        destination: 'https://www.digitproperties.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
