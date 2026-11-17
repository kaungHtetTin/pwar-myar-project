import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopLocationSettings } from "./ShopLocationSettings";

vi.mock("../api", () => ({ request: vi.fn() }));
let geolocation;
const location = { latitude: 16.8, longitude: 96.1 };
beforeEach(() => {
  geolocation = { getCurrentPosition: vi.fn() };
  vi.stubGlobal("navigator", { geolocation });
  request.mockReset(); request.mockResolvedValue({ submitted: true });
});
afterEach(() => vi.unstubAllGlobals());
describe("Update storefront location", () => {
  it("captures a fresh device location, saves immediately, and updates the displayed map link", async () => {
    const captured = { latitude: 17.123, longitude: 97.456, accuracy: 10 };
    geolocation.getCurrentPosition.mockImplementation((success) => success({ coords: captured }));
    const onChange = vi.fn();
    const view = render(<ShopLocationSettings owner location={location} onChange={onChange} />);
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update shop location" }));
    await screen.findByText("Shop location updated.");
    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    expect(request).toHaveBeenCalledWith("/shop-admin/owner-location", { method: "POST", body: JSON.stringify(captured) });
    expect(onChange).toHaveBeenCalledWith(captured);
    view.rerender(<ShopLocationSettings owner location={captured} onChange={onChange} />);
    expect(screen.getByRole("link", { name: "Open in maps" })).toHaveAttribute("href", "https://www.google.com/maps?q=17.123,97.456");
  });
  it.each(["denied", "save failed"])("preserves the previous location when the update is %s", async (failure) => {
    if (failure === "denied") geolocation.getCurrentPosition.mockImplementation((_success, error) => error({ code: 1 }));
    else {
      geolocation.getCurrentPosition.mockImplementation((success) => success({ coords: { latitude: 17, longitude: 97, accuracy: 10 } }));
      request.mockRejectedValue(new Error("Could not save location"));
    }
    const onChange = vi.fn();
    render(<ShopLocationSettings owner location={location} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Update shop location" }));
    await screen.findByRole("alert");
    await waitFor(() => expect(screen.getByRole("button", { name: "Update shop location" })).toBeEnabled());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://www.google.com/maps?q=16.8,96.1");
  });
  it("allows staff to view the saved shop position without an update button", () => {
    render(<ShopLocationSettings owner={false} location={location} onChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Open in maps" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
