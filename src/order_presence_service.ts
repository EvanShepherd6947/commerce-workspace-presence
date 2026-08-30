import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.js";
import { orderUpdateSchema, toWorkspaceEvent } from "./order_updates.js";

const port = Number(process.env.PORT ?? 8787);
const channel = process.env.WORKSPACE_CHANNEL ?? "commerce-ops";
const apiKey = process.env.INFRAI_API_KEY;

if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const infrai = new InfraiRealtime(apiKey);

const tokenRequestSchema = z.object({ clientId: z.string().min(1) }).strict();
const publishRequestSchema = z.object({
  requestId: z.string().uuid(),
  accountId: z.string().min(1),
  update: orderUpdateSchema
}).strict();

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/online") {
      return json(response, 200, await infrai.getPresence(channel));
    }
    if (request.method === "POST" && request.url === "/session") {
      const input = tokenRequestSchema.parse(await readJson(request));
      return json(response, 200, await infrai.issueToken(input.clientId, [channel]));
    }
    if (request.method === "POST" && request.url === "/orders/events") {
      const input = publishRequestSchema.parse(await readJson(request));
      const workspaceEvent = toWorkspaceEvent(input.update);
      await infrai.publish(channel, workspaceEvent.event, workspaceEvent.data, input.accountId, input.requestId);
      return json(response, 202, { accepted: true, event: workspaceEvent.event, orderId: input.update.orderId });
    }
    json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof z.ZodError) return json(response, 400, { error: "invalid_request", issues: error.issues });
    if (error instanceof InfraiError) return json(response, clientStatus(error.status), { error: error.code, message: error.message });
    console.error(error);
    return json(response, 502, { error: "upstream_transport_error" });
  }
});

await infrai.createChannel(channel);
server.listen(port, () => console.log(`order presence service listening on http://localhost:${port}`));

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function clientStatus(status: number): number {
  return status >= 400 && status < 500 ? status : 502;
}
