import { existsSync } from 'node:fs';
// Server and connection check share this loader. Never expose .env to Vite.
if (existsSync('.env')) process.loadEnvFile('.env');
