import { describe, expect, it } from 'vitest';
import { createEnterpriseLead, submitEnterpriseLead } from '../shared/enterprise-lead.js';

const valid = { name: 'Иван', email: 'ivan@example.com', company: 'ООО «Пример»', website: 'https://example.com/', process: 'Квалификация запроса', hypothesis: 'Проверить процесс', comment: 'Сначала NDA' };

describe('enterprise lead', () => {
  it('creates a contextual request without adding paid services', () => {
    const lead = createEnterpriseLead(valid);
    expect(lead.comment).toContain('https://example.com/');
    expect(lead.comment).toContain('Квалификация запроса');
    expect(lead.comment).toContain('Сначала NDA');
    expect(lead.services).toEqual([]);
    expect(lead.packages).toEqual([]);
    expect(lead.totalNew).toBe('');
  });
  it('escapes user text in the existing Telegram HTML channel', () => {
    const lead = createEnterpriseLead({ ...valid, name: '<b>Иван</b>', comment: 'R&D <audit> & данные' });
    expect(lead.messageText).toContain('&lt;b&gt;Иван&lt;/b&gt;');
    expect(lead.messageText).toContain('R&amp;D &lt;audit&gt; &amp; данные');
    expect(lead.messageText).not.toContain('<b>Иван</b>');
  });
  it('requires a name and a usable contact', () => {
    expect(() => createEnterpriseLead({ ...valid, name: '' })).toThrow('имя');
    expect(() => createEnterpriseLead({ ...valid, email: '', phone: '' })).toThrow('телефон или email');
    expect(() => createEnterpriseLead({ ...valid, email: 'broken' })).toThrow('почты');
  });
  it('accepts only a server-confirmed delivery', async () => {
    const request = async () => new Response(JSON.stringify({ success: true, mailSent: true, tgSent: false }), { status: 200 });
    await expect(submitEnterpriseLead(valid, request)).resolves.toMatchObject({ success: true });
  });
  it('rejects transport failures and false positive delivery responses', async () => {
    await expect(submitEnterpriseLead(valid, async () => new Response(JSON.stringify({ success: true, mailSent: false, tgSent: false }), { status: 200 }))).rejects.toThrow('не подтвердил');
    await expect(submitEnterpriseLead(valid, async () => new Response(JSON.stringify({ success: false, error: 'Проверьте контакт' }), { status: 400 }))).rejects.toThrow('Проверьте контакт');
  });
});
