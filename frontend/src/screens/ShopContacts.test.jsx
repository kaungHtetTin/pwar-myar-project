import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopContacts } from "./ShopContacts";

vi.mock("../api", () => ({ request: vi.fn() }));
const contact = { id: 1, platform: "phone", label: "Sales", value: "0912345678" };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (_path, options) => options ? { ...contact, ...JSON.parse(options.body || "{}") } : { items: [contact] });
});

it("creates a contact from the app bar modal with all platform choices", async () => {
  request.mockImplementation(async (_path, options) => options ? { id: 2, ...JSON.parse(options.body) } : { items: [contact] });
  render(<ShopContacts run={(operation) => operation()} refresh={0} />);
  await screen.findByText("Sales");
  fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  expect(screen.getAllByRole("option")).toHaveLength(9);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  expect(request.mock.calls.some(([, options]) => options)).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  fireEvent.change(screen.getByLabelText("Platform"), { target: { value: "email" } });
  fireEvent.change(screen.getByLabelText("Label (optional)"), { target: { value: "Support" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "support@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Save contact" }));
  await screen.findByText("support@example.com");
  expect(request).toHaveBeenCalledWith("/shop-admin/contacts", { method: "POST", body: JSON.stringify({ platform: "email", label: "Support", value: "support@example.com" }) });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("retains edits after a failed save and supports retry", async () => {
  request.mockImplementation(async (_path, options) => { if (options) throw new Error("Could not save contact"); return { items: [contact] }; });
  const run = async (operation) => { try { await operation(); } catch { /* Page also displays mutation errors. */ } };
  render(<ShopContacts run={run} refresh={0} />);
  fireEvent.click(await screen.findByRole("button", { name: "Actions for Sales" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "099999999" } });
  fireEvent.click(screen.getByRole("button", { name: "Save contact" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save contact");
  expect(screen.getByLabelText("Phone number")).toHaveValue("099999999");
  request.mockResolvedValue({ ...contact, value: "099999999" });
  fireEvent.click(screen.getByRole("button", { name: "Save contact" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("099999999")).toBeInTheDocument();
});

it("deletes only after confirmation", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    render(<ShopContacts run={(operation) => operation()} refresh={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Sales" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(request.mock.calls.some(([, options]) => options)).toBe(false);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Sales" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    await screen.findByText("No contacts yet.");
    expect(request).toHaveBeenCalledWith("/shop-admin/contacts/1", { method: "DELETE" });
  } finally { confirm.mockRestore(); }
});
