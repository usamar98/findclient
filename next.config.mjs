const privatePaths = ['/app', '/dashboard', '/api', '/auth', '/checkout']
const config = {
  trailingSlash: false,
  poweredByHeader: false,
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
      ],
    }))
  },
}
export default config
