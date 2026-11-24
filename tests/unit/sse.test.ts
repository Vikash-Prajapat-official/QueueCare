import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fake `pg` Client so the broker can be tested without a database.
const fake = vi.hoisted(() => {
  class FakeClient {
    static instances: FakeClient[] = [];
    static failNextConnect = false;
    handlers = new Map<string, ((arg?: unknown) => void)[]>();
    queries: string[] = [];
    ended = false;
    constructor() {
      FakeClient.instances.push(this);
    }
    on(event: string, fn: (arg?: unknown) => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
      return this;
    }
    removeAllListeners() {
      this.handlers.clear();
      return this;
    }
    async connect() {
      if (FakeClient.failNextConnect) {
        FakeClient.failNextConnect = false;
        throw new Error("connection refused");
      }
    }
    async query(sql: string) {
      this.queries.push(sql);
    }
    async end() {
      this.ended = true;
    }
    emit(event: string, arg?: unknown) {
      for (const fn of this.handlers.get(event) ?? []) fn(arg);
    }
  }
  return { FakeClient };
});

vi.mock("pg", () => ({ Client: fake.FakeClient }));

import { resetQueueBrokerForTests, subscribeQueue } from "@/lib/sse";

const { FakeClient } = fake;
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  FakeClient.instances.length = 0;
  FakeClient.failNextConnect = false;
  resetQueueBrokerForTests();
});

afterEach(() => {
  resetQueueBrokerForTests();
  vi.useRealTimers();
});

describe("queue broker", () => {
  it("listens on one connection for every subscribed department", async () => {
    subscribeQueue(["dept1", "dept2"], () => undefined);
    await flush();
    expect(FakeClient.instances).toHaveLength(1);
    expect(FakeClient.instances[0]?.queries).toEqual(['LISTEN "queue_dept1"', 'LISTEN "queue_dept2"']);
  });

  it("shares the connection between many streams", async () => {
    subscribeQueue(["dept1"], () => undefined);
    subscribeQueue(["dept1", "dept3"], () => undefined);
    await flush();
    expect(FakeClient.instances).toHaveLength(1);
    expect(FakeClient.instances[0]?.queries).toContain('LISTEN "queue_dept3"');
    expect(FakeClient.instances[0]?.queries.filter((q) => q === 'LISTEN "queue_dept1"')).toHaveLength(1);
  });

  it("passes a notification only to streams of that department", async () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeQueue(["dept1"], a);
    subscribeQueue(["dept2"], b);
    await flush();
    FakeClient.instances[0]?.emit("notification", {
      channel: "queue_dept1",
      payload: JSON.stringify({ type: "token", action: "call", label: "MED-034" }),
    });
    expect(a).toHaveBeenCalledWith("dept1", { type: "token", action: "call", label: "MED-034" });
    expect(b).not.toHaveBeenCalled();
  });

  it("ignores other channels and survives a broken payload", async () => {
    const a = vi.fn();
    subscribeQueue(["dept1"], a);
    await flush();
    const client = FakeClient.instances[0];
    client?.emit("notification", { channel: "something_else", payload: "{}" });
    expect(a).not.toHaveBeenCalled();
    client?.emit("notification", { channel: "queue_dept1", payload: "{not json" });
    expect(a).toHaveBeenCalledWith("dept1", { type: "token" });
  });

  it("stops delivering after unsubscribe and stops listening when nobody is left", async () => {
    const a = vi.fn();
    const stop = subscribeQueue(["dept1"], a);
    await flush();
    stop();
    FakeClient.instances[0]?.emit("notification", { channel: "queue_dept1", payload: "{}" });
    expect(a).not.toHaveBeenCalled();
    expect(FakeClient.instances[0]?.queries).toContain('UNLISTEN "queue_dept1"');
  });

  it("one failing stream does not stop the others", async () => {
    const bad = vi.fn(() => {
      throw new Error("closed stream");
    });
    const good = vi.fn();
    subscribeQueue(["dept1"], bad);
    subscribeQueue(["dept1"], good);
    await flush();
    FakeClient.instances[0]?.emit("notification", { channel: "queue_dept1", payload: "{}" });
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("reconnects with backoff after the connection drops, listens again and tells streams to resync", async () => {
    const a = vi.fn();
    subscribeQueue(["dept1"], a);
    await flush();
    const first = FakeClient.instances[0];
    first?.emit("end");
    expect(FakeClient.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(FakeClient.instances).toHaveLength(1); // not yet: first retry is after 1 second
    await vi.advanceTimersByTimeAsync(2);
    await flush();
    expect(FakeClient.instances).toHaveLength(2);
    expect(FakeClient.instances[1]?.queries).toEqual(['LISTEN "queue_dept1"']);
    expect(a).toHaveBeenCalledWith("dept1", { type: "resync" });
  });

  it("waits longer after each failed attempt", async () => {
    subscribeQueue(["dept1"], () => undefined);
    await flush();
    FakeClient.failNextConnect = true;
    FakeClient.instances[0]?.emit("error");
    await vi.advanceTimersByTimeAsync(1000); // retry 1 fails
    await flush();
    expect(FakeClient.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1500);
    expect(FakeClient.instances).toHaveLength(2); // next retry is only after 2 seconds
    await vi.advanceTimersByTimeAsync(600);
    await flush();
    expect(FakeClient.instances).toHaveLength(3);
  });
});
