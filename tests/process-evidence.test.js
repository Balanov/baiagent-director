import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../electron/research.mjs';
import { createEvidenceBasedFallback } from '../shared/fallback.js';
import { enrichAuditOpportunities } from '../shared/audit.js';
import { isCompetitorCandidate } from '../shared/market-plan.js';

const saved = slug => JSON.parse(readFileSync(new URL(`../validation/sectors/${slug}-local-research.json`, import.meta.url), 'utf8'));
const analyse = research => createEvidenceBasedFallback(research.sources, research.requestedUrl, research);

describe('process-specific evidence', () => {
  it('keeps boundaries between nested card labels', () => {
    const page = parsePage('<main><div class="service-card"><h3><span>Печень</span><span>и почки</span></h3><span class="price">От 350 ₽</span></div></main>', 'https://clinic.example/services/', 'site-1');
    expect(page.offerings[0].name).toBe('Печень и почки');
    expect(page.offerings[0].quote).toContain('Печень и почки');
  });

  it('does not use a service price as proof of patient appointment', () => {
    const analysis = analyse(saved('gemotest'));
    const appointment = analysis.opportunities.find(item => item.processName.includes('Запись пациента'));
    expect(appointment).toBeDefined();
    expect(appointment.processEvidence.status).toBe('industry-hypothesis');
    expect(appointment.why).toContain('подтверждает только отрасль');
    expect(appointment.evidence[0].kind).toBe('company-site');
    expect(appointment.evidence[0].quote).not.toMatch(/От\s+\d+\s*₽/);
    expect(appointment.evidence.every(proof => !/docdoc|rnova/.test(proof.url))).toBe(true);
  });

  it('uses published appointment evidence when the company actually provides it', () => {
    const source = { id: 'site-1', kind: 'company-site', url: 'https://clinic.example/appointment/', title: 'Запись на приём', text: 'Клиника оказывает медицинские услуги пациентам. Онлайн-запись на приём доступна по расписанию врача. Консультация 2 000 ₽.', offerings: [{ name: 'Консультация', quote: 'Консультация 2 000 ₽', sourceId: 'site-1', url: 'https://clinic.example/services/' }] };
    const analysis = createEvidenceBasedFallback([source], source.url, { companyName: 'Клиника', requestedUrl: source.url, sources: [source], offerings: source.offerings, competitors: [] });
    const appointment = analysis.opportunities.find(item => item.processName.includes('Запись пациента'));
    expect(appointment.processEvidence.status).toBe('published-process');
    expect(appointment.evidence[0].quote).toContain('Онлайн-запись на приём');
  });

  it('keeps an independent logistics citation when the company website has no readable text', () => {
    const own = { id: 'site-1', kind: 'company-site', url: 'https://www.cdek.ru/', title: 'СДЭК', text: '' };
    const independent = { id: 'web-1', kind: 'search-snippet', url: 'https://directory.example/cdek', title: 'СДЭК — услуги курьерской службы', text: 'Курьерская доставка грузов и документов для организаций. Логистические услуги и отправления для бизнеса.' };
    const analysis = createEvidenceBasedFallback([own, independent], own.url, { companyName: 'СДЭК', requestedUrl: own.url, sources: [own, independent], competitors: [] });
    expect(analysis.profile.industry.id).toBe('logistics');
    const opportunities = analysis.opportunities.filter(item => item.processEvidence?.status !== 'customer-experience');
    expect(opportunities.length).toBeGreaterThan(0);
    for (const opportunity of opportunities) {
      expect(opportunity.processEvidence.status).toBe('industry-hypothesis');
      expect(opportunity.evidence).toHaveLength(1);
      expect(opportunity.evidence[0]).toMatchObject({ sourceId: independent.id, kind: independent.kind, url: independent.url });
      expect(independent.text).toContain(opportunity.evidence[0].quote);
      expect(opportunity.evidence[0].quote).toMatch(/курьерск|логистическ|отправлени/i);
    }
  });

  it('never attaches reviews to the internal manufacturing handoff', () => {
    const research = saved('kamaz');
    const analysis = analyse(research);
    const [handoff] = enrichAuditOpportunities({
      opportunities: [{ title: 'Снизить потери при передаче запроса между продажами и производством', category: 'cost', action: 'Проверить требования и версии спецификации.', evidence: research.reviews }],
      research, market: analysis.market, profile: analysis.profile,
    });
    expect(handoff.processName).toContain('Передача требований');
    expect(handoff.processEvidence.status).toBe('industry-hypothesis');
    expect(handoff.evidence.length).toBeGreaterThan(0);
    expect(handoff.evidence.every(proof => proof.kind === 'company-site')).toBe(true);
    const feedback = analysis.opportunities.find(item => item.title.includes('отзывов'));
    expect(feedback.processName).toContain('Разбор отзывов');
  });

  it('keeps customer feedback in its own operating process in healthcare', () => {
    const analysis = analyse(saved('gemotest'));
    const feedback = analysis.opportunities.find(item => item.title.includes('отзывов'));
    expect(feedback.processName).toBe('Разбор отзывов и назначение владельца улучшения');
    expect(feedback.processName).not.toContain('протокола');
  });

  it('excludes medical aggregators and software vendors from direct competitors', () => {
    const plan = { industry: 'healthcare', subject: 'медицинские услуги', companyName: 'Гемотест', relevance: /медицин/i };
    expect(isCompetitorCandidate({ title: 'Медицинские услуги — онлайн-запись', text: 'Агрегатор клиник, выбор врача и цены.', url: 'https://docdoc.ru/service' }, plan, 'https://gemotest.ru/')).toBe(false);
    expect(isCompetitorCandidate({ title: 'МИС для клиники', text: 'Медицинская информационная система для автоматизации клиник.', url: 'https://rnova.ru/' }, plan, 'https://gemotest.ru/')).toBe(false);
    expect(isCompetitorCandidate({ title: 'СМ-Клиника — медицинские услуги', text: 'Клиника предлагает диагностику, лечение и медицинские услуги по опубликованным ценам.', url: 'https://clinic.example/services' }, plan, 'https://gemotest.ru/')).toBe(true);
  });

  it('keeps unrelated external businesses out of a manufacturers process evidence and competitors', () => {
    const research = saved('kamaz');
    const analysis = analyse(research);
    for (const opportunity of analysis.opportunities.filter(item => item.processEvidence?.status !== 'customer-experience')) {
      expect(opportunity.evidence.length).toBeGreaterThan(0);
      expect(opportunity.evidence.every(proof => ['company-site', 'local-document'].includes(proof.kind))).toBe(true);
      expect(opportunity.evidence.every(proof => !/oil-time|bizrental|made-in-china/.test(proof.url))).toBe(true);
    }
    const plan = { industry: 'manufacturing', subject: 'грузовые автомобили', companyName: 'КАМАЗ', relevance: /производств/i };
    expect(isCompetitorCandidate({ title: 'Сервисное обслуживание грузовых автомобилей', text: 'Сервисное обслуживание грузовых автомобилей. Замена масла. Запишитесь на обслуживание.', url: 'https://oil-time.ru/' }, plan, 'https://kamaz.ru/')).toBe(false);
    expect(isCompetitorCandidate({ title: 'Грузоперевозки', text: 'Грузовые автомобили в аренду, грузоперевозки по Москве.', url: 'https://rent.example/' }, plan, 'https://kamaz.ru/')).toBe(false);
    expect(isCompetitorCandidate({ title: 'Поставщики грузовых автомобилей', text: 'Каталог производителей грузовых автомобилей, цены поставщиков.', url: 'https://ru.made-in-china.com/manufacturers/truck.html' }, plan, 'https://kamaz.ru/')).toBe(false);
  });
});
