import { describe, expect, it } from 'vitest';
import { orderRoadmap } from './orderRoadmapSteps';

describe('order status roadmap', () => {
  it.each(['pickup', 'delivery'])('shows reached, current and upcoming %s stages', fulfillment => {
    const steps = orderRoadmap({ fulfillment, status: 'packing', events: [] });
    expect(steps.map(step => step.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(steps[3].key).toBe(fulfillment === 'pickup' ? 'ready_for_pickup' : 'dispatched');
    expect(steps[4].key).toBe('completed');
    expect(steps[4].date).toBeNull();
  });

  it('does not imply that a cancelled order reached packing or completion', () => {
    const steps = orderRoadmap({ fulfillment: 'delivery', status: 'cancelled', events: [{ event: 'accepted' }, { event: 'cancelled' }] });
    expect(steps.map(step => step.key)).toEqual(['pending', 'accepted', 'cancelled']);
    expect(steps.at(-1)).toMatchObject({ state: 'current', tone: 'danger' });
  });

  it('ends a failed delivery at return pending instead of showing completion', () => {
    const steps = orderRoadmap({ fulfillment: 'delivery', status: 'return_pending' });
    expect(steps.map(step => step.key)).toEqual(['pending', 'accepted', 'packing', 'dispatched', 'return_pending']);
    expect(steps.at(-1)).toMatchObject({ state: 'current', tone: 'warning' });
  });

  it('resets event dates after reopening an expired order', () => {
    const steps = orderRoadmap({ fulfillment: 'pickup', status: 'pending', created_at: '2026-10-10 10:00:00', events: [
      { event: 'created', created_at: '2026-10-10 10:00:00' },
      { event: 'accepted', created_at: '2026-10-10 11:00:00' },
      { event: 'expired', created_at: '2026-10-11 10:00:00' },
      { event: 'reopened', created_at: '2026-10-14 10:00:00' },
    ] });
    expect(steps[0]).toMatchObject({ state: 'current', date: '2026-10-14 10:00:00' });
    expect(steps[1]).toMatchObject({ state: 'upcoming', date: null });
  });

  it('marks the final stage current and successful for a completed order', () => {
    const steps = orderRoadmap({ fulfillment: 'pickup', status: 'completed' });
    expect(steps.slice(0, -1).every(step => step.state === 'done')).toBe(true);
    expect(steps.at(-1)).toMatchObject({ key: 'completed', state: 'current', tone: 'success' });
  });
});
