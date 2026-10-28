import { describe, expect, it } from 'vitest';
import { buildPilotBlueprint } from '../shared/pilot.js';
import { getSolution } from '../shared/solutions.js';

const base = {
  category: 'cost',
  metric: 'Время обработки документа и доля ошибок.',
  decision: 'Масштабировать после подтверждения качества на эталоне.',
};

describe('operational pilot blueprint', () => {
  it('requires real inputs and names the actual accounting contour', () => {
    const pilot = buildPilotBlueprint(base, getSolution('ocr-idp'));
    expect(pilot.data).toContain('Эталонные счета');
    expect(pilot.integrations).toContain('1С');
    expect(pilot.humanControl).toContain('подтверждает');
    expect(pilot.owner).toContain('Владелец');
    expect(pilot.scaleRule).toBe(base.decision);
  });

  it('does not invent a numerical target before the baseline is measured', () => {
    const pilot = buildPilotBlueprint(base, getSolution('rpa'));
    expect(pilot.baseline).toContain(base.metric);
    expect(pilot.target).toContain('после исходного замера');
    expect(pilot.effectFormula).toContain('стоимость пилота');
    expect(pilot.stopRule).toContain('Остановить');
  });

  it('does not pretend an unknown integration is already supported', () => {
    const pilot = buildPilotBlueprint({ category: 'offering' }, null);
    expect(pilot.integrations).toContain('нужно подтвердить');
    expect(pilot.integrations).toContain('не считается уже готовой');
  });
});
