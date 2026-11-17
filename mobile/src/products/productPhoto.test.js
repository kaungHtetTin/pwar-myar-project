import { afterEach, describe, expect, it, vi } from 'vitest';
import { cropProductPhoto, PRODUCT_PHOTO_MAX_BYTES } from './productPhoto';

afterEach(() => vi.restoreAllMocks());

describe('product photo processing', () => {
  it('creates a square JPEG no larger than 50 KB', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:source');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    class TestImage {
      naturalWidth = 1200;
      naturalHeight = 800;
      set src(_value) { queueMicrotask(() => this.onload()); }
    }
    vi.stubGlobal('Image', TestImage);
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName !== 'canvas') return originalCreateElement(tagName, options);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }),
        toBlob: (callback, type, quality) => callback(new Blob([new Uint8Array(quality > 0.5 ? 60 * 1024 : 40 * 1024)], { type })),
      };
    });

    const result = await cropProductPhoto(new File(['source'], 'source.png', { type: 'image/png' }), { zoom: 1.4, x: 20, y: -10 });

    expect(result).toBeInstanceOf(File);
    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBeLessThanOrEqual(PRODUCT_PHOTO_MAX_BYTES);
  });

  it('rejects unsupported source formats', async () => {
    await expect(cropProductPhoto(new File(['source'], 'source.gif', { type: 'image/gif' }))).rejects.toThrow(/JPG, PNG or WebP/);
  });
});
