import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShopLocation } from "../ShopLocation";
import { LocaleContext } from "../i18n";

afterEach(cleanup);
describe("Public shop location", () => {
  it("shows coordinates and a map link for the submitted shop position", () => {
    render(<ShopLocation location={{ latitude: 16.8409, longitude: 96.1735 }} />);
    expect(screen.getByText("Shop location")).toBeInTheDocument();
    expect(screen.getByText("16.840900, 96.173500")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in maps" })).toHaveAttribute("href", "https://www.google.com/maps?q=16.8409,96.1735");
    const map = screen.getByTitle('Shop location');
    const url = new URL(map.src);
    expect(url.origin).toBe('https://maps.google.com');
    expect(url.searchParams.get('q')).toBe('16.8409,96.1735');
    expect(url.searchParams.get('z')).toBe('16');
    expect(url.searchParams.get('output')).toBe('embed');
    expect(url.searchParams.has('key')).toBe(false);
    expect(map).toHaveAttribute('loading', 'lazy');
  });
  it.each([{ latitude: null, longitude: 96 }, { latitude: '', longitude: 96 }, { latitude: 16, longitude: undefined }, { latitude: 91, longitude: 96 }, { latitude: 16, longitude: 181 }, { latitude: 'invalid', longitude: 96 }])('hides the map for invalid or missing coordinates %o', location => {
    const view = render(<ShopLocation location={location} />);
    expect(view.container).toBeEmptyDOMElement();
  });
  it("supports Myanmar and hides the location when no position is available", () => {
    const view = render(<ShopLocation location={null} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    view.rerender(<LocaleContext.Provider value="my"><ShopLocation location={{ latitude: 0, longitude: 0 }} /></LocaleContext.Provider>);
    expect(screen.getByRole("link", { name: "မြေပုံတွင် ကြည့်ရန်" })).toBeInTheDocument();
  });
});
