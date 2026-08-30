export {};

const baseUrl = process.env.SERVICE_URL ?? "http://localhost:8787";
const response = await fetch(`${baseUrl}/orders/events`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    requestId: crypto.randomUUID(),
    accountId: "shop-demo",
    update: { kind: "checkout_started", orderId: "ord_1042", customerId: "cus_71" }
  })
});

console.log(await response.json());
