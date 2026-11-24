import { requireRole, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exportPatientData } from "@/lib/patient-privacy";

export const dynamic = "force-dynamic";

// GET /api/admin/patients/:id/export  (ADMIN): everything held about one patient, as a JSON file.
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(["ADMIN"]);
  const { id } = await ctx.params;
  const data = await exportPatientData(id);
  await audit(user.id, "patient.export", "Patient", id, req);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="queuecare-patient-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
