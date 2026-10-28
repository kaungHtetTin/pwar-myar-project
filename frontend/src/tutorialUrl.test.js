import { describe, expect, it } from 'vitest';
import { tutorialUrl } from './tutorialUrl';
describe('Tutorial website links', () => {
  it('uses the configured server and preserves deployment subpaths', () => {
    expect(tutorialUrl({ apiUrl: 'https://mkpos.example/public/api' })).toBe('https://mkpos.example/public/tutorials');
    expect(tutorialUrl({ apiUrl: '/public/api', origin: 'https://mkpos.example' })).toBe('https://mkpos.example/public/tutorials');
    expect(tutorialUrl({ apiUrl: '/api', devOrigin: 'http://127.0.0.1:8000' })).toBe('http://127.0.0.1:8000/tutorials');
    expect(tutorialUrl({ publicUrl: 'https://custom.example/site/' })).toBe('https://custom.example/site/tutorials');
  });
  it('rejects unsafe public site URLs', () => {
    expect(() => tutorialUrl({ publicUrl: 'javascript:alert(1)' })).toThrow();
    expect(() => tutorialUrl({ publicUrl: 'https://user:pass@example.test' })).toThrow();
  });
});

