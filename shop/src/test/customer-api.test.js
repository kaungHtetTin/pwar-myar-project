import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { post, request, setCustomerToken, customerToken } from "../api";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

it("sends customer authentication only to account requests and explicitly signed-in checkout", async () => {
  setCustomerToken("pc_test-customer-token");
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
  await request("/customer/orders");
  await request("/marketplace/shops");
  await post("/stores/demo/checkout", {}, { customerAuth: true });
  await post("/stores/demo/checkout", {}, { customerAuth: false });
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer pc_test-customer-token");
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer pc_test-customer-token");
  expect(fetchMock.mock.calls[3][1].headers.Authorization).toBeUndefined();
  for (const [, options] of fetchMock.mock.calls) expect(options.credentials).toBe("omit");
});

it("invalidates an expired customer session instead of retrying checkout as a guest", async () => {
  setCustomerToken("pc_expired-token");
  const expired = vi.fn();
  window.addEventListener("mkpos.shop.customer-session-expired", expired);
  const fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ message: "Please sign in to your customer account." }) }));
  vi.stubGlobal("fetch", fetchMock);
  try {
    await expect(post("/stores/demo/checkout", {}, { customerAuth: true })).rejects.toThrow("Please sign in");
    expect(customerToken()).toBe("");
    expect(expired).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  } finally { window.removeEventListener("mkpos.shop.customer-session-expired", expired); }
});
