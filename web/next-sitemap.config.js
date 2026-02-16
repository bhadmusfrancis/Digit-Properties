/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://digitproperties.com',
  generateRobotsTxt: true,
  exclude: ['/dashboard/*', '/auth/*', '/api/*'],
};
