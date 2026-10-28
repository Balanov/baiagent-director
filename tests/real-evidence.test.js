import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../electron/research.mjs';
import { verifyMarketItems } from '../shared/market.js';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { isCompetitorCandidate } from '../shared/market-plan.js';

const fixture = name => readFileSync(new URL(`../validation/html/${name}`, import.meta.url), 'utf8');

describe('verified evidence from real HTML', () => {
  it('retains real model images in the second KAMAZ table layout', () => {
    const page = parsePage(fixture('kamaz-new.html'), 'https://kamaz.ru/production/new/', 'site-new');
    const model = page.offerings.find(item => item.name === '65659-СА');
    expect(model).toBeDefined();
    expect(model.image).toMatch(/\.jpg$/i);
    expect(decodeURIComponent(model.image)).toContain('Иконка 65659.jpg');
  });

  it('keeps the own model as primary process evidence and preserves its deep link', () => {
    const source = parsePage(fixture('kamaz-serial.html'), 'https://kamaz.ru/production/serial/', 'site-1');
    const offerings = verifyMarketItems(source.offerings, [source], 40);
    const research = { companyName: 'КАМАЗ', requestedUrl: source.url, sources: [source], offerings, competitors: [] };
    const analysis = createEvidenceBasedFallback([source], source.url, research);
    expect(analysis.companyName).toBe('КАМАЗ');
    expect(analysis.opportunities.length).toBeGreaterThan(0);
    expect(analysis.opportunities[0].evidence[0]).toMatchObject({ sourceId: 'site-1', kind: 'company-site' });
    expect(analysis.opportunities[0].evidence[0].url).toContain('/production/serial/');
    expect(analysis.opportunities[0].evidence[0].quote).toMatch(/KAMAZ|КАМАZ/i);
  });

  it('does not classify truck parts and accessories as truck sellers', () => {
    const plan = { subject: 'грузовые автомобили', companyName: 'КАМАЗ', relevance: /производств/i };
    const examples = [
      { title: 'Фаворит Автозапчасти', text: 'Каталог грузовых автомобилей отечественных и иностранных марок теперь доступен на сайте.' },
      { title: 'Аксессуары и сувениры', text: 'Большой выбор аксессуаров для грузовых автомобилей оптом и в розницу.' },
      { title: 'Поставщики кондиционеров для грузовых автомобилей', text: 'Импорт кондиционеров для грузовых автомобилей, логистика и стоимость.' },
    ];
    for (const item of examples) expect(isCompetitorCandidate({ ...item, url: 'https://supplier.example/' }, plan, 'https://kamaz.ru/')).toBe(false);
    expect(isCompetitorCandidate({ title: 'Грузовики MAN — дилер', url: 'https://dealer.example/', text: 'Седельные тягачи MAN по цене дилера, каталог и условия покупки.' }, plan, 'https://kamaz.ru/')).toBe(true);
  });
});
