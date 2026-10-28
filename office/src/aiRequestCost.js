// Rates are supplied by Laravel from the validated official pricing page.
export function aiRequestCost(run, pricing) {
  const rate = pricing?.rates?.[run.model];
  if (!rate || !Number.isFinite(rate.input) || !Number.isFinite(rate.output) || rate.input <= 0 || rate.output <= 0 || run.status !== 'completed') return null;
  if ([run.input_tokens, run.output_tokens].some(value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) return null;
  const cached = run.cached_input_tokens == null ? 0 : Number(run.cached_input_tokens);
  if (!Number.isInteger(cached) || cached < 0 || cached > Number(run.input_tokens)) return null;
  if (cached > 0 && (!Number.isFinite(rate.cached_input) || rate.cached_input < 0 || rate.cached_input > rate.input)) return null;
  const input = ((Number(run.input_tokens) - cached) * rate.input + (cached > 0 ? cached * rate.cached_input : 0)) / 1_000_000;
  const output = Number(run.output_tokens) * rate.output / 1_000_000;
  return { input, output, total: input + output };
}

export function formatAiCost(value) {
  if (value === null || value === undefined) return 'Unavailable';
  if (value > 0 && value < 0.000001) return '<$0.000001';
  return `$${value.toFixed(6)}`;
}
