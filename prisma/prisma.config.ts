import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    provider: 'sqlite',
    url: process.env.DATABASE_URL,
  },
});
