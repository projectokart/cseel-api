import { app } from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`
  ═══════════════════════════════════════════════════════
  🚀 CSEEL Backend API running on port ${config.port}
  🔒 Anti-Scraping & Human Verification Active
  🛡️ Environment: ${config.nodeEnv}
  🌐 Base URL: http://localhost:${config.port}
  ═══════════════════════════════════════════════════════
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down gracefully.');
  server.close(() => {
    process.exit(0);
  });
});
