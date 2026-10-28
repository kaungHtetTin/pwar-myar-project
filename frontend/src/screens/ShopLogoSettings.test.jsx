import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopLogoSettings } from "./ShopLogoSettings";

vi.mock("../api", () => ({ request: vi.fn() }));
beforeEach(() => { request.mockReset(); });

it("uploads through the same business logo endpoint and notifies Settings", async () => {
  request.mockResolvedValue({ receipt_logo_data_url: "data:image/png;base64,new" });
  const onChange = vi.fn(), changed = vi.fn();
  window.addEventListener("mkpos:data-change", changed);
  render(<ShopLogoSettings owner onChange={onChange} />);
  const file = new File(["image"], "logo.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Business logo file"), { target: { files: [file] } });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("data:image/png;base64,new"));
  expect(request.mock.calls[0][0]).toBe("/settings/logo");
  expect(request.mock.calls[0][1].body.get("logo")).toBe(file);
  expect(changed.mock.calls[0][0].detail.resources).toContain("settings");
  window.removeEventListener("mkpos:data-change", changed);
});

it("keeps the current logo if upload fails", async () => {
  request.mockRejectedValue(new Error("Logo too large"));
  const onChange = vi.fn();
  render(<ShopLogoSettings owner logo="data:image/png;base64,old" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Business logo file"), { target: { files: [new File(["image"], "logo.png")] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Logo too large");
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByAltText("Current business logo")).toHaveAttribute("src", "data:image/png;base64,old");
});
