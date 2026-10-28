export const nextStates = {
  pending: ["accepted", "cancelled"],
  accepted: ["packing", "cancelled"],
  packing: ["ready_for_pickup", "dispatched", "cancelled"],
  ready_for_pickup: ["completed", "cancelled"],
  dispatched: ["completed", "return_pending"],
  return_pending: ["cancelled"],
};
export const transitionActions = { accepted: "Accept order", packing: "Start packing", ready_for_pickup: "Ready for pickup", dispatched: "Dispatch order", completed: "Complete order", cancelled: "Cancel order", return_pending: "Record failed delivery" };

export function orderActions(order, can) {
  const actions = [];
  if (can("ecommerce_process")) {
    for (const status of nextStates[order.status] || []) {
      if (status === "ready_for_pickup" && order.fulfillment !== "pickup") continue;
      if (["dispatched", "return_pending"].includes(status) && order.fulfillment !== "delivery") continue;
      actions.push({ key: status, title: transitionActions[status], danger: ["cancelled", "return_pending"].includes(status),
        disabled: status === "completed" && order.payment_status !== "paid" });
    }
    if (order.status === "expired" && order.payment_status === "proof_submitted") actions.push({ key: "reopen", title: "Reopen for payment review" });
  }
  const manual = (order.payment_method?.provider || "manual") === "manual";
  if (manual && can("ecommerce_payments")) {
    const closed = ["cancelled", "expired"].includes(order.status);
    if ((!closed && order.status !== "completed" && ["unpaid", "proof_submitted"].includes(order.payment_status))
      || (closed && order.payment_status === "proof_submitted")) {
      actions.push({ key: "confirm", title: closed ? "Record payment for refund" : "Approve full payment" });
    }
    if (order.payment_status === "proof_submitted") actions.push({ key: "reject", title: "Reject proof", danger: true });
  }
  if (manual && can("ecommerce_refunds") && order.payment_status === "refund_pending") actions.push({ key: "refund", title: "Record full refund" });
  actions.push({ key: "history", title: "Order history" });
  return actions;
}
