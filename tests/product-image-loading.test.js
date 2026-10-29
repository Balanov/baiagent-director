import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src/ResultDashboard.jsx', import.meta.url), 'utf8');

describe('primary product image loading', () => {
  it('loads the four visible cards eagerly and retains an error fallback', () => {
    const imageContainer = source.match(/<div className="offering-image">[\s\S]*?<\/div>/)?.[0];
    expect(imageContainer).toContain('loading="eager"');
    expect(imageContainer).toContain('onError=');
    expect(imageContainer).not.toContain('loading="lazy"');
  });
});
