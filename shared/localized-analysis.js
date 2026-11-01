import { ANALYSIS_COPY } from './analysis-copy.js';
import { researchLanguage } from './locale.js';
import { createBusinessProfile } from './business.js';
import { createMarketIntelligence, offeringDisplayName } from './advisor.js';
import { createMarketSearchPlan } from './market-plan.js';
import { verifyAnalysis, normalizeEvidenceText } from './verification.js';

function fill(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}
function quoteFrom(source) {
  const sentences = String(source?.text || '').match(/[^.!?…]+[.!?…]?/g) || [];
  const quote = sentences.find(item => item.trim().length >= 35 && item.trim().length <= 500)?.trim() || String(source?.text || '').slice(0, 400).trim();
  return source && quote.length >= 12 ? { sourceId: source.id, sourceTitle: source.title, url: source.url, quote, kind: source.kind } : null;
}
function offeringEvidence(item, sources) {
  const source = sources.find(candidate => candidate.id === item?.sourceId);
  if (!source || !item?.quote || !normalizeEvidenceText(source.text).includes(normalizeEvidenceText(item.quote))) return null;
  return { sourceId: source.id, sourceTitle: source.title, url: item.url || source.url, quote: item.quote, kind: source.kind };
}
function usefulOffering(item) {
  const name = offeringDisplayName(item);
  return item?.quote && name.length >= 3 && name.length <= 100 && !/^(?:products?|services?|solutions?|software|platform|home|menu)$/i.test(name);
}

export function localizeBusinessProfile(profile = {}, research = {}) {
  const language = researchLanguage(research);
  if (language === 'ru') return profile;
  const copy = ANALYSIS_COPY[language];
  const plan = createMarketSearchPlan(research, profile);
  return {
    ...profile,
    industry: profile.industry ? { ...profile.industry, label: plan.subject } : { id: 'professional', label: plan.subject },
    segments: (profile.segments || []).map(item => ({ ...item, label: copy.segments[item.id] || item.label })),
  };
}

function localizedMarket(market, copy) {
  const observations = (market.observations || []).map((item, index) => ({ ...item, label: copy.market[index]?.[0] || item.label, detail: copy.market[index]?.[1] || item.detail }));
  const gaps = [];
  if (!market.mentions?.length) gaps.push(copy.gaps[0]);
  if (!market.reviews?.length) gaps.push(copy.gaps[1]);
  if (!market.news?.length && !market.industryEvidence?.length) gaps.push(copy.gaps[2]);
  if (!market.competitors?.length && !market.alternatives?.length) gaps.push(copy.gaps[3]);
  if (!market.coverage?.localDocuments) gaps.push(copy.gaps[4]);
  // Keep the original verified review fields; Russian-only derived themes
  // must not leak into an international result.
  const reviews = (market.reviews || []).map(item => ({ ...item, themes: [] }));
  return { ...market, reviews, observations, gaps };
}

export function createLocalizedAnalysis(sources, requestedUrl = '', research = {}) {
  const data = { ...research, sources, requestedUrl };
  const language = researchLanguage(data);
  if (language === 'ru') throw new Error('Russian research uses the existing analysis pipeline.');
  const copy = ANALYSIS_COPY[language];
  const usable = sources.filter(source => String(source.text || '').length >= 20);
  if (!usable.length) throw new Error('No readable public source text was retrieved.');
  const originalProfile = createBusinessProfile(data);
  const plan = createMarketSearchPlan(data, originalProfile);
  const market = localizedMarket(createMarketIntelligence({ ...data, language, marketContext: plan }), copy);
  const profile = localizeBusinessProfile(originalProfile, { ...data, language });
  const ownOffering = (data.offerings || []).find(usefulOffering) || market.offerings.find(usefulOffering);
  const own = offeringEvidence(ownOffering, usable) || quoteFrom(usable.find(source => source.kind === 'company-site') || usable[0]);
  const base = quoteFrom(usable.find(source => source.kind === 'company-site') || usable[0]) || own;
  const review = quoteFrom(usable.find(source => source.kind === 'review-snippet'));
  const competitor = quoteFrom(usable.find(source => source.kind === 'competitor-candidate'));
  const industry = quoteFrom(usable.find(source => ['industry-snippet', 'customer-snippet', 'news-snippet'].includes(source.kind)));
  const companyName = data.companyName || usable[0]?.companyName || (() => { try { return new URL(requestedUrl).hostname.replace(/^www\./, ''); } catch { return 'Company'; } })();
  const offering = ownOffering ? offeringDisplayName(ownOffering) : plan.subject;
  const offerings = market.offerings.slice(0, 4).map(item => offeringDisplayName(item)).join('; ') || plan.subject;
  const summary = fill(copy.summary, { company: companyName, subject: plan.subject, offerings });
  const definitions = copy.opportunities.map(([title, why, action, metric], index) => ({
    id: `opportunity-${index + 1}`,
    title, why, action: fill(action, { offering }), metric,
    category: ['revenue', 'cost', 'offering'][index], confidence: 'low',
    unknowns: copy.unknowns, decision: copy.decision, steps: copy.steps,
    evidence: [index === 2 && review ? review : index === 0 ? own : base].filter(Boolean),
  }));
  const swot = [
    { category: 'strength', title: copy.swot.strength, evidence: [own] },
    competitor ? { category: 'threat', title: copy.swot.threat, evidence: [competitor] } : null,
    review || industry ? { category: 'opportunity', title: copy.swot.opportunity, evidence: [review || industry] } : null,
    { category: 'weakness', title: copy.swot.weakness, evidence: [base] },
  ].filter(item => item?.evidence?.every(Boolean));
  const verified = verifyAnalysis({ companyName, language, summary, opportunities: definitions, swot }, usable);
  const acceptedIds = new Set(verified.opportunities.map(item => item.title));
  // Keep a bounded, source-linked fallback if generic evidence classification
  // rejected a hypothesis. The quote itself is still checked against the source.
  for (const raw of definitions) {
    if (acceptedIds.has(raw.title) || verified.opportunities.length >= 3) continue;
    verified.opportunities.push({ ...raw, evidence: raw.evidence.filter(item => normalizeEvidenceText(usable.find(source => source.id === item.sourceId)?.text).includes(normalizeEvidenceText(item.quote))), status: 'hypothesis' });
  }
  verified.opportunities = verified.opportunities.filter(item => item.evidence.length).slice(0, 3).map((item, index) => {
    const categoryIndex = Math.max(0, ['revenue', 'cost', 'offering'].indexOf(item.category));
    return {
      ...item, id: `opportunity-${index + 1}`, language,
      processName: item.title, processAction: item.action,
      input: copy.data[0], output: copy.work[3][1],
      workSteps: copy.work.map(([name, description], step) => ({ stage: `stage-${step + 1}`, name, description })),
      owner: copy.owner, requiredData: copy.data, integrations: copy.systems, escalation: copy.escalation,
      baselineMetrics: copy.baseline, qualityMetrics: copy.quality, businessMetric: item.metric,
      simpleAlternative: copy.simple, riskControls: copy.risks,
      acceptance: {
        cases: copy.cases.map(([type, name, input, expected, assertion], caseIndex) => ({ id: `case-${caseIndex + 1}`, type, name, input, expected, assertions: [assertion] })),
        metrics: [
          { id: 'quality', name: copy.quality[0], measure: copy.target },
          { id: 'business', name: item.metric, measure: copy.target },
        ],
        targetPolicy: copy.target,
        controls: { humanConfirmation: [copy.controls[0][0]], trace: [copy.controls[1][0]], rollbackStop: [copy.controls[2][0]], regression: [copy.controls[3][0]] },
      },
      readiness: { known: copy.ready, missing: copy.missing },
      priority: { rank: index + 1 },
    };
  });
  return { ...verified, language, summary: verified.summary || summary, mode: 'localized-evidence-rules', market, profile };
}

/** Retain verified model reasoning without losing the localised pilot contract. */
export function createLocalizedModelAnalysis(modelAnalysis, research, mode = 'qwen-embedded') {
  const fallback = createLocalizedAnalysis(research.sources, research.requestedUrl, research);
  const represented = new Set(modelAnalysis.opportunities.map(item => item.category));
  const supplements = fallback.opportunities.filter(item => !represented.has(item.category) && represented.add(item.category));
  const opportunities = [...modelAnalysis.opportunities, ...supplements].slice(0, 3).map((item, index) => {
    const plan = fallback.opportunities.find(candidate => candidate.category === item.category) || fallback.opportunities[0];
    if (!plan) return null;
    return {
      ...plan, ...item, id: `opportunity-${index + 1}`, language: fallback.language,
      processName: item.title, processAction: item.action, businessMetric: item.metric,
      steps: item.steps?.length ? item.steps : plan.steps,
      decision: item.decision || plan.decision,
      acceptance: {
        ...plan.acceptance,
        metrics: (plan.acceptance?.metrics || []).map(metric => metric.id === 'business' ? { ...metric, name: item.metric } : metric),
      },
      priority: { rank: index + 1 },
    };
  }).filter(Boolean);
  const verified = verifyAnalysis({
    ...fallback, ...modelAnalysis, opportunities,
    swot: modelAnalysis.swot?.length >= 2 ? modelAnalysis.swot : fallback.swot,
  }, research.sources);
  const copy = ANALYSIS_COPY[fallback.language];
  verified.opportunities = verified.opportunities.map((item, index) => ({
    ...item, id: `opportunity-${index + 1}`, language: fallback.language,
    processName: item.title, processAction: item.action,
    input: copy.data[0], output: copy.work[3][1],
    workSteps: copy.work.map(([name, description], step) => ({ stage: `stage-${step + 1}`, name, description })),
    owner: copy.owner, requiredData: copy.data, integrations: copy.systems, escalation: copy.escalation,
    baselineMetrics: copy.baseline, qualityMetrics: copy.quality, businessMetric: item.metric,
    simpleAlternative: copy.simple, riskControls: copy.risks,
    acceptance: {
      cases: copy.cases.map(([type, name, input, expected, assertion], caseIndex) => ({ id: `case-${caseIndex + 1}`, type, name, input, expected, assertions: [assertion] })),
      metrics: [{ id: 'quality', name: copy.quality[0], measure: copy.target }, { id: 'business', name: item.metric, measure: copy.target }],
      targetPolicy: copy.target,
      controls: { humanConfirmation: [copy.controls[0][0]], trace: [copy.controls[1][0]], rollbackStop: [copy.controls[2][0]], regression: [copy.controls[3][0]] },
    },
    readiness: { known: copy.ready, missing: copy.missing }, priority: { rank: index + 1 },
  }));
  return { ...verified, market: fallback.market, profile: fallback.profile, language: fallback.language, mode };
}
