import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopPublicationRow } from "./ShopPublicationRow";

vi.mock("../api", () => ({ request: vi.fn() }));
const product = { id: 12, name: "Rice", stock: 10, base_unit: "Pack", purchase_unit: "Box", published: false, unit: "base", base_price: 1500, purchase_price: 6000, currency: "Ks", price_type: "Retail" };
beforeEach(() => { request.mockReset(); });

it("saves checking and unchecking directly without reloading any list", async () => {
  request.mockResolvedValue({ ok: true });
  render(<table><tbody><ShopPublicationRow product={product} /></tbody></table>);
  const checkbox = screen.getByRole("checkbox", { name: "Publish Rice online" });
  fireEvent.click(checkbox);
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(checkbox).toBeChecked();
  expect(request).toHaveBeenCalledWith("/shop-admin/publications/12", { method: "PUT", body: JSON.stringify({ published: true, unit: "base" }) });
  fireEvent.click(checkbox);
  await waitFor(() => expect(checkbox).toBeEnabled());
  expect(checkbox).not.toBeChecked();
  expect(request.mock.calls).toHaveLength(2);
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ published: false, unit: "base" });
});

it("keeps other rows usable and restores the checkbox when saving fails", async () => {
  let reject;
  request.mockImplementationOnce(() => new Promise((_resolve, failed) => { reject = failed; }));
  render(<table><tbody><ShopPublicationRow product={product} /><ShopPublicationRow product={{ ...product, id: 13, name: "Tea" }} /></tbody></table>);
  const rice = screen.getByRole("checkbox", { name: "Publish Rice online" });
  fireEvent.click(rice);
  expect(rice).toBeChecked();
  expect(rice).toBeDisabled();
  expect(screen.queryByRole("checkbox", { name: "Publish Rice online" })).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Saving publication for Rice" })).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Publish Tea online" })).toBeEnabled();

  reject(new Error("Set a valid online price first."));
  expect(await screen.findByRole("alert")).toHaveTextContent("Set a valid online price first.");
  expect(rice).not.toBeChecked();
  expect(rice).toBeEnabled();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Publish Rice online" })).toBeVisible();
  request.mockResolvedValue({ ok: true });
  fireEvent.click(rice);
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(rice).toBeChecked();
});

it("preserves the existing sales unit when publishing and has no selector", async () => {
  request.mockResolvedValue({ ok: true });
  render(<table><tbody><ShopPublicationRow product={{ ...product, unit: "purchase" }} /></tbody></table>);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByText("6,000 Ks")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Publish Rice online" }));
  await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ published: true, unit: "purchase" });
});
