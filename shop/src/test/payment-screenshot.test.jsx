import React from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PaymentScreenshot } from "../PaymentScreenshot";

afterEach(() => cleanup());
it.each([
  new File(["document"], "receipt.pdf", { type: "application/pdf" }),
  new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
])("rejects unsupported or oversized payment screenshots", (file) => {
  const change = vi.fn();
  render(<PaymentScreenshot file={null} onChange={change} />);
  fireEvent.change(screen.getByLabelText("Payment screenshot (optional)"), { target: { files: [file] } });
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPG, PNG or WebP image up to 2 MB.");
  expect(change).toHaveBeenCalledWith(null);
});
