// Vercel Function entry point. `pnpm build` compiles the NestJS app to dist/ with full decorator
// metadata first; vercel.json rewrites every path here and Express routes on the original URL.
// Default to production so development-only settings (such as pretty logging) never load here.
process.env.NODE_ENV ??= 'production';
module.exports = require('../dist/serverless.js').default;
