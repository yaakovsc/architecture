require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const { recoverOnStartup } = require('./workers/analysisQueue');

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    await sequelize.sync();
    console.log('✅ Models synchronized');

    // Safe column additions — idempotent, harmless if columns already exist
    const migrations = [
      `ALTER TABLE "AiSummaries"        ADD COLUMN IF NOT EXISTS progress VARCHAR(255)`,
      `ALTER TABLE "EnterpriseSummaries" ADD COLUMN IF NOT EXISTS progress VARCHAR(255)`,
      `ALTER TABLE "EnterpriseSummaries" ADD COLUMN IF NOT EXISTS id VARCHAR(32)`,
      // Seed default AI config row if not present
      `INSERT INTO ai_configs (id, "createdAt", "updatedAt") VALUES ('main', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    ];
    for (const sql of migrations) {
      await sequelize.query(sql).catch(() => {}); // silently skip if already present
    }

    // Re-queue any analysis jobs that were interrupted by a restart
    await recoverOnStartup();

    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
};

start();
