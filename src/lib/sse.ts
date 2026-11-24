// One Postgres connection per server process listens for `queue_<departmentId>` notifications
// (sent by every queue transaction) and fans them out to the open SSE streams.
// If the connection drops it reconnects with backoff, listens again, and tells every stream to
// "resync", so clients reload their state and miss nothing.

import { Client } from "pg";

export type QueueMessage = { type: string; [key: string]: unknown };
export type QueueListener = (departmentId: string, message: QueueMessage) => void;

interface Broker {
  client: Client | null;
  connecting: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  backoffMs: number;
  hasConnectedBefore: boolean;
  subs: Map<string, Set<QueueListener>>;
}

const PREFIX = "queue_";
const MAX_BACKOFF_MS = 30_000;

// Kept on globalThis so that hot reloads in development do not open a second connection.
const holder = globalThis as unknown as { __queueBroker?: Broker };
const broker: Broker = (holder.__queueBroker ??= {
  client: null,
  connecting: false,
  reconnectTimer: null,
  backoffMs: 1000,
  hasConnectedBefore: false,
  subs: new Map(),
});

const quote = (channel: string) => `"${channel.replace(/"/g, '""')}"`;

function emit(departmentId: string, message: QueueMessage) {
  for (const listener of broker.subs.get(departmentId) ?? []) {
    try {
      listener(departmentId, message);
    } catch {
      // one broken stream must not stop the others
    }
  }
}

function scheduleReconnect() {
  if (broker.reconnectTimer || broker.subs.size === 0) return;
  broker.reconnectTimer = setTimeout(() => {
    broker.reconnectTimer = null;
    void connect();
  }, broker.backoffMs);
  broker.backoffMs = Math.min(broker.backoffMs * 2, MAX_BACKOFF_MS);
}

function dropped(client: Client) {
  if (broker.client !== client) return;
  broker.client = null;
  client.removeAllListeners();
  client.on("error", () => undefined); // errors after a drop are expected
  client.end().catch(() => undefined);
  scheduleReconnect();
}

async function connect() {
  if (broker.client || broker.connecting || broker.subs.size === 0) return;
  broker.connecting = true;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    client.on("error", () => dropped(client));
    client.on("end", () => dropped(client));
    client.on("notification", (msg) => {
      if (!msg.channel.startsWith(PREFIX)) return;
      let message: QueueMessage = { type: "token" };
      try {
        message = JSON.parse(msg.payload ?? "{}") as QueueMessage;
      } catch {
        // keep the generic message
      }
      emit(msg.channel.slice(PREFIX.length), message);
    });
    await client.connect();
    broker.client = client;
    for (const departmentId of broker.subs.keys()) await client.query(`LISTEN ${quote(PREFIX + departmentId)}`);
    broker.backoffMs = 1000;
    if (broker.hasConnectedBefore) {
      // Notifications sent while we were disconnected are lost, so make every client reload.
      for (const departmentId of [...broker.subs.keys()]) emit(departmentId, { type: "resync" });
    }
    broker.hasConnectedBefore = true;
  } catch {
    dropped(client);
    scheduleReconnect();
  } finally {
    broker.connecting = false;
  }
}

/** Listen for changes in these departments. Returns the function that stops listening. */
export function subscribeQueue(departmentIds: readonly string[], listener: QueueListener): () => void {
  for (const id of departmentIds) {
    let set = broker.subs.get(id);
    if (!set) {
      set = new Set();
      broker.subs.set(id, set);
      if (broker.client) void broker.client.query(`LISTEN ${quote(PREFIX + id)}`).catch(() => undefined);
    }
    set.add(listener);
  }
  void connect();

  return () => {
    for (const id of departmentIds) {
      const set = broker.subs.get(id);
      if (!set) continue;
      set.delete(listener);
      if (set.size === 0) {
        broker.subs.delete(id);
        if (broker.client) void broker.client.query(`UNLISTEN ${quote(PREFIX + id)}`).catch(() => undefined);
      }
    }
  };
}

/** Test helper: forget everything. */
export function resetQueueBrokerForTests() {
  if (broker.reconnectTimer) clearTimeout(broker.reconnectTimer);
  broker.reconnectTimer = null;
  broker.client?.removeAllListeners();
  broker.client = null;
  broker.connecting = false;
  broker.backoffMs = 1000;
  broker.hasConnectedBefore = false;
  broker.subs.clear();
}
