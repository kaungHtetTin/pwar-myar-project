import { expect, it } from 'vitest';
import { aiRequestCost, formatAiCost } from './aiRequestCost';

const pricing = { rates: { 'deepseek-flash': { input: 0.3, output: 1.2 }, 'deepseek-v4-pro': { input: 1.32, output: 3.96 } } };

it('calculates separate input and output costs for each supported model', () => {
  const run = { status: 'completed', input_tokens: 1_000_000, output_tokens: 500_000 };
  for (const model of ['deepseek-flash']) {
    const cost = aiRequestCost({ ...run, model }, pricing);
    expect(cost.input).toBeCloseTo(0.3);
    expect(cost.output).toBeCloseTo(0.6);
    expect(cost.total).toBeCloseTo(0.9);
  }
  const cost = aiRequestCost({ ...run, model: 'deepseek-v4-pro' }, pricing);
  expect(cost.input).toBeCloseTo(1.32);
  expect(cost.output).toBeCloseTo(1.98);
  expect(cost.total).toBeCloseTo(3.30);
});

it('does not present unknown or incomplete usage as free', () => {
  const run = { model: 'deepseek-flash', status: 'completed', input_tokens: 0, output_tokens: 0 };
  expect(aiRequestCost(run, pricing).total).toBe(0);
  expect(aiRequestCost({ ...run, model: 'custom-model' }, pricing)).toBeNull();
  expect(aiRequestCost({ ...run, status: 'failed' }, pricing)).toBeNull();
  for (const value of [null, undefined, '', -1, 'bad']) {
    expect(aiRequestCost({ ...run, input_tokens: value }, pricing)).toBeNull();
  }
  expect(aiRequestCost(run)).toBeNull();
  expect(formatAiCost(undefined)).toBe('Unavailable');
});

it('keeps sub-cent amounts visible', () => {
  expect(formatAiCost(0)).toBe('$0.000000');
  expect(formatAiCost(0.00042)).toBe('$0.000420');
  expect(formatAiCost(0.0000003)).toBe('<$0.000001');
});

it('uses refreshed rates supplied by the server', () => {
  const run = { model: 'deepseek-flash', status: 'completed', input_tokens: 1000000, output_tokens: 1000000 };
  expect(aiRequestCost(run, { rates: { 'deepseek-flash': { input: 2, output: 3 } } }).total).toBe(5);
});

it('prices cache hits as a subset of input, including full hits and unknown legacy usage', () => {
  const cachePricing = { rates: { 'deepseek-flash': { input: 0.3, output: 1.2, cached_input: 0.006 } } };
  const run = { model: 'deepseek-flash', status: 'completed', input_tokens: 1000, output_tokens: 100 };
  const mixed = aiRequestCost({ ...run, cached_input_tokens: 800 }, cachePricing);
  expect(mixed.input).toBeCloseTo(0.0000648, 10);
  expect(mixed.output).toBeCloseTo(0.00012, 10);
  expect(mixed.total).toBeCloseTo(0.0001848, 10);
  expect(aiRequestCost({ ...run, cached_input_tokens: 1000 }, cachePricing).total).toBeCloseTo(0.000126, 10);
  for (const cached_input_tokens of [0, null, undefined]) {
    expect(aiRequestCost({ ...run, cached_input_tokens }, cachePricing).total).toBeCloseTo(0.00042, 10);
  }
  expect(aiRequestCost({ ...run, cached_input_tokens: 1000 }, { rates: { 'deepseek-flash': { input: 0.3, output: 1.2, cached_input: 0 } } }).input).toBe(0);
});

it('rejects impossible cache counts and missing cache prices instead of giving a false discount', () => {
  const run = { model: 'deepseek-flash', status: 'completed', input_tokens: 100, output_tokens: 10 };
  for (const cached_input_tokens of [-1, 101, 0.5, 'bad']) {
    expect(aiRequestCost({ ...run, cached_input_tokens }, pricing)).toBeNull();
  }
  expect(aiRequestCost({ ...run, cached_input_tokens: 50 }, pricing)).toBeNull();
});
