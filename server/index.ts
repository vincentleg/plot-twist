import { createApp } from './app.js';
const server = createApp();
server.listen(3001, '127.0.0.1', () => console.log('PLOT TWIST API: http://127.0.0.1:3001'));
server.on('error', (error: NodeJS.ErrnoException) => { console.error(`API startup failed (${error.code ?? 'unknown'}).`); process.exit(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
