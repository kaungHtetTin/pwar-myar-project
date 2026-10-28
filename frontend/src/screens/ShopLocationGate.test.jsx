import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopLocationGate } from "./ShopLocationGate";

vi.mock("../api", () => ({ request: vi.fn() }));
let geolocation, permission, submitted, role;
beforeEach(() => {
  submitted = false; role = "owner";
  permission = { state: "prompt", addEventListener: vi.fn(), removeEventListener: vi.fn() };
  geolocation = { getCurrentPosition: vi.fn() };
  vi.stubGlobal("navigator", { permissions: { query: vi.fn().mockResolvedValue(permission) }, geolocation });
  request.mockReset();
  request.mockImplementation(async (path) => path === "/auth/me" ? { user: { role } } : { submitted });
});
afterEach(() => vi.unstubAllGlobals());
const renderGate = () => render(<ShopLocationGate><p>Shop workspace available</p></ShopLocationGate>);

describe("Owner location gate", () => {
  it("waits for explicit permission and saves browser coordinates before opening the module", async () => {
    renderGate();
    const button = await screen.findByRole("button", { name: "Allow location and submit" });
    expect(screen.getByText("Your submitted shop location will be shown publicly to customers.")).toBeInTheDocument();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByText("Shop workspace available")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    await act(async () => geolocation.getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 16.84, longitude: 96.17, accuracy: 20 } }));
    expect(request).toHaveBeenCalledWith("/shop-admin/owner-location", { method: "POST", body: JSON.stringify({ latitude: 16.84, longitude: 96.17, accuracy: 20 }) });
    expect(screen.getByText("Shop workspace available")).toBeInTheDocument();
  });

  it("blocks denied requests and allows retry after changing browser permission", async () => {
    geolocation.getCurrentPosition.mockImplementationOnce((_success, failure) => failure({ code: 1 }));
    renderGate();
    fireEvent.click(await screen.findByRole("button", { name: "Allow location and submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Location permission was denied");
    expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    geolocation.getCurrentPosition.mockImplementationOnce((success) => success({ coords: { latitude: 16, longitude: 96, accuracy: 10 } }));
    fireEvent.click(screen.getByRole("button", { name: "Allow location and submit" }));
    await screen.findByText("Shop workspace available");
  });

  it("keeps the module blocked if location cannot be saved", async () => {
    request.mockImplementation(async (path, options) => {
      if (options) throw new Error("Location could not be saved");
      return path === "/auth/me" ? { user: { role } } : { submitted };
    });
    geolocation.getCurrentPosition.mockImplementation((success) => success({ coords: { latitude: 16, longitude: 96, accuracy: 10 } }));
    renderGate();
    fireEvent.click(await screen.findByRole("button", { name: "Allow location and submit" }));
    await screen.findByText("Location could not be saved");
    expect(screen.queryByText("Shop workspace available")).not.toBeInTheDocument();
  });

  it.each(["prompt", "denied", "granted"])("opens an already configured shop with %s browser permission without requesting GPS", async (permissionState) => {
    submitted = true; permission.state = permissionState;
    renderGate();
    await screen.findByText("Shop workspace available");
    expect(navigator.permissions.query).not.toHaveBeenCalled();
    expect(permission.addEventListener).not.toHaveBeenCalled();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Allow location and submit" })).not.toBeInTheDocument();
  });

  it("requires owner setup for staff, then permits staff after setup", async () => {
    role = "staff";
    renderGate();
    await screen.findByText("The business owner must submit the shop location before staff can use Shop management.");
    expect(screen.queryByRole("button", { name: "Allow location and submit" })).not.toBeInTheDocument();
    submitted = true;
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await screen.findByText("Shop workspace available");
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
});
