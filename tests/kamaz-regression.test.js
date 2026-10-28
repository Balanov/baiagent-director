import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { companyNameFromPages, parsePage } from '../electron/research.mjs';
import { createBusinessProfile } from '../shared/business.js';
import { createMarketSearchPlan, isCompetitorCandidate, relevantMarketQuote } from '../shared/market-plan.js';

const fixture = name => readFileSync(new URL(`../validation/html/${name}`, import.meta.url), 'utf8');
const home = parsePage(fixture('kamaz-home.html'), 'https://kamaz.ru/', 'site-1');
const production = parsePage(fixture('kamaz-production.html'), 'https://kamaz.ru/production/', 'site-2');
const serial = parsePage(fixture('kamaz-serial.html'), 'https://kamaz.ru/production/serial/', 'site-3');

describe('real manufacturer catalogue regression', () => {
  it('recognises KAMAZ instead of the generic legal-site heading', () => {
    expect(companyNameFromPages([home, production, serial], 'https://kamaz.ru/')).toMatch(/kamaz|камаз/i);
  });

  it('extracts real linked truck models and original images from the saved catalogue', () => {
    expect(serial.offerings.length).toBeGreaterThanOrEqual(50);
    const model = serial.offerings.find(item => item.name === 'KAMAZ-4308-5S на КПГ');
    expect(model).toBeDefined();
    expect(model.image).toMatch(/^https:\/\/kamaz\.ru\/upload\//);
    expect(model.url).toBe('https://kamaz.ru/production/serial/bortovye-avtomobili/kamaz-4308-5s-na-kpg/');
    expect(model.quote).toContain('Евро 5');
    expect(serial.offerings.every(item => item.image && item.url !== serial.url)).toBe(true);
    expect(serial.offerings.some(item => /семинар|серийные автомобили/i.test(item.name))).toBe(false);
  });

  it('uses the manufacturing process and truck market from actual pages', () => {
    const research = { companyName: 'КАМАЗ', sources: [home, production, serial], offerings: serial.offerings };
    const profile = createBusinessProfile(research);
    const plan = createMarketSearchPlan(research, profile);
    expect(profile.industry.id).toBe('manufacturing');
    expect(profile.industry.evidence.quote).toMatch(/производ|серийн|автомобил/i);
    expect(plan.subject).toBe('грузовые автомобили');
  });

  it('rejects every competitor from the corrupted production response', () => {
    const research = JSON.parse(readFileSync(new URL('../validation/sectors/kamaz-research.json', import.meta.url), 'utf8'));
    const plan = createMarketSearchPlan(research, createBusinessProfile(research));
    expect(plan.subject).toBe('грузовые автомобили');
    expect(research.competitors.length).toBeGreaterThan(0);
    for (const competitor of research.competitors) {
      const source = research.sources.find(item => item.id === competitor.sourceId) || competitor;
      expect(isCompetitorCandidate(source, plan, research.requestedUrl), competitor.name).toBe(false);
    }
  });

  it('keeps a substantive commercial quote but not an unrelated property market', () => {
    const plan = { subject: 'грузовые автомобили', industry: 'manufacturing', companyName: 'КАМАЗ', relevance: /производств/i };
    const competitor = { title: 'Завод грузовых автомобилей', url: 'https://truck-factory.example/', text: 'Производим грузовые автомобили. Каталог самосвалов и седельных тягачей, технические характеристики и условия покупки.' };
    expect(isCompetitorCandidate(competitor, plan, 'https://kamaz.ru/')).toBe(true);
    expect(relevantMarketQuote(competitor, plan)).toContain('самосвал');
    expect(isCompetitorCandidate({ title: 'Village Fest', url: 'https://property.example/', text: 'Аренда недвижимости и организация мероприятий. Продажа и стоимость услуг.' }, plan, 'https://kamaz.ru/')).toBe(false);
  });
});
