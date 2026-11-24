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
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/sitemap.xml', destination: '/sitemap-index.xml' },
      ],
    }
  },
  async headers() {
    return privatePaths.map((prefix) => ({
      source: prefix + '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'private, no-store' },
        ...(prefix === '/p' ? [{ key: 'Referrer-Policy', value: 'no-referrer' }] : []),
      ],
    }))
  },
}
export default config
