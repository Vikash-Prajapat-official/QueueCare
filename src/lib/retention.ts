import { audit } from "@/lib/audit";
import { retentionDays } from "@/lib/consent";
import { db } from "@/lib/db";

export const ANONYMISED_NAME = "Anonymised patient";

/** Patients whose last visit is older than this are anonymised. */
export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/**
 * Anonymise name, phone and ABHA number of patients not seen for `days` days. Token counts,
 * times and statuses are kept, so reports stay correct. "Last seen" is the newest token,
 * or the day the patient was added if they never had one. Safe to run again at any time.
 * Returns how many patients were anonymised.
 */
export async function anonymiseExpiredPatients(now = new Date(), days = retentionDays()): Promise<number> {
  const cutoff = retentionCutoff(now, days);
  const count = await db.$executeRaw`
    UPDATE patients p
       SET name = ${ANONYMISED_NAME}, phone = '', abha_number = NULL, anonymised = true
     WHERE p.anonymised = false
       AND GREATEST(p.created_at, COALESCE((SELECT MAX(t.created_at) FROM tokens t WHERE t.patient_id = p.id), p.created_at)) < ${cutoff}`;
  // The count goes in entity_id so the audit screen shows it; the log never holds personal data.
  await audit(null, "retention.run", "Patient", `anonymised=${count} after=${days}d`);
  return count;
}
