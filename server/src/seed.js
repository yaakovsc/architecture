require('dotenv').config();
const { sequelize, User, System } = require('./models');

const SYSTEMS = [
  { key: 'mail-management', name: 'ניהול דואר', posX: 5, posY: 10, width: 14, height: 7, status: 'active', displayOrder: 1 },
  { key: 'logistics', name: 'לוגיסטיקה ושילוח', posX: 22, posY: 10, width: 14, height: 7, status: 'active', displayOrder: 2 },
  { key: 'payments', name: 'תשלומים ופיננסים', posX: 39, posY: 10, width: 14, height: 7, status: 'active', displayOrder: 3 },
  { key: 'crm', name: 'ניהול לקוחות CRM', posX: 56, posY: 10, width: 14, height: 7, status: 'active', displayOrder: 4 },
  { key: 'erp', name: 'מערכת ERP', posX: 73, posY: 10, width: 14, height: 7, status: 'active', displayOrder: 5 },
  { key: 'warehouse', name: 'ניהול מחסנים', posX: 5, posY: 40, width: 14, height: 7, status: 'active', displayOrder: 6 },
  { key: 'last-mile', name: 'מסירה אחרונה', posX: 22, posY: 40, width: 14, height: 7, status: 'active', displayOrder: 7 },
  { key: 'portal', name: 'פורטל לקוחות', posX: 39, posY: 40, width: 14, height: 7, status: 'active', displayOrder: 8 },
  { key: 'hr', name: 'משאבי אנוש HR', posX: 56, posY: 40, width: 14, height: 7, status: 'active', displayOrder: 9 },
  { key: 'bi', name: 'BI ואנליטיקה', posX: 73, posY: 40, width: 14, height: 7, status: 'active', displayOrder: 10 },
];

const seed = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    // Admin user
    const [admin] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        email: 'admin@architecture.local',
        password: 'Admin@1234',
        fullName: 'מנהל מערכת',
        role: 'admin',
        permissions: {
          systems: { view: true, edit: true, delete: true },
          diagrams: { view: true, edit: true, delete: true },
          users: { view: true, edit: true, delete: true },
        },
      },
    });
    console.log('✅ Admin user:', admin.username);

    // Demo user
    const [user] = await User.findOrCreate({
      where: { username: 'user' },
      defaults: {
        username: 'user',
        email: 'user@architecture.local',
        password: 'User@1234',
        fullName: 'משתמש רגיל',
        role: 'user',
        permissions: {
          systems: { view: true, edit: false, delete: false },
          diagrams: { view: true, edit: false, delete: false },
          users: { view: false, edit: false, delete: false },
        },
      },
    });
    console.log('✅ Demo user:', user.username);

    // Systems
    for (const s of SYSTEMS) {
      await System.findOrCreate({ where: { key: s.key }, defaults: s });
    }
    console.log('✅ Systems seeded:', SYSTEMS.length);

    console.log('\n--- Seed complete ---');
    console.log('Admin: admin / Admin@1234');
    console.log('User:  user  / User@1234');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
};

seed();
