import { describe, expect, it } from "vitest";
import {
  defaultModule,
  moduleFromPath,
  resolveEnabledModules,
} from "./modules";

describe("mobile navigation modules", () => {
  it("keeps only configured modules the account can access", () => {
    const modules = resolveEnabledModules(
      ["sell", "products", "reports"],
      ["products", "reports", "settings"],
      "staff",
    );

    expect(modules.map(({ id }) => id)).toEqual(["products", "reports", "settings"]);
  });

  it("allows access management outside the configured module list", () => {
    const modules = resolveEnabledModules(
      ["products"],
      ["products", "access"],
      "owner",
    );
    expect(modules.map(({ id }) => id)).toEqual(["products", "access", "settings"]);
  });

  it("uses all modules as an owner fallback when permissions are missing", () => {
    expect(resolveEnabledModules([], [], "owner")).toHaveLength(13);
  });

  it("places Access above Settings in the navigation drawer", () => {
    const modules = resolveEnabledModules([], [], "owner");
    const ids = modules.map(({ id }) => id);

    expect(ids.indexOf("access")).toBeLessThan(ids.indexOf("settings"));
  });

  it("resolves nested paths and prefers Sell as the launch page", () => {
    const modules = resolveEnabledModules([], ["sell", "products"], "staff");
    expect(moduleFromPath("/products/42", modules)?.id).toBe("products");
    expect(defaultModule(modules)?.id).toBe("sell");
    expect(defaultModule(modules.filter(module => module.id !== 'sell'))?.id).toBe('products');
  });

  it("exposes sales history as a standalone module", () => {
    const modules = resolveEnabledModules(
      ["sales", "transactions"],
      ["sales", "transactions"],
      "staff",
    );
    expect(moduleFromPath("/sales/42/edit", modules)?.id).toBe("sales");
    expect(modules.map(({ id }) => id)).toEqual(["sales", "transactions", "settings"]);
  });
});
