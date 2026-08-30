import assert from "node:assert/strict";
import test from "node:test";
import { orderUpdateSchema, toWorkspaceEvent } from "../src/order_updates.js";

test("a receipt becomes the operator-facing receipt event", () => {
  const update = orderUpdateSchema.parse({ kind: "receipt_issued", orderId: "ord_1042", receiptId: "rcpt_88" });
  assert.deepEqual(toWorkspaceEvent(update), {
    event: "receipt.issued",
    data: { orderId: "ord_1042", receiptId: "rcpt_88" }
  });
});

test("a customer update without a message is rejected at the request boundary", () => {
  assert.equal(orderUpdateSchema.safeParse({ kind: "customer_updated", orderId: "ord_1042" }).success, false);
});
