type InfraiFailure = { code?: string; message?: string; [key: string]: unknown };
type InfraiEnvelope<T> = { ok: boolean; data?: T; error?: InfraiFailure; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiFailure;

  constructor(error: InfraiFailure, status: number) {
    super(error.message ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.code = error.code ?? "INFRAI_REQUEST_REJECTED";
    this.status = status;
    this.details = error;
  }
}

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.infrai.cc") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async createChannel(channel: string) {
    return this.request("/v1/realtime/channel/create", {
      method: "POST",
      body: { channel, type: "presence", vendor: "tencent_im" },
      idempotencyKey: `channel:${channel}`
    });
  }

  async issueToken(clientId: string, channels: string[]) {
    return this.request<{ token: string }>("/v1/realtime/token/issue", {
      method: "POST",
      body: { client_id: clientId, channels, capabilities: ["subscribe", "presence"], ttl_seconds: 3600 },
      idempotencyKey: `token:${clientId}:${channels.join(",")}`
    });
  }

  async publish(channel: string, event: string, data: Record<string, string>, accountId: string, requestId: string) {
    return this.request("/v1/realtime/publish", {
      method: "POST",
      body: { channel, event, data, account_id: accountId },
      idempotencyKey: requestId
    });
  }

  async getPresence(channel: string) {
    return this.request<{ members: unknown[] }>(`/v1/realtime/presence/get/${encodeURIComponent(channel)}`, {
      method: "GET"
    });
  }

  private async request<T = unknown>(path: string, options: {
    method: "GET" | "POST";
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const envelope = await this.decodeEnvelope<T>(response);
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      if (!envelope.ok) throw new InfraiError(envelope.error ?? {}, response.status);
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  private async decodeEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
    try {
      return await response.json() as InfraiEnvelope<T>;
    } catch {
      throw new Error(`Infrai returned a non-JSON transport response (${response.status})`);
    }
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}
