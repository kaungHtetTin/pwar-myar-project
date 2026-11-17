import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopPublicationsTable } from "./ShopScreen";

vi.mock("../api", () => ({ request: vi.fn() }));
const props = { path: "/shop-admin/publications?q=", refresh: 0, tableLabel: "Product publication", columns: [{ label: "Order" }], render: (row) => <tr key={row.id}><td>{row.reference}</td></tr> };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path) => ({ items: [{ id: 1, reference: path.includes("offset=25") ? "Second page product" : "First page product" }], total: 62 }));
});

describe("Shop publication pagination", () => {
  it('publishes and unpublishes all search results inline across pages and guards repeated saves', async () => {
    const saved = vi.fn(), busyChanged = vi.fn();
    let finish;
    request.mockImplementation(async (_path, options) => options ? new Promise(resolve => { finish = resolve; }) : { items: [{ id: 1, reference: 'Tea', published: false }], total: 62, published_count: 0 });
    render(<ShopPublicationsTable {...props} path="/shop-admin/publications?q=Tea" bulkPath="/shop-admin/publications/bulk?q=Tea" bulkPlacement="inline" onBulkSaved={saved} onBulkBusyChange={busyChanged} />);
    await screen.findByText('Tea');
    expect(screen.getByRole('button', { name: 'Unpublish all', exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Publish all', exact: true }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(request).toHaveBeenLastCalledWith('/shop-admin/publications/bulk?q=Tea', { method: 'PUT', body: JSON.stringify({ published: true }) });
    finish({ items: [{ id: 1, published: true }], updated: 62 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish all', exact: true })).toBeDisabled());
    expect(saved).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish all', exact: true }));
    expect(request).toHaveBeenLastCalledWith('/shop-admin/publications/bulk?q=Tea', { method: 'PUT', body: JSON.stringify({ published: false }) });
    finish({ items: [{ id: 1, published: false }], updated: 62 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unpublish all', exact: true })).toBeDisabled());
    expect(busyChanged.mock.calls.map(([value]) => value)).toEqual([true, false, true, false]);
  });

  it('keeps product rows and permits retry when inline bulk publication fails', async () => {
    request.mockImplementation(async (_path, options) => {
      if (options) throw new Error('Set a valid online price first.');
      return { items: [{ id: 1, reference: 'Tea' }], total: 1, published_count: 0 };
    });
    render(<ShopPublicationsTable {...props} bulkPath="/shop-admin/publications/bulk?q=" bulkPlacement="inline" />);
    await screen.findByText('Tea');
    fireEvent.click(screen.getByRole('button', { name: 'Publish all', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Set a valid online price first.');
    expect(screen.getByText('Tea')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish all', exact: true })).toBeEnabled();
  });
  it("fetches separate pages, preserves filters and resets when filters or page size change", async () => {
    const view = render(<ShopPublicationsTable {...props} />);
    await screen.findByText("1-25 of 62");
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Second page product");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/publications?q=&offset=25&limit=25");
    expect(screen.queryByText("First page product")).not.toBeInTheDocument();
    expect(screen.getByText("26-50 of 62")).toBeInTheDocument();
    view.rerender(<ShopPublicationsTable {...props} path="/shop-admin/publications?q=Tea&category=Drinks" />);
    await screen.findByText("1-25 of 62");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/publications?q=Tea&category=Drinks&offset=0&limit=25");
    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "10" } });
    await screen.findByText("1-10 of 62");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/publications?q=Tea&category=Drinks&offset=0&limit=10");
  });

  it("moves to the last available page when refreshing a reduced result set", async () => {
    const view = render(<ShopPublicationsTable {...props} />);
    await screen.findByText("1-25 of 62");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("26-50 of 62");
    request.mockResolvedValue({ items: [{ id: 3, reference: "Remaining product" }], total: 1 });
    view.rerender(<ShopPublicationsTable {...props} refresh={1} />);
    await screen.findByText("1-1 of 1");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/publications?q=&offset=0&limit=25");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("ignores an old response after a filter change and handles empty results", async () => {
    let resolveOld;
    request.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(<ShopPublicationsTable {...props} />);
    request.mockResolvedValue({ items: [], total: 0 });
    view.rerender(<ShopPublicationsTable {...props} path="/shop-admin/publications?publication_status=published" />);
    await screen.findByText("No records found.");
    resolveOld({ items: [{ id: 4, reference: "Outdated result" }], total: 62 });
    await waitFor(() => expect(screen.getByText("0-0 of 0")).toBeInTheDocument());
    expect(screen.queryByText("Outdated result")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
