const privatePaths = ['/app', '/dashboard', '/api', '/auth', '/checkout', '/p']
const proposalAssets = ['./node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf',
  './node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf', './node_modules/pdfkit/js/data/*']
const config = {
  trailingSlash: false,
  poweredByHeader: false,
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: { '/app/proposals/*/pdf': proposalAssets, '/p/*/pdf': proposalAssets },
  // Public metadata is local and can be sent in the initial head to every reader.
  htmlLimitedBots: /.*/,
  async redirects() {
    return [{ source: '/sitemap-index.xml', destination: '/sitemap.xml', permanent: true }]
  },
  async headers() {
    const generalHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ]
    if (process.env.VERCEL_ENV === 'preview') {
      generalHeaders.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
    }
    return [{ source: '/:path*', headers: generalHeaders }, ...privatePaths.map((prefix) => ({
      source: prefix + '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'private, no-store' },
        ...(prefix === '/p' ? [{ key: 'Referrer-Policy', value: 'no-referrer' }] : []),
      ],
    }))]
  },
}
export default config
