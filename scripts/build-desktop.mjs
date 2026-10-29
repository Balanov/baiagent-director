import { build } from 'vite';

process.env.BAIAGENT_DESKTOP_BUILD = '1';
await build({ mode: process.argv.includes('--enterprise') ? 'enterprise' : 'production' });
