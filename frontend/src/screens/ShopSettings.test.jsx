import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { Settings, ShopScreen } from "./ShopScreen";

vi.mock("../api", () => ({ request: vi.fn(), requestDownload: vi.fn() }));
const settings = { display_name: "My shop", slug: "my-shop", phone: "09123", address: "Main street", currency: "Ks", price_type: "Retail", price_types: ["Retail"], description: "Shop description",
  storefront_enabled: true, accepting_orders: true, marketplace_enabled: false, pickup_instructions: "Collect at counter", expiration_hours: 24,
  delivery_zones: [{ id: "city", name: "City", fee: 500 }], payment_methods: [{ id: "cash", type: "cash" }] };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path, options) => {
    if (options) return settings;
    if (path === "/shop-admin/owner-location") return { submitted: true };
    if (path === "/auth/me") return { user: { role: "staff" }, permissions: ["ecommerce_orders", "ecommerce_settings", "ecommerce_catalog"], subscription: { is_valid: true } };
    if (path === "/shop-admin/report") return { states: [] };
    if (path === "/shop-admin/settings") return settings;
    if (path === "/shop-admin/delivery-zones") return { items: settings.delivery_zones };
    return { items: [], total: 0, has_more: false };
  });
});

describe("Shop settings sections", () => {
  it("groups separate settings pages in the inner menu", async () => {
    render(<ShopScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Fulfillment" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Storefront" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delivery zones" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Payment methods" })).toBeInTheDocument();
    await screen.findByLabelText("Pickup instructions");
    expect(screen.queryByLabelText("Pending order expiration (hours)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Public shop name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delivery zones" }));
    await screen.findByText("City");
    expect(screen.queryByLabelText("Zone name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delivery fee payment")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pickup instructions")).not.toBeInTheDocument();
  });

  it("saves the chosen section without changing sibling settings or payment methods", async () => {
    const view = render(<Settings run={(operation) => operation()} changed={0} section="storefront" />);
    fireEvent.change(await screen.findByLabelText("Public shop name"), { target: { value: "Unsaved shop name" } });
    view.rerender(<Settings run={(operation) => operation()} changed={0} section="fulfillment" />);
    fireEvent.change(screen.getByLabelText("Pickup instructions"), { target: { value: "Collect at entrance" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shop settings" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/settings", expect.objectContaining({ method: "PUT" })));
    const submitted = JSON.parse(request.mock.calls.find(([, options]) => options?.method === "PUT")[1].body);
    expect(submitted).toMatchObject({ pickup_instructions: "Collect at entrance", delivery_zones: settings.delivery_zones });
    expect(submitted).not.toHaveProperty("display_name");
    expect(submitted).not.toHaveProperty("payment_methods");
    expect(submitted).not.toHaveProperty("expiration_hours");
  });

  it("allows owners to edit the shared business details in Storefront", async () => {
    render(<Settings run={(operation) => operation()} changed={0} section="storefront" owner />);
    fireEvent.change(await screen.findByLabelText("Public shop name"), { target: { value: "Updated name" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "New street" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "09999" } });
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "USD" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shop settings" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/settings", expect.objectContaining({ method: "PUT" })));
    const submitted = JSON.parse(request.mock.calls.find(([, options]) => options?.method === "PUT")[1].body);
    expect(submitted).toMatchObject({ display_name: "Updated name", address: "New street", phone: "09999", currency: "USD" });
    expect(submitted).not.toHaveProperty("receipt_logo_data_url");
  });

  it("keeps shared business details read only for staff", async () => {
    render(<Settings run={(operation) => operation()} changed={0} section="storefront" />);
    expect(await screen.findByLabelText("Public shop name")).toBeDisabled();
    for (const label of ["Address", "Phone", "Currency"]) expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Upload logo" })).not.toBeInTheDocument();
  });

  it("shows current stock and price and saves publication without reloading", async () => {
    const existing = request.getMockImplementation();
    request.mockImplementation(async (path, options) => path.startsWith("/shop-admin/publications?") ? {
      items: [{ id: 12, name: "Rice", stock: 7.125, base_unit: "Pack", purchase_unit: "Box", published: true, unit: "base",
        base_price: 1500, purchase_price: 6000, currency: "Ks", price_type: "Retail" }], has_more: false,
    } : existing(path, options));
    render(<ShopScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Publication" }));
    expect(await screen.findByText("7.125")).toBeInTheDocument();
    expect(screen.getByText("1,500 Ks")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Stock" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Online price" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    const reads = request.mock.calls.filter(([, options]) => !options).length;
    expect(screen.queryByRole("columnheader", { name: "Sales unit" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Publish Rice online" }));
    expect(screen.getByText("1,500 Ks")).toBeInTheDocument();
    expect(screen.getByText("7.125")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
    expect(request.mock.calls.filter(([, options]) => !options)).toHaveLength(reads);
    expect(screen.queryByRole("button", { name: "Save publication" })).not.toBeInTheDocument();
  });

  it("combines app bar search, filters and sorting, and clears them independently of orders", async () => {
    const existing = request.getMockImplementation();
    request.mockImplementation(async (path, options) => path === "/shop-admin/publications/filters" ? { categories: ["Drinks", "Food"] } : existing(path, options));
    render(<ShopScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Publication" }));
    fireEvent.change(screen.getByLabelText("Search products"), { target: { value: "tea" } });
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    await screen.findByRole("option", { name: "Drinks" });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Drinks" } });
    fireEvent.change(screen.getByLabelText("Stock status"), { target: { value: "low_stock" } });
    fireEvent.change(screen.getByLabelText("Publication status"), { target: { value: "published" } });
    fireEvent.change(screen.getByLabelText("Online price"), { target: { value: "priced" } });
    fireEvent.change(screen.getByLabelText("Sort products"), { target: { value: "low_stock_first" } });
    await waitFor(() => expect(request.mock.calls.some(([path]) => {
      if (!path.startsWith("/shop-admin/publications?")) return false;
      const params = new URLSearchParams(path.split("?")[1]);
      return params.get("q") === "tea" && params.get("category") === "Drinks" && params.get("stock_status") === "low_stock"
        && params.get("publication_status") === "published" && params.get("price_status") === "priced" && params.get("sort") === "low_stock_first" && params.get("offset") === "0";
    })).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("Search products")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(screen.getByLabelText("Category")).toHaveValue("");
    expect(screen.getByLabelText("Sort products")).toHaveValue("name_asc");
  });

  it("checks and unchecks the entire filtered set without reloading the list", async () => {
    const existing = request.getMockImplementation();
    const products = [{ id: 12, name: "Rice", base_unit: "Pack", published: false, unit: "base" }, { id: 13, name: "Tea", base_unit: "Pack", published: true, unit: "base" }];
    let finish;
    request.mockImplementation(async (path, options) => {
      if (path === "/shop-admin/publications/filters") return { categories: ["Drinks"] };
      if (path.startsWith("/shop-admin/publications/bulk?")) {
        if (JSON.parse(options.body).published) return new Promise((resolve) => { finish = resolve; });
        return { items: products.map((product) => ({ ...product, published: false })), matched: 40, updated: 40 };
      }
      if (path.startsWith("/shop-admin/publications?")) return { items: products, total: 40, published_count: 1, has_more: false };
      return existing(path, options);
    });
    render(<ShopScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Publication" }));
    await screen.findByText("Rice");
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    await screen.findByRole("option", { name: "Drinks" });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Drinks" } });
    fireEvent.change(screen.getByLabelText("Stock status"), { target: { value: "low_stock" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await screen.findByText("Rice");
    const all = screen.getByRole("button", { name: "Publish all filtered products" });
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("columnheader", { name: "Publication" })).toHaveTextContent(/^Publication$/);
    const reads = request.mock.calls.filter(([, options]) => !options).length;
    fireEvent.click(all);
    expect(screen.getByRole("progressbar", { name: "Saving all filtered products" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving all filtered products" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Publish Rice online" })).toBeDisabled();
    const bulkCall = request.mock.calls.find(([path]) => path.startsWith("/shop-admin/publications/bulk?"));
    expect(new URLSearchParams(bulkCall[0].split("?")[1]).get("category")).toBe("Drinks");
    expect(new URLSearchParams(bulkCall[0].split("?")[1]).get("stock_status")).toBe("low_stock");
    finish({ items: products.map((product) => ({ ...product, published: true })), matched: 40, updated: 39 });
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAccessibleName("Unpublish all filtered products");
    expect(screen.getByRole("checkbox", { name: "Publish Rice online" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Publish Tea online" })).toBeChecked();
    fireEvent.click(all);
    await waitFor(() => expect(all).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("checkbox", { name: "Publish Rice online" })).not.toBeChecked();
    expect(request.mock.calls.filter(([, options]) => !options)).toHaveLength(reads);
  });

  it("retains current checker states if checking all is rejected", async () => {
    const existing = request.getMockImplementation();
    request.mockImplementation(async (path, options) => {
      if (path.startsWith("/shop-admin/publications/bulk?")) throw new Error("Rice: Set a valid online price first.");
      if (path.startsWith("/shop-admin/publications?")) return { items: [{ id: 12, name: "Rice", base_unit: "Pack", published: false }], total: 1, published_count: 0, has_more: false };
      return existing(path, options);
    });
    render(<ShopScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Publication" }));
    await screen.findByText("Rice");
    fireEvent.click(screen.getByRole("button", { name: "Publish all filtered products" }));
    await screen.findByText("Rice: Set a valid online price first.");
    expect(screen.getByRole("button", { name: "Publish all filtered products" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("checkbox", { name: "Publish Rice online" })).not.toBeChecked();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
