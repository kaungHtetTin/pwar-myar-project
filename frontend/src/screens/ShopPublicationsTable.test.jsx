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
