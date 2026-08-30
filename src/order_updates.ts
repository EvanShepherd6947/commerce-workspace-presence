import { z } from "zod";

export const orderUpdateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("checkout_started"), orderId: z.string().min(1), customerId: z.string().min(1) }),
  z.object({ kind: z.literal("fulfillment_started"), orderId: z.string().min(1), warehouse: z.string().min(1) }),
  z.object({ kind: z.literal("receipt_issued"), orderId: z.string().min(1), receiptId: z.string().min(1) }),
  z.object({ kind: z.literal("customer_updated"), orderId: z.string().min(1), message: z.string().min(1).max(240) })
]);

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

export type WorkspaceEvent = {
  event: "checkout.started" | "fulfillment.started" | "receipt.issued" | "customer.order_updated";
  data: Record<string, string>;
};

export function toWorkspaceEvent(update: OrderUpdate): WorkspaceEvent {
  switch (update.kind) {
    case "checkout_started":
      return { event: "checkout.started", data: { orderId: update.orderId, customerId: update.customerId } };
    case "fulfillment_started":
      return { event: "fulfillment.started", data: { orderId: update.orderId, warehouse: update.warehouse } };
    case "receipt_issued":
      return { event: "receipt.issued", data: { orderId: update.orderId, receiptId: update.receiptId } };
    case "customer_updated":
      return { event: "customer.order_updated", data: { orderId: update.orderId, message: update.message } };
  }
}
