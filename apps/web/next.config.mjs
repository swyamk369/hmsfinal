/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for a slim
  // production container image. No effect on `next dev`.
  output: 'standalone',
  // Monorepo root so file tracing resolves workspace deps correctly in standalone.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  transpilePackages: ['@hms/shared'],
  eslint: {
    // Lint is run explicitly via `pnpm lint`; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Operational app — never embeddable. A full CSP is deferred (known
          // gap): Next.js inline runtime scripts need nonces/hashes to pass a
          // strict policy and a broken CSP is worse than none.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
