import { describe, expect, it } from "vitest";
import {
  ACTION_FROM,
  ACTION_ROLES,
  MOVES,
  SKIP_HOLD,
  TOKEN_STATUSES,
  averageConsultMinutes,
  canCancelFrom,
  canMove,
  canPerform,
  compareForCall,
  consultMinutes,
  eligibleQueue,
  estimateWaitMinutes,
  formatTokenNumber,
  holdForSkip,
  localDate,
  nextSeqNo,
  peopleAhead,
  pickNext,
  predictCallOrder,
  priorityGroup,
  releaseAfterCall,
  sortWaiting,
  type Priority,
  type QueueToken,
  type TokenStatus,
} from "@/lib/queue";

let counter = 0;
function tok(
  seqNo: number,
  priority: Priority = "NORMAL",
  status: TokenStatus = "WAITING",
  extra: Partial<QueueToken> = {},
): QueueToken {
  return { id: `t${seqNo}-${counter++}`, seqNo, priority, status, skipHold: 0, doctorId: null, ...extra };
}
const seqs = (list: QueueToken[]) => list.map((t) => t.seqNo);

describe("priority groups", () => {
  it("puts EMERGENCY first, then ELDERLY/PREGNANT/DISABLED, then NORMAL", () => {
    expect(priorityGroup("EMERGENCY")).toBeLessThan(priorityGroup("ELDERLY"));
    expect(priorityGroup("ELDERLY")).toBe(priorityGroup("PREGNANT"));
    expect(priorityGroup("PREGNANT")).toBe(priorityGroup("DISABLED"));
    expect(priorityGroup("DISABLED")).toBeLessThan(priorityGroup("NORMAL"));
  });
});

describe("queue ordering", () => {
  it("orders normal patients by token number", () => {
    const q = sortWaiting([tok(3), tok(1), tok(2)]);
    expect(seqs(q)).toEqual([1, 2, 3]);
  });

  it("serves emergency, then elderly/pregnant/disabled, then normal", () => {
    const q = sortWaiting([
      tok(1, "NORMAL"),
      tok(2, "ELDERLY"),
      tok(3, "NORMAL"),
      tok(4, "EMERGENCY"),
      tok(5, "PREGNANT"),
      tok(6, "DISABLED"),
    ]);
    expect(seqs(q)).toEqual([4, 2, 5, 6, 1, 3]);
  });

  it("treats elderly, pregnant and disabled as one group ordered by token number", () => {
    const q = sortWaiting([tok(5, "ELDERLY"), tok(3, "PREGNANT"), tok(4, "DISABLED")]);
    expect(seqs(q)).toEqual([3, 4, 5]);
  });

  it("lets a later emergency jump ahead of normal patients but not an earlier emergency", () => {
    const q = sortWaiting([tok(1), tok(2), tok(3, "EMERGENCY"), tok(4), tok(5, "EMERGENCY")]);
    expect(seqs(q)).toEqual([3, 5, 1, 2, 4]);
  });

  it("does not change the list it was given", () => {
    const input = [tok(2), tok(1)];
    sortWaiting(input);
    expect(seqs(input)).toEqual([2, 1]);
  });

  it("breaks exact ties by id so the order is stable", () => {
    const a = { ...tok(1), id: "a" };
    const b = { ...tok(1), id: "b" };
    expect(compareForCall(a, b)).toBeLessThan(0);
    expect(compareForCall(b, a)).toBeGreaterThan(0);
  });
});

describe("a doctor's own queue", () => {
  const tokens = [
    tok(1, "NORMAL", "WAITING", { doctorId: "A" }),
    tok(2, "NORMAL", "WAITING", { doctorId: "B" }),
    tok(3, "NORMAL", "WAITING", { doctorId: null }),
    tok(4, "NORMAL", "CALLED", { doctorId: "A" }),
    tok(5, "NORMAL", "DONE", { doctorId: "A" }),
  ];

  it("contains waiting patients assigned to the doctor plus unassigned ones", () => {
    expect(seqs(eligibleQueue(tokens, "A"))).toEqual([1, 3]);
    expect(seqs(eligibleQueue(tokens, "B"))).toEqual([2, 3]);
  });

  it("with no doctor means the whole department", () => {
    expect(seqs(eligibleQueue(tokens, null))).toEqual([1, 2, 3]);
  });

  it("picks the first patient in that queue", () => {
    expect(pickNext(tokens, "B")?.seqNo).toBe(2);
    expect(pickNext([tok(9, "NORMAL", "DONE")], "A")).toBeUndefined();
  });

  it("serves a higher priority unassigned patient before the doctor's own normal patient", () => {
    const list = [tok(1, "NORMAL", "WAITING", { doctorId: "A" }), tok(2, "EMERGENCY")];
    expect(pickNext(list, "A")?.seqNo).toBe(2);
  });
});

describe("skip re-entry after the next 3 patients", () => {
  it("holds a skipped token for 3 calls, or fewer if fewer are waiting", () => {
    expect(SKIP_HOLD).toBe(3);
    expect(holdForSkip(0)).toBe(0);
    expect(holdForSkip(1)).toBe(1);
    expect(holdForSkip(2)).toBe(2);
    expect(holdForSkip(3)).toBe(3);
    expect(holdForSkip(40)).toBe(3);
  });

  it("returns the skipped patient after the next 3 are called", () => {
    const list = [
      tok(2, "NORMAL", "SKIPPED", { skipHold: 3 }),
      tok(3),
      tok(4),
      tok(5),
      tok(6),
      tok(7),
    ];
    expect(seqs(predictCallOrder(list, null))).toEqual([3, 4, 5, 2, 6, 7]);
  });

  it("returns the skipped patient after everyone when fewer than 3 are waiting", () => {
    const list = [tok(2, "NORMAL", "SKIPPED", { skipHold: 2 }), tok(3), tok(4)];
    expect(seqs(predictCallOrder(list, null))).toEqual([3, 4, 2]);
  });

  it("returns the skipped patient straight away when nobody else is waiting", () => {
    expect(seqs(predictCallOrder([tok(2, "NORMAL", "SKIPPED", { skipHold: 3 })], null))).toEqual([2]);
  });

  it("counts a later emergency among the calls made before the skipped patient returns", () => {
    const list = [tok(2, "NORMAL", "SKIPPED", { skipHold: 3 }), tok(3), tok(4), tok(5), tok(9, "EMERGENCY")];
    expect(seqs(predictCallOrder(list, null))).toEqual([9, 3, 4, 2, 5]);
  });

  it("keeps the priority of the skipped patient once it returns", () => {
    const list = [
      tok(2, "EMERGENCY", "SKIPPED", { skipHold: 3 }),
      tok(4),
      tok(5),
      tok(6),
      tok(7),
    ];
    expect(seqs(predictCallOrder(list, null))).toEqual([4, 5, 6, 2, 7]);
  });

  it("ticks every held token down by one per call and releases those that reach zero", () => {
    const result = releaseAfterCall([
      { id: "a", skipHold: 3 },
      { id: "b", skipHold: 1 },
      { id: "c", skipHold: 2 },
    ]);
    expect(result).toEqual([
      { id: "a", skipHold: 2, release: false },
      { id: "b", skipHold: 0, release: true },
      { id: "c", skipHold: 1, release: false },
    ]);
  });

  it("only predicts the queue of the given doctor", () => {
    const list = [
      tok(2, "NORMAL", "SKIPPED", { skipHold: 1, doctorId: "A" }),
      tok(3, "NORMAL", "WAITING", { doctorId: "A" }),
      tok(4, "NORMAL", "WAITING", { doctorId: "B" }),
    ];
    expect(seqs(predictCallOrder(list, "A"))).toEqual([3, 2]);
    expect(seqs(predictCallOrder(list, "B"))).toEqual([4]);
  });
});

describe("people ahead", () => {
  const list = [
    tok(1, "NORMAL", "IN_CONSULT"),
    tok(2),
    tok(3, "EMERGENCY"),
    tok(4),
    tok(5, "NORMAL", "SKIPPED", { skipHold: 1 }),
    tok(6, "NORMAL", "DONE"),
  ];
  const byseq = (n: number) => list.find((t) => t.seqNo === n)!;

  it("counts waiting patients called before this one", () => {
    expect(peopleAhead(list, byseq(3))).toBe(0); // emergency goes first
    expect(peopleAhead(list, byseq(2))).toBe(1);
    expect(peopleAhead(list, byseq(4))).toBe(2);
  });

  it("counts everyone called before a skipped patient returns, then those who sort ahead of them", () => {
    // seq 5 returns after 1 call, then sorts behind 2 and 4 (lower numbers)
    expect(peopleAhead(list, byseq(5))).toBe(3);
    const q = [tok(2, "NORMAL", "SKIPPED", { skipHold: 2 }), tok(4), tok(5), tok(6)];
    expect(peopleAhead(q, q[0] as QueueToken)).toBe(2); // 4 and 5 are called first
  });

  it("is zero for a patient who is being seen or is finished", () => {
    expect(peopleAhead(list, byseq(1))).toBe(0);
    expect(peopleAhead(list, byseq(6))).toBe(0);
  });
});

describe("daily reset of token numbers", () => {
  it("starts at 1 on a new day and continues from the highest number after that", () => {
    expect(nextSeqNo(null)).toBe(1);
    expect(nextSeqNo(undefined)).toBe(1);
    expect(nextSeqNo(0)).toBe(1);
    expect(nextSeqNo(33)).toBe(34);
  });

  it("uses the hospital's local calendar date, not UTC", () => {
    // 20:00 UTC on 24 Nov is already 01:30 on 25 Nov in India
    expect(localDate(new Date("2026-11-24T20:00:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-11-25T00:00:00.000Z");
    expect(localDate(new Date("2026-11-24T10:00:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-11-24T00:00:00.000Z");
    // 18:29 UTC is 23:59 IST, still the same day; one minute later is the next day
    expect(localDate(new Date("2026-11-24T18:29:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-11-24T00:00:00.000Z");
    expect(localDate(new Date("2026-11-24T18:30:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-11-25T00:00:00.000Z");
  });

  it("gives the same date for the whole local day, so numbering restarts exactly at local midnight", () => {
    const morning = localDate(new Date("2026-11-24T03:31:00Z")); // 09:01 IST
    const evening = localDate(new Date("2026-11-24T17:00:00Z")); // 22:30 IST
    const nextMorning = localDate(new Date("2026-11-25T03:31:00Z"));
    expect(morning.getTime()).toBe(evening.getTime());
    expect(nextMorning.getTime()).toBeGreaterThan(evening.getTime());
  });

  it("works for another time zone", () => {
    expect(localDate(new Date("2026-11-24T03:00:00Z"), "America/New_York").toISOString()).toBe("2026-11-23T00:00:00.000Z");
  });
});

describe("token numbers", () => {
  it("is the prefix and the number padded to 3 digits", () => {
    expect(formatTokenNumber("MED", 34)).toBe("MED-034");
    expect(formatTokenNumber("PED", 7)).toBe("PED-007");
    expect(formatTokenNumber("ORT", 1234)).toBe("ORT-1234");
  });
});

describe("estimated wait", () => {
  it("averages consult times of the last 20 patients (newest first)", () => {
    expect(averageConsultMinutes([6, 8, 10])).toBe(8);
    const many = [...Array(20).fill(10), ...Array(10).fill(100)];
    expect(averageConsultMinutes(many)).toBe(10);
  });

  it("falls back to a default when there is no history", () => {
    expect(averageConsultMinutes([])).toBe(10);
    expect(averageConsultMinutes([], 5)).toBe(5);
  });

  it("ignores impossible consult times (zero, negative, or over 3 hours)", () => {
    expect(averageConsultMinutes([0, -4, 400, 6, 10])).toBe(8);
    expect(averageConsultMinutes([0, 500])).toBe(10);
  });

  it("multiplies the average by the people ahead and rounds", () => {
    expect(estimateWaitMinutes(7.5, 4)).toBe(30);
    expect(estimateWaitMinutes(7.4, 3)).toBe(22);
    expect(estimateWaitMinutes(8, 0)).toBe(0);
  });

  it("measures a consult in minutes from start to completion", () => {
    expect(consultMinutes(new Date("2026-11-24T04:00:00Z"), new Date("2026-11-24T04:07:30Z"))).toBe(7.5);
    expect(consultMinutes(null, new Date())).toBeNull();
    expect(consultMinutes(new Date(), null)).toBeNull();
  });
});

describe("status move rules", () => {
  const allowed: [TokenStatus, TokenStatus][] = [
    ["WAITING", "CALLED"],
    ["CALLED", "IN_CONSULT"],
    ["CALLED", "SKIPPED"],
    ["CALLED", "NO_SHOW"],
    ["IN_CONSULT", "DONE"],
    ["SKIPPED", "WAITING"],
  ];

  it.each(allowed)("%s -> %s is allowed", (from, to) => {
    expect(canMove(from, to)).toBe(true);
  });

  it("refuses every other move (cancel is a separate rule)", () => {
    const allowedKeys = new Set(allowed.map(([f, t]) => `${f}>${t}`));
    for (const from of TOKEN_STATUSES) {
      for (const to of TOKEN_STATUSES) {
        if (to === "CANCELLED") continue;
        expect(canMove(from, to), `${from} -> ${to}`).toBe(allowedKeys.has(`${from}>${to}`));
      }
    }
  });

  it("does not let a token jump straight from waiting to done, or go back after it is done", () => {
    expect(canMove("WAITING", "DONE")).toBe(false);
    expect(canMove("WAITING", "IN_CONSULT")).toBe(false);
    expect(canMove("DONE", "WAITING")).toBe(false);
    expect(canMove("NO_SHOW", "CALLED")).toBe(false);
    expect(canMove("CANCELLED", "WAITING")).toBe(false);
  });

  it("lets a token be cancelled until it is finished", () => {
    for (const s of ["WAITING", "CALLED", "IN_CONSULT", "SKIPPED"] as const) {
      expect(canCancelFrom(s), s).toBe(true);
      expect(canMove(s, "CANCELLED"), s).toBe(true);
    }
    for (const s of ["DONE", "NO_SHOW", "CANCELLED"] as const) {
      expect(canCancelFrom(s), s).toBe(false);
      expect(canMove(s, "CANCELLED"), s).toBe(false);
    }
  });

  it("has a list of moves for every status", () => {
    expect(Object.keys(MOVES).sort()).toEqual([...TOKEN_STATUSES].sort());
  });
});

describe("who may do which queue action", () => {
  it("only a doctor calls the next patient", () => {
    expect(canPerform("next", "DOCTOR")).toBe(true);
    expect(canPerform("next", "CLERK")).toBe(false);
    expect(canPerform("next", "ADMIN")).toBe(false);
  });

  it("only a clerk or admin cancels", () => {
    expect(canPerform("cancel", "CLERK")).toBe(true);
    expect(canPerform("cancel", "ADMIN")).toBe(true);
    expect(canPerform("cancel", "DOCTOR")).toBe(false);
  });

  it.each(["skip", "recall", "no-show", "start", "complete", "transfer"] as const)(
    "%s is open to doctors and desk staff",
    (action) => {
      expect(canPerform(action, "DOCTOR")).toBe(true);
      expect(canPerform(action, "CLERK")).toBe(true);
    },
  );

  it("defines the roles and the starting statuses for every action", () => {
    expect(Object.keys(ACTION_ROLES).sort()).toEqual(
      ["cancel", "complete", "next", "no-show", "recall", "skip", "start", "transfer"].sort(),
    );
    expect(ACTION_FROM.start).toEqual(["CALLED"]);
    expect(ACTION_FROM.complete).toEqual(["IN_CONSULT"]);
    expect(ACTION_FROM.transfer).toEqual(["WAITING"]);
  });
});
