import React from 'react';
import { act, render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesktopEntry, DesktopOnlineGate, DesktopOnlineModeControl } from './DesktopExperience';
import { NotificationProvider } from './notifications';

function render(ui) {
  return rtlRender(<NotificationProvider>{ui}</NotificationProvider>);
}

function offlineBridge(overrides = {}) {
  return {
    getBootstrap: vi.fn().mockResolvedValue({ online: false, cache_ready: true, pending_count: 0 }),
    getOfflineData: vi.fn().mockResolvedValue({
      session: {
        user: { id: 4, name: 'Cashier' },
        business: { id: 8, name: 'Offline Shop', currency: 'Ks' },
      },
      products: [{
        id: 10, name: 'Cached Product', category: 'Tests', barcode: '1001',
        base_unit: 'Piece', price: 2500, prices: [{ name: 'Retail', price: 2500 }],
      }],
      categories: ['Tests'],
      settings: { price_types: 'Retail', payment_methods: 'Cash,KPay,Credit' },
    }),
    createOfflineSale: vi.fn().mockImplementation(async (input) => ({
      id: 12,
      status: 'pending',
      local_total: 2500,
      created_at: '2026-08-07T03:30:00.000Z',
      payload: { ...input, paid_amount: 2500 },
    })),
    printReceipt: vi.fn().mockResolvedValue({ ok: true }),
    listOfflineSales: vi.fn().mockResolvedValue([]),
    onConnectivityChanged: vi.fn().mockReturnValue(() => {}),
    checkConnectivity: vi.fn().mockResolvedValue(false),
    switchMode: vi.fn().mockResolvedValue({ connected: true, mode: 'online' }),
    openOnline: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

afterEach(() => { delete window.mkposDesktop; });

describe('desktop offline experience', () => {
  it('renders only the cached POS and stores a fully paid local sale', async () => {
    const user = userEvent.setup();
    const bridge = offlineBridge();
    window.mkposDesktop = bridge;
    render(<DesktopEntry><div>Online application</div></DesktopEntry>);

    expect(await screen.findByText('Offline POS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tutorials' })).not.toBeInTheDocument();
    expect(screen.queryByText('Online application')).not.toBeInTheDocument();
    expect(screen.queryByText(/Stock \d/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cached Product/ }));
    await user.click(screen.getByRole('button', { name: 'Complete offline sale' }));

    await waitFor(() => expect(bridge.createOfflineSale).toHaveBeenCalledWith(expect.objectContaining({
      payment_method: 'Cash',
      items: [expect.objectContaining({ product_id: 10, quantity: 1 })],
    })));
    expect(await screen.findByRole('heading', { name: 'OFF-000012' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Print invoice' }));
    expect(bridge.printReceipt).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('Cached Product'),
    }));
  });

  it('blocks offline use when no authorized product cache exists', async () => {
    const user = userEvent.setup();
    const bridge = offlineBridge({
      getBootstrap: vi.fn().mockResolvedValue({ online: false, cache_ready: false, pending_count: 0 }),
      openOnline: vi.fn().mockRejectedValue(new Error('PwarMyar server is unavailable.')),
    });
    window.mkposDesktop = bridge;
    render(<DesktopEntry><div>Online application</div></DesktopEntry>);
    expect(await screen.findByText('Offline POS is not ready')).toBeInTheDocument();
    expect(screen.queryByText('Online application')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check connection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('PwarMyar server is unavailable.');
    expect(bridge.openOnline).toHaveBeenCalledOnce();
  });

  it('keeps queued invoices visible when the cached trial is no longer authorized', async () => {
    window.mkposDesktop = offlineBridge({
      getBootstrap: vi.fn().mockResolvedValue({
        online: false, cache_ready: false, pending_count: 1, failed_count: 0,
        session: { business: { currency: 'Ks' } },
      }),
      listOfflineSales: vi.fn().mockResolvedValue([{
        id: 12, status: 'pending', local_total: 2500, created_at: '2026-08-20T10:00:00Z', payload: { items: [] },
      }]),
    });
    render(<DesktopEntry><div>Online application</div></DesktopEntry>);
    expect(await screen.findByText('1 saved invoice(s) remain on this device')).toBeInTheDocument();
    expect(await screen.findByText(/OFF-000012/)).toBeInTheDocument();
    expect(screen.getByText('2,500 Ks')).toBeInTheDocument();
  });

  it('offers both desktop modes while connected and switches to offline on request', async () => {
    const user = userEvent.setup();
    const bridge = offlineBridge({
      getBootstrap: vi.fn().mockResolvedValue({
        online: true, connected: true, mode: 'online', cache_ready: true,
        pending_count: 0, failed_count: 0,
      }),
    });
    window.mkposDesktop = bridge;
    render(
      <DesktopEntry>
        <aside aria-label="Left navigation"><nav><DesktopOnlineModeControl /></nav></aside>
        <div>Online application</div>
      </DesktopEntry>,
    );

    expect(await screen.findByText('Online application')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toContainElement(screen.getByRole('button', { name: 'Offline POS' }));
    expect(screen.getByText('Online mode').tagName).toBe('SPAN');
    expect(screen.getByRole('button', { name: 'Offline POS' }).querySelector('span')).toHaveTextContent('Offline POS');
    await user.click(screen.getByRole('button', { name: 'Offline POS' }));
    expect(bridge.switchMode).toHaveBeenCalledWith('offline');
  });

  it('does not offer online mode while the server is unreachable', async () => {
    window.mkposDesktop = offlineBridge();
    render(<DesktopEntry><div>Online application</div></DesktopEntry>);

    expect(await screen.findByText('Offline POS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go online & sync' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
  });

  it('offers the online switch after connectivity returns but stays in Offline POS', async () => {
    const user = userEvent.setup();
    let connectivityListener;
    window.mkposDesktop = offlineBridge({
      onConnectivityChanged: vi.fn((listener) => {
        connectivityListener = listener;
        return () => {};
      }),
    });
    render(<DesktopEntry><div>Online application</div></DesktopEntry>);

    expect(await screen.findByText('Offline POS')).toBeInTheDocument();
    act(() => connectivityListener({ connected: true, mode: 'offline' }));

    expect(screen.getByText('Offline POS')).toBeInTheDocument();
    expect(screen.queryByText('Online application')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go online & sync' }));
    expect(window.mkposDesktop.switchMode).toHaveBeenCalledWith('online');
    expect(await screen.findByRole('status')).toHaveTextContent('Opening online mode');
  });

  it('shows reconnect feedback when the server remains unavailable', async () => {
    const user = userEvent.setup();
    window.mkposDesktop = offlineBridge();
    render(<DesktopEntry><div>Online application</div></DesktopEntry>);

    await user.click(await screen.findByRole('button', { name: 'Reconnect' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The PwarMyar server is still unavailable');
    expect(window.mkposDesktop.checkConnectivity).toHaveBeenCalledOnce();
  });

  it('opens a saved invoice from local offline history for reprinting', async () => {
    const user = userEvent.setup();
    const savedSale = {
      id: 7, status: 'failed', local_total: 2500, created_at: '2026-08-07T03:30:00.000Z',
      payload: {
        payment_method: 'Cash', discount: 0,
        items: [{ product_id: 10, product_name: 'Cached Product', price_type: 'Retail', quantity: 1, foc_quantity: 0, unit_price: 2500 }],
      },
    };
    window.mkposDesktop = offlineBridge({ listOfflineSales: vi.fn().mockResolvedValue([savedSale]) });
    render(<DesktopEntry><div>Online application</div></DesktopEntry>);

    await user.click(await screen.findByRole('button', { name: 'Invoices' }));
    expect(await screen.findByRole('heading', { name: 'Offline invoices' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByRole('heading', { name: 'OFF-000007' })).toBeInTheDocument();
  });

  it('cannot continue to the online app before the pending queue has loaded', async () => {
    window.mkposDesktop = {
      getBootstrap: vi.fn().mockResolvedValue({
        online: true, pending_count: 1, failed_count: 0, queue_business_id: 8,
      }),
      listOfflineSales: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    render(
      <DesktopOnlineGate
        session={{ business: { id: 8, name: 'Offline Shop', currency: 'Ks' } }}
        onLoggedOut={() => {}}
      >
        <div>Online application</div>
      </DesktopOnlineGate>,
    );
    expect(await screen.findByRole('button', { name: 'Continue to PwarMyar' })).toBeDisabled();
    expect(screen.queryByText('Online application')).not.toBeInTheDocument();
  });
});
