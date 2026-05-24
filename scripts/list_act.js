require('dotenv').config();
(async ()=> {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const rows = await prisma.actNormativ.findMany();
    console.log(JSON.stringify(rows, null, 2));
    await prisma.$disconnect();
  } catch(e) {
    console.error('NODEERR', e);
    process.exit(1);
  }
})();
