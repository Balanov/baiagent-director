import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: process.env.BAIAGENT_DESKTOP_BUILD === '1' ? './' : mode === 'enterprise' ? '/ai-audit/' : mode === 'advisor' ? '/advisor/' : mode === 'xray' ? '/xray/' : './',
  plugins: [react(), {
    name: 'enterprise-metadata',
    transformIndexHtml(html) {
      if (mode !== 'enterprise') return html;
      return html
        .replaceAll('BAIagent — ИИ-советник для бизнеса', 'Balanov.PRO — ИИ-советник для бизнеса')
        .replace('ИИ-советник для бизнеса — бесплатный аудит компании по сайту, конкретные процессы для проверки, источники выводов и план измеримого пилота.', 'Balanov.PRO — аудит процессов и инфраструктуры, релевантные кейсы и прайс вендора, архитектура и план измеримого пилота.')
        .replace('Укажите сайт: советник узнает компанию, предложит приоритетный процесс и покажет, как проверить эффект без выдуманных обещаний.', 'Укажите сайт: Balanov.PRO определит процесс для аудита, предложит решение из прайса и покажет границы пилота без выдуманных обещаний.');
    },
  }],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    outDir: mode === 'enterprise' ? 'dist-enterprise' : mode === 'advisor' ? 'dist-advisor' : 'dist',
  },
  test: { environment: 'node', include: ['tests/**/*.test.js', 'shared/**/*.test.js'] },
}));
