import { describe, expect, it } from 'vitest';
import { companyNameFrom, companyNameFromPages, parsePage, selectExternalSources } from '../electron/research.mjs';
import { createBusinessProfile } from '../shared/business.js';
import { competitorNameFrom, createMarketSearchPlan, isCompetitorCandidate } from '../shared/market-plan.js';
import { isInternationalCompetitorContent, isInternationalCompetitorPage, isInternationalReviewMaterial } from '../shared/international-market.js';

const mideaResearch = {
  language: 'zh', companyName: 'MIDEA',
  sources: [{ id: 'site-1', kind: 'company-site', title: 'English', text: 'Midea Group Smart Home Providing customers with full home automation service. Industrial Technology provides global industrial clients with intelligent products and solutions. Midea Healthcare is one division of the group.' }],
};
const atlassianResearch = {
  language: 'en', companyName: 'Atlassian',
  sources: [{ id: 'site-1', kind: 'company-site', title: 'Atlassian', text: 'Atlassian develops Jira and Confluence, team collaboration software and project management products for businesses.' }],
  offerings: [{ name: 'Jira' }, { name: 'Confluence' }, { name: 'Bitbucket' }],
};

describe('international evidence arbitration', () => {
  it('does not treat a language selector as a company name', () => {
    expect(companyNameFrom(mideaResearch.sources[0], 'https://www.midea.com.cn/')).toBe('MIDEA');
  });
  it('uses the company-wide manufacturing model rather than a single healthcare division', () => {
    const profile = createBusinessProfile(mideaResearch);
    expect(profile.industry.id).toBe('manufacturing');
    const plan = createMarketSearchPlan(mideaResearch, profile);
    expect(plan.industry).toBe('manufacturing');
  });
  it('keeps software competitors within the actual collaboration category', () => {
    const plan = createMarketSearchPlan(atlassianResearch, createBusinessProfile(atlassianResearch));
    expect(plan.softwareFamily).toBe('collaboration');
    expect(isCompetitorCandidate({ title: 'Networking Software - Cisco', url: 'https://www.cisco.com/site/us/en/products/networking/software/index.html', text: 'Networking software and cloud platform for enterprise networks.' }, plan, 'https://www.atlassian.com/')).toBe(false);
    expect(isCompetitorCandidate({ title: 'monday.com work management', url: 'https://monday.com/', text: 'Our work management and team collaboration software helps businesses manage projects. Start a trial on our platform.' }, plan, 'https://www.atlassian.com/')).toBe(true);
    expect(isCompetitorCandidate({ title: 'The Gemini - Crunchbase Company Profile', url: 'https://www.crunchbase.com/organization/the-gemini', text: 'Team collaboration software platform for business.' }, plan, 'https://www.atlassian.com/')).toBe(false);
    const text = 'Project management software and team collaboration platform for business. Start a trial.';
    expect(isCompetitorCandidate({ title: 'Bitbucket', url: 'https://bitbucket.org/', text }, plan, 'https://www.atlassian.com/')).toBe(false);
    expect(isCompetitorCandidate({ title: 'Microsoft Planner', url: 'https://www.microsoft.com/en-us/microsoft-365/planner', text }, plan, 'https://www.atlassian.com/')).toBe(true);
  });
  it('recognises a postal and parcel operator instead of inferring a restaurant', () => {
    const research = { language: 'es', companyName: 'Correos', sources: [{ id: 'site-1', kind: 'company-site', title: 'Correos', text: 'Sigue tu envío, envía paquetes y cartas. Localiza tu envío y encuentra tu oficina. Servicios de paquetería para particulares y empresas.' }] };
    expect(createBusinessProfile(research).industry.id).toBe('logistics');
  });
  it('recognises the corporate brand instead of a service-page title', () => {
    const pages = [
      { kind: 'company-site', title: 'English', text: 'Midea Group Smart Home and Industrial Technology.' },
      { kind: 'company-site', title: "Midea's service", text: 'Midea service and repairs.' },
      { kind: 'company-site', title: 'About Midea', text: 'Midea Group manufactures home appliances.' },
    ];
    expect(companyNameFromPages(pages, 'https://www.midea.com.cn/')).toBe('Midea Group');
    const plan = createMarketSearchPlan({ ...mideaResearch, companyName: 'Midea Group' }, { industry: { id: 'manufacturing' } });
    expect(plan.productFamily).toBe('home-appliances');
    expect(plan.competitorQueries.join(' ')).toContain('家电');
    expect(isInternationalCompetitorContent('Industrial microscopes manufactured for laboratories. Browse products and buy.', plan)).toBe(false);
    expect(isInternationalCompetitorContent('We manufacture refrigerators, washing machines and smart home appliances. View products and prices.', plan)).toBe(true);
  });
  it('uses a verified hostname brand instead of a locale or descriptive slogan', () => {
    expect(competitorNameFrom({ title: 'España', url: 'https://mydhl.express.dhl/es/es/home.html', text: 'DHL ofrece servicios de logística, transporte, paquetería y entrega para empresas.' })).toBe('DHL');
    expect(competitorNameFrom({ title: 'Transporte y Entrega de Mercancías | Logística Confiable', url: 'https://www.servientrega.com/', text: 'Servicios de transporte y paquetería para empresas.' })).toBe('servientrega');
    expect(competitorNameFrom({ title: 'Transporte España', url: 'https://zakatrans.com/', text: 'Servicios de transporte internacional.' })).toBe('zakatrans');
    expect(competitorNameFrom({ title: 'Envíos desde China a Bahrein', url: 'https://www.tonlexing.com/es/bahrain/', text: 'Servicios de transporte internacional.' })).toBe('tonlexing');
    expect(competitorNameFrom({ title: 'España', url: 'https://mydhl.express.dhl/es/es/home.html', text: 'Servicios de logística y entrega.' })).toBe('EXPRESS');
  });
  it('rejects directories, category comparisons and employment reviews', () => {
    expect(isInternationalCompetitorPage({ title: 'Best collaboration software', url: 'https://www.g2.com/categories/project-management' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: 'Manufacturer catalogue', url: 'https://pdf.aeroexpo.cn/pdf/example-184705.html' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: 'Seller question', url: 'https://www.wearesellers.com/question/64814' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: 'Microsoft Planner', url: 'https://www.microsoft.com/en-us/microsoft-365/planner' })).toBe(true);
    expect(isInternationalReviewMaterial({ title: 'Atlassian Reviews', url: 'https://www.ambitionbox.com/reviews/atlassian-reviews', text: 'Atlassian employees rate job security and work-life balance. 250 reviews.' })).toBe(false);
  });
  it('keeps a confirmed product title instead of an adjacent warranty control', () => {
    const source = parsePage('<html><head><title>Meditate AP 250 Air Purifier</title></head><body><article class="product-item"><h3>Add AMC / Extended Warranty</h3><span>Extended Warranty</span></article><h1>Meditate AP 250 Air Purifier</h1></body></html>', 'https://havells.com/meditate-ap-250-air-purifier-ghrapmae50.html', 'site-1');
    expect(source.offerings.map(item => item.name)).toContain('Meditate AP 250 Air Purifier');
    expect(source.offerings.map(item => item.name)).not.toContain('Extended Warranty');
    for (const name of ['Shop Now', 'Advanced Search', 'PRODUCT REGISTRATION', 'Add to Wish List', '了解更多', 'EN', '报装报修', '服务进度查询', '在线客服', '美的业务']) {
      const page = parsePage(`<html><head><title>${name}</title></head><body><article class="product-item"><h3>${name}</h3></article></body></html>`, 'https://havells.com/products/example', 'site-1');
      expect(page.offerings).toHaveLength(0);
    }
  });
  it('reads linked offers from framework-independent web components', () => {
    const page = parsePage('<html><head><title>Parcels</title></head><body><acme-product-offer><h2 slot="title">National parcel delivery</h2><p>Send parcels to every region.</p><acme-action href-link="/services/national-parcels"><span>See delivery service</span></acme-action></acme-product-offer></body></html>', 'https://post-example.com/', 'site-1');
    expect(page.offerings.map(item => item.name)).toContain('National parcel delivery');
    expect(page.links[0].href).toBe('/services/national-parcels');
  });
  it('rejects editorial marketing pages and generic mailbox reviews', () => {
    expect(isInternationalCompetitorPage({ title: 'Logistics marketing strategies', url: 'https://fastercapital.com/es/contenido/logistics-marketing.html' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: 'Transport company', url: 'https://www.europages.es/es/company/example/products/transport.html' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: '暖器可以代替地暖吗？四款适配全屋取暖的机型推荐', url: 'https://news.zol.com.cn/1266/12660762.html' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: '智能家居设备新未来 产品大全', url: 'https://example.cn/product/12.html' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: 'news.zol.com.cn/1266/12660762.html', url: 'https://news.zol.com.cn/1266/12660762.html', text: '四款适配全屋取暖的机型推荐' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: '智造再升级 湖北移动5G+AI...', url: 'https://example.cn/product/12.html', text: '首页 > 产品大全 > 智造再升级 新闻焦点' })).toBe(false);
    expect(isInternationalCompetitorPage({ title: 'Los 100 mejores transportistas de Londres', url: 'https://example.es/transportista/', text: 'Servicios de transporte y paquetería.' })).toBe(false);
    expect(isInternationalReviewMaterial({ title: 'Opiniones sobre buzón de correos', url: 'https://example.org/buzon-de-correos/', text: '12 opiniones. Recomiendo este buzón de correos por su calidad.' })).toBe(false);
    expect(isInternationalReviewMaterial({ title: 'Sany - Chinesisch Übersetzung | Reverso Context', url: 'https://context.reverso.net/übersetzung/englisch-chinesisch/Sany', text: 'Translation dictionary with service examples and reviews.' })).toBe(false);
  });
  it('does not let company mentions crowd out every other evidence category', () => {
    const mentions = Array.from({ length: 37 }, (_, index) => ({ id: `mention-${index}`, kind: 'search-snippet' }));
    const competitors = Array.from({ length: 5 }, (_, index) => ({ id: `competitor-${index}`, kind: 'competitor-candidate' }));
    const news = Array.from({ length: 3 }, (_, index) => ({ id: `news-${index}`, kind: 'news-snippet' }));
    const selected = selectExternalSources([...mentions, ...competitors, ...news]);
    expect(selected.filter(item => item.kind === 'competitor-candidate')).toHaveLength(5);
    expect(selected.filter(item => item.kind === 'news-snippet')).toHaveLength(3);
  });
});
