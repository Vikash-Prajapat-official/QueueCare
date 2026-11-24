// Admin tools for a patient's own data rights (DPDP Act): find, export and erase one patient.
// Erasing makes the patient anonymous instead of deleting rows, so queue counts and reports stay correct.

import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { formatTokenNumber } from "@/lib/queue";
import { ANONYMISED_NAME } from "@/lib/retention";

export async function findPatientsForAdmin(phone: string) {
  const rows = await db.patient.findMany({
    where: { phone, anonymised: false },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, age: true, sex: true, createdAt: true, _count: { select: { tokens: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    sex: p.sex,
    createdAt: p.createdAt.toISOString(),
    visits: p._count.tokens,
  }));
}

/** Everything the system holds about one patient, for handing to them on request. */
export async function exportPatientData(id: string) {
  const patient = await db.patient.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      age: true,
      sex: true,
      abhaNumber: true,
      anonymised: true,
      createdAt: true,
      tokens: {
        orderBy: { createdAt: "asc" },
        select: {
          date: true,
          seqNo: true,
          visitType: true,
          priority: true,
          status: true,
          source: true,
          createdAt: true,
          calledAt: true,
          startedAt: true,
          completedAt: true,
          department: { select: { nameEn: true, tokenPrefix: true } },
          doctor: { select: { displayName: true } },
        },
      },
      consents: {
        orderBy: { givenAt: "asc" },
        select: { purpose: true, noticeVersion: true, channel: true, givenAt: true },
      },
    },
  });
  if (!patient) throw new ApiError(404, "NOT_FOUND", "Patient not found.");

  return {
    exportedAt: new Date().toISOString(),
    patient: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      age: patient.age,
      sex: patient.sex,
      abhaNumber: patient.abhaNumber,
      anonymised: patient.anonymised,
      createdAt: patient.createdAt.toISOString(),
    },
    visits: patient.tokens.map((t) => ({
      date: t.date.toISOString().slice(0, 10),
      token: formatTokenNumber(t.department.tokenPrefix, t.seqNo),
      department: t.department.nameEn,
      doctor: t.doctor?.displayName ?? null,
      visitType: t.visitType,
      priority: t.priority,
      status: t.status,
      source: t.source,
      createdAt: t.createdAt.toISOString(),
      calledAt: t.calledAt?.toISOString() ?? null,
      startedAt: t.startedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
    consents: patient.consents.map((c) => ({
      purpose: c.purpose,
      noticeVersion: c.noticeVersion,
      channel: c.channel,
      givenAt: c.givenAt.toISOString(),
    })),
  };
}

/** Removes name, phone and ABHA number. Visits are kept without any link to a person. */
export async function erasePatient(id: string) {
  const existing = await db.patient.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Patient not found.");
  await db.patient.update({
    where: { id },
    data: { name: ANONYMISED_NAME, phone: "", abhaNumber: null, anonymised: true },
  });
}
