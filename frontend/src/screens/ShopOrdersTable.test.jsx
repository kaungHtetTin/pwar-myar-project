import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopOrdersTable } from "./ShopOrdersTable";

vi.mock("../api", () => ({ request: vi.fn() }));
const props = { path: "/shop-admin/orders?q=", refresh: 0, tableLabel: "Online orders", columns: [{ label: "Order" }], render: (row) => <tr key={row.id}><td>{row.reference}</td></tr> };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path) => ({ items: [{ id: 1, reference: path.includes("offset=25") ? "Second page order" : "First page order" }], total: 62 }));
});

describe("Shop order pagination", () => {
  it('reconciles a reviewed request without fetching or resetting pagination', async () => {
    request.mockResolvedValue({ items: [{ id: 1, reference: 'Pending review', status: 'pending', request_count: 1 }], total: 1 });
    render(<ShopOrdersTable {...props} path="/shop-admin/orders?requests=1" />);
    await screen.findByText('Pending review');
    const table = screen.getByRole('table', { name: 'Online orders' });
    fireEvent(window, new CustomEvent('mkpos:shop-order-updated', { detail: { id: 1, reference: 'Pending review', status: 'cancelled', customer_requests: [{ type: 'cancellation', status: 'approved' }] } }));
    await screen.findByText('No records found.');
    expect(screen.getByRole('table', { name: 'Online orders' })).toBe(table);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("keeps the inbox visible while refreshing the same query in the background", async () => {
    const view = render(<ShopOrdersTable {...props} backgroundRefresh />);
    await screen.findByText("First page order");
    let resolve;
    request.mockImplementation(() => new Promise((done) => { resolve = done; }));
    view.rerender(<ShopOrdersTable {...props} backgroundRefresh refresh={1} />);
    expect(screen.getByText("First page order")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    resolve({ items: [{ id: 1, reference: "Updated inbox row" }], total: 1 });
    await screen.findByText("Updated inbox row");
    expect(screen.queryByText("First page order")).not.toBeInTheDocument();
  });
  it("fetches separate pages, preserves filters and resets when filters or page size change", async () => {
    const view = render(<ShopOrdersTable {...props} />);
    await screen.findByText("1-25 of 62");
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Second page order");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/orders?q=&offset=25&limit=25");
    expect(screen.queryByText("First page order")).not.toBeInTheDocument();
    expect(screen.getByText("26-50 of 62")).toBeInTheDocument();
    view.rerender(<ShopOrdersTable {...props} path="/shop-admin/orders?q=Buyer&status=pending" />);
    await screen.findByText("1-25 of 62");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/orders?q=Buyer&status=pending&offset=0&limit=25");
    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "10" } });
    await screen.findByText("1-10 of 62");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/orders?q=Buyer&status=pending&offset=0&limit=10");
  });

  it("moves to the last available page when refreshing a reduced result set", async () => {
    const view = render(<ShopOrdersTable {...props} />);
    await screen.findByText("1-25 of 62");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("26-50 of 62");
    request.mockResolvedValue({ items: [{ id: 3, reference: "Remaining order" }], total: 1 });
    view.rerender(<ShopOrdersTable {...props} refresh={1} />);
    await screen.findByText("1-1 of 1");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/orders?q=&offset=0&limit=25");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("ignores an old response after a filter change and handles empty results", async () => {
    let resolveOld;
    request.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(<ShopOrdersTable {...props} />);
    request.mockResolvedValue({ items: [], total: 0 });
    view.rerender(<ShopOrdersTable {...props} path="/shop-admin/orders?status=completed" />);
    await screen.findByText("No records found.");
    resolveOld({ items: [{ id: 4, reference: "Outdated result" }], total: 62 });
    await waitFor(() => expect(screen.getByText("0-0 of 0")).toBeInTheDocument());
    expect(screen.queryByText("Outdated result")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});


it('refreshes cross-device changes on the current filtered page without hiding existing rows', async () => {
  render(<ShopOrdersTable {...props} path="/shop-admin/orders?status=pending" />);
  await screen.findByText('First page order');
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); await screen.findByText('Second page order');
  const table = screen.getByRole('table', { name: 'Online orders' });
  let finish; request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  fireEvent(window, new CustomEvent('mkpos:shop-order-changed', { detail: { orderIds: [1] } }));
  await waitFor(() => expect(request).toHaveBeenLastCalledWith('/shop-admin/orders?status=pending&offset=25&limit=25'));
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.getByText('Second page order')).toBeInTheDocument(); expect(screen.getByRole('table')).toBe(table);
  finish({ items: [{ id: 1, reference: 'Updated on another device' }], total: 62 });
  await screen.findByText('Updated on another device'); expect(screen.getByText('26-50 of 62')).toBeInTheDocument();
});
