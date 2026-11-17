import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ShopContacts } from "../ShopContacts";
afterEach(() => cleanup());

it("shows public contacts with call, email and external links", () => {
  render(<ShopContacts contacts={[
    { id: 1, platform: "phone", value: "0912345678", url: "tel:0912345678" },
    { id: 2, platform: "email", label: "Support", value: "shop@example.com", url: "mailto:shop@example.com" },
    { id: 3, platform: "facebook", value: "https://facebook.com/shop", url: "https://facebook.com/shop" },
    { id: 4, platform: "viber", value: "+95912345678", url: null },
  ]} />);
  expect(screen.getByRole("link", { name: /Phone/ })).toHaveAttribute("href", "tel:0912345678");
  expect(screen.getByRole("link", { name: /Email/ })).toHaveAttribute("href", "mailto:shop@example.com");
  expect(screen.getByRole("link", { name: /Facebook/ })).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByText("+95912345678")).toBeInTheDocument();
});

it("hides empty contacts and never renders unsafe link schemes", () => {
  const view = render(<ShopContacts contacts={[]} />);
  expect(screen.queryByRole("heading", { name: "Contact" })).not.toBeInTheDocument();
  view.rerender(<ShopContacts contacts={[{ id: 1, platform: "facebook", value: "unsafe", url: "javascript:alert(1)" }]} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
