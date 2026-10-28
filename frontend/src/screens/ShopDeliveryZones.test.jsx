import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopDeliveryZones } from "./ShopDeliveryZones";

vi.mock("../api", () => ({ request: vi.fn() }));
const zone = { id: "city", name: "City", fee: 500 };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (_path, options) => options ? { ...zone, ...JSON.parse(options.body || "{}") } : { items: [zone] });
});
describe("Delivery zone modal CRUD", () => {
  it("adds a zone immediately and supports cancelling without a request", async () => {
    request.mockImplementation(async (_path, options) => options ? { id: "new", ...JSON.parse(options.body) } : { items: [zone] });
    render(<ShopDeliveryZones run={(operation) => operation()} refresh={0} />);
    await screen.findByText("City");
    expect(screen.queryByLabelText("Zone name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add delivery zone" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(request.mock.calls.some(([, options]) => options)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Add delivery zone" }));
    fireEvent.change(screen.getByLabelText("Zone name"), { target: { value: "Town" } });
    fireEvent.change(screen.getByLabelText("Delivery fee"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save delivery zone" }));
    await screen.findByText("Town");
    expect(request).toHaveBeenCalledWith("/shop-admin/delivery-zones", { method: "POST", body: JSON.stringify({ name: "Town", fee: 1000 }) });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("edits an existing zone and retains input when the request fails", async () => {
    request.mockImplementation(async (_path, options) => { if (options) throw new Error("Could not save zone"); return { items: [zone] }; });
    const run = async (operation) => { try { await operation(); } catch { /* Page reports mutation errors. */ } };
    render(<ShopDeliveryZones run={run} refresh={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for City" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit delivery zone" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Delivery fee"), { target: { value: "800" } });
    fireEvent.click(screen.getByRole("button", { name: "Save delivery zone" }));
    await screen.findByText("Could not save zone");
    expect(screen.getByLabelText("Delivery fee")).toHaveValue(800);
    request.mockResolvedValue({ ...zone, fee: 800 });
    fireEvent.click(screen.getByRole("button", { name: "Save delivery zone" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("800")).toBeInTheDocument();
  });
  it("deletes a zone only after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<ShopDeliveryZones run={(operation) => operation()} refresh={0} />);
      fireEvent.click(await screen.findByRole("button", { name: "Actions for City" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
      expect(request.mock.calls.some(([, options]) => options)).toBe(false);
      confirm.mockReturnValue(true);
      fireEvent.click(screen.getByRole("button", { name: "Actions for City" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
      await screen.findByText("No delivery zones yet.");
      expect(request).toHaveBeenCalledWith("/shop-admin/delivery-zones/city", { method: "DELETE" });
    } finally { confirm.mockRestore(); }
  });
});
