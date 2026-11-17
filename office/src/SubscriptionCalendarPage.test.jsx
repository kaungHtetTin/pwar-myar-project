import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { officeDay } from './dateTime';
import { calendarLabel } from './subscriptionCalendar';
import SubscriptionCalendarPage from './SubscriptionCalendarPage';
import { RetainedActivityContext } from './retainedActivity';

vi.mock('./api', () => ({ api: vi.fn() }));
const month = officeDay(new Date().toISOString()).slice(0, 7), day = `${month}-13`;
const business = { id: 11, name: 'Calendar Shop', owner_name: 'Owner', owner_email: 'owner@example.test', plan_name: 'Monthly plan', access_type: 'paid', access_state: 'paid', ends_at: `${day}T08:00:00Z` };
function monthly(value = month) { return { month: value, today: `${month}-10`, timezone: 'Asia/Yangon', summary: { trial: 4, paid: 12, expired: 3 }, days: [{ day: `${value}-13`, trial: 2, paid: 3, total: 5 }] }; }
const dayButton = () => screen.getByRole('button', { name: `${calendarLabel(day)}: 2 trials ending, 3 paid plans expiring` });
beforeEach(() => {
  api.mockReset();
  api.mockImplementation(path => {
    const params = new URLSearchParams(path.split('?')[1]);
    return Promise.resolve(path.startsWith('/office/subscription-calendar/day?') ? { items: [business], total: 1, has_more: false, offset: 0, limit: 25 } : monthly(params.get('month')));
  });
});

it('renders per-date counts and opens the selected business once', async () => {
  const open = vi.fn(); render(<SubscriptionCalendarPage onOpenBusiness={open} />);
  await waitFor(() => expect(dayButton()).not.toBeDisabled());
  expect(screen.getByRole('grid')).toBeInTheDocument(); expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(dayButton()).toHaveClass('is-danger');
  fireEvent.click(dayButton());
  const dialog = await screen.findByRole('dialog');
  expect(await within(dialog).findByText('Calendar Shop')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'View business' })); expect(open).toHaveBeenCalledExactlyOnceWith(11);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close', exact: true })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('navigates months, Today and a directly selected month', async () => {
  render(<SubscriptionCalendarPage />); await waitFor(() => expect(dayButton()).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Next month' })); await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' })); await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining(`month=${month}`)));
  fireEvent.change(screen.getByLabelText('Calendar month'), { target: { value: '2032-02' } }); await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('month=2032-02')));
  fireEvent.click(screen.getByRole('button', { name: 'Today', exact: true })); await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining(`month=${month}`)));
});

it('retains search while applying and clearing the plan filter and discards cancelled drafts', async () => {
  render(<SubscriptionCalendarPage />); await waitFor(() => expect(dayButton()).not.toBeDisabled());
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Owner' } }); fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=Owner')));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' })); fireEvent.change(screen.getByLabelText('Plan type'), { target: { value: 'trial' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Filters' })); expect(screen.getByLabelText('Plan type')).toHaveValue('all');
  fireEvent.change(screen.getByLabelText('Plan type'), { target: { value: 'paid' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('kind=paid&q=Owner')));
  fireEvent.click(screen.getByRole('button', { name: 'Filters1' })); fireEvent.click(screen.getByRole('button', { name: 'Clear', exact: true }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('kind=all&q=Owner')));
  fireEvent.click(screen.getByRole('button', { name: 'Clear search calendar businesses' })); await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('kind=all&q=')));
});

it('preserves calendar, selected date and loaded panel when hidden and shown', async () => {
  const view = active => <RetainedActivityContext.Provider value={active}><SubscriptionCalendarPage /></RetainedActivityContext.Provider>;
  const { rerender } = render(view(true)); await waitFor(() => expect(dayButton()).not.toBeDisabled());
  fireEvent.click(dayButton()); await screen.findByText('Calendar Shop'); const calls = api.mock.calls.length;
  rerender(view(false)); rerender(view(true)); expect(screen.getByRole('dialog')).toHaveTextContent('Calendar Shop'); expect(api).toHaveBeenCalledTimes(calls);
});

it('recovers calendar and day-panel errors and supports empty dates', async () => {
  api.mockRejectedValueOnce(new Error('Calendar unavailable'));
  render(<SubscriptionCalendarPage />); expect(await screen.findByRole('alert')).toHaveTextContent('Calendar unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry calendar' })); await waitFor(() => expect(dayButton()).not.toBeDisabled());
  api.mockRejectedValueOnce(new Error('Day unavailable')); fireEvent.click(dayButton()); expect(await screen.findByRole('alert')).toHaveTextContent('Day unavailable');
  api.mockResolvedValueOnce({ items: [], total: 0, has_more: false });
  fireEvent.click(screen.getByRole('button', { name: 'Retry businesses' })); await screen.findByText('No plans end on this date.');
});

it('appends bounded day pages and retains businesses if a later page fails', async () => {
  const normal = api.getMockImplementation();
  api.mockImplementation(path => path.includes('/day?') ? Promise.resolve({ items: Array.from({ length: 25 }, (_, id) => ({ ...business, id: id + 1, name: `Shop ${id + 1}` })), total: 26, offset: 0, limit: 25, has_more: true }) : normal(path));
  render(<SubscriptionCalendarPage />); await waitFor(() => expect(dayButton()).not.toBeDisabled()); fireEvent.click(dayButton()); await screen.findByText('Shop 25');
  api.mockRejectedValueOnce(new Error('More unavailable')); fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByRole('alert'); expect(screen.getByText('Shop 25')).toBeInTheDocument();
  api.mockResolvedValueOnce({ items: [{ ...business, id: 26, name: 'Shop 26' }], total: 26, offset: 25, limit: 25, has_more: false });
  fireEvent.click(screen.getByRole('button', { name: 'Retry businesses' })); await screen.findByText('Shop 26');
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument(); expect(screen.getByText('Shop 1')).toBeInTheDocument();
});

it('supports arrow-key focus and reloads after subscription changes', async () => {
  render(<SubscriptionCalendarPage />); await waitFor(() => expect(dayButton()).not.toBeDisabled());
  act(() => dayButton().focus()); fireEvent.keyDown(dayButton(), { key: 'ArrowRight' }); expect(document.activeElement).toHaveAttribute('data-day', `${month}-14`);
  const count = api.mock.calls.length; act(() => window.dispatchEvent(new Event('mkpos:office-subscription-changed')));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(count + 1));
});
