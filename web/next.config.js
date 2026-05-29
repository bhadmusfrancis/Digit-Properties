/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow listing video uploads up to 50MB through the dev/proxy pipeline (small default can truncate bodies).
    proxyClientMaxBodySize: '55mb',
  },
  serverExternalPackages: ['sharp', 'tesseract.js'],
  images: {
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
