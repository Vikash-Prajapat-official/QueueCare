// State for the TV board. It contains token numbers, room names and department names only:
// no patient names, no phone numbers, ever. The TV has no login, so this is enforced here
// by what the query selects, not by the screen.

import { db } from "@/lib/db";
import { formatTokenNumber, predictCallOrder } from "@/lib/queue";
import { hospitalToday } from "@/lib/queue-service";

export interface DisplayRoom {
  /** The doctor's id; one card per doctor. */
  key: string;
  departmentId: string;
  departmentName: { en: string; hi: string };
  color: string;
  prefix: string;
  /** Room name, or the doctor's display name when the doctor has no room. */
  title: string;
  roomName: string | null;
  current: {
    tokenId: string;
    label: string;
    seqNo: number;
    status: "CALLED" | "IN_CONSULT";
    calledAt: string | null;
    recallCount: number;
  } | null;
  /** Labels of the next 3 patients. */
  next: string[];
}

export interface DisplayState {
  rooms: DisplayRoom[];
  waitingTotal: number;
  serverTime: string;
}

export async function getDisplayState(departmentIds: string[]): Promise<DisplayState> {
  const date = await hospitalToday();
  const [doctors, tokens] = await Promise.all([
    db.doctor.findMany({
      where: { departmentId: { in: departmentIds }, user: { active: true } },
      select: {
        id: true,
        departmentId: true,
        displayName: true,
        room: { select: { name: true } },
        department: { select: { nameEn: true, nameHi: true, tokenPrefix: true, color: true } },
      },
    }),
    db.token.findMany({
      where: {
        departmentId: { in: departmentIds },
        date,
        status: { in: ["WAITING", "SKIPPED", "CALLED", "IN_CONSULT"] },
      },
      select: {
        id: true,
        seqNo: true,
        priority: true,
        status: true,
        skipHold: true,
        doctorId: true,
        departmentId: true,
        calledAt: true,
        recallCount: true,
      },
    }),
  ]);

  const rooms: DisplayRoom[] = doctors.map((d) => {
    const inDepartment = tokens.filter((t) => t.departmentId === d.departmentId);
    const mine = inDepartment.filter((t) => t.doctorId === d.id);
    const active = mine.find((t) => t.status === "CALLED") ?? mine.find((t) => t.status === "IN_CONSULT");
    const prefix = d.department.tokenPrefix;
    return {
      key: d.id,
      departmentId: d.departmentId,
      departmentName: { en: d.department.nameEn, hi: d.department.nameHi },
      color: d.department.color,
      prefix,
      title: d.room?.name ?? d.displayName,
      roomName: d.room?.name ?? null,
      current: active
        ? {
            tokenId: active.id,
            label: formatTokenNumber(prefix, active.seqNo),
            seqNo: active.seqNo,
            status: active.status as "CALLED" | "IN_CONSULT",
            calledAt: active.calledAt?.toISOString() ?? null,
            recallCount: active.recallCount,
          }
        : null,
      next: predictCallOrder(inDepartment, d.id)
        .slice(0, 3)
        .map((t) => formatTokenNumber(prefix, t.seqNo)),
    };
  });

  rooms.sort((a, b) => a.departmentName.en.localeCompare(b.departmentName.en) || a.title.localeCompare(b.title));

  return {
    rooms,
    waitingTotal: tokens.filter((t) => t.status === "WAITING" || t.status === "SKIPPED").length,
    serverTime: new Date().toISOString(),
  };
}
