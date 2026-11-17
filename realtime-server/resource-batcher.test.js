import assert from 'node:assert/strict';
import test from 'node:test';
import { createResourceBatcher } from './resource-batcher.js';

test('coalesces busy tenant invalidations without crossing business/public boundaries', async t => {
  const frames = [];
  const batcher = createResourceBatcher((channel, data) => frames.push({ channel, data }));
  t.after(() => batcher.stop());
  for (let i = 0; i < 100; i++) batcher.enqueue('private-business.resources.42', ['products', 'reports']);
  batcher.enqueue('private-business.resources.42', ['categories']);
  batcher.enqueue('private-business.resources.43', ['settings']);
  batcher.enqueue('public-platform.branding', ['branding']);
  assert.equal(frames.length, 0);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.deepEqual(frames, [
    { channel: 'private-business.resources.42', data: { resources: ['products', 'reports', 'categories'] } },
    { channel: 'private-business.resources.43', data: { resources: ['settings'] } },
    { channel: 'public-platform.branding', data: { resources: ['branding'] } },
  ]);
  batcher.enqueue('private-business.resources.42', ['sales']);
  batcher.stop();
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(frames.length, 3);
});
