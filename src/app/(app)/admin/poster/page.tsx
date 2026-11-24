import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/print-button";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/page-auth";

export const metadata = { title: "Poster and TV screens · QueueCare" };

export default async function PosterPage() {
  await requirePageRole(["ADMIN"]);
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const displayKey = process.env.DISPLAY_KEY ?? "";
  const [departments, hospital] = await Promise.all([
    db.department.findMany({ where: { active: true }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true } }),
    db.hospital.findFirst({ select: { name: true } }),
  ]);

  const checkInUrl = `${appUrl}/checkin`;
  const qr = appUrl ? await QRCode.toDataURL(checkInUrl, { margin: 2, width: 600 }) : null;
  const tv = (ids: string) => `${appUrl}/display/${ids}?key=${displayKey}`;
  const allIds = departments.map((d) => d.id).join(",");

  return (
    <div className="space-y-6">
      <div className="space-y-6 print:hidden">
        <h1 className="text-2xl font-bold">Poster and TV screens</h1>

        {!appUrl && (
          <p role="alert" className="rounded-md bg-muted p-3 text-sm font-medium text-destructive">
            APP_URL is not set in the .env file, so links and the QR code cannot be made. Set it to the server address
            (for example http://192.168.1.10:3000) and restart.
          </p>
        )}
        {!displayKey && (
          <p role="alert" className="rounded-md bg-muted p-3 text-sm font-medium text-destructive">
            DISPLAY_KEY is not set in the .env file, so TV screens cannot open the board.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>TV board links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Open one of these addresses in the browser of the TV or Android TV stick, then press OK once to turn on the
              sound. Anyone with the link can see the board, so keep it to staff.
            </p>
            {departments.length > 1 && (
              <p>
                <strong>All departments</strong>
                <br />
                <a className="break-all text-primary underline" href={tv(allIds)} target="_blank" rel="noreferrer">
                  {tv(allIds)}
                </a>
              </p>
            )}
            {departments.map((d) => (
              <p key={d.id}>
                <strong>{d.nameEn}</strong>
                <br />
                <a className="break-all text-primary underline" href={tv(d.id)} target="_blank" rel="noreferrer">
                  {tv(d.id)}
                </a>
              </p>
            ))}
          </CardContent>
        </Card>

        <PrintButton label="Print check-in poster" />
      </div>

      {/* The poster. Only this part is printed (A4, portrait). */}
      <section className="mx-auto max-w-xl rounded-2xl border border-border p-8 text-center print:max-w-none print:rounded-none print:border-0">
        <p className="text-xl font-semibold">{hospital?.name ?? "QueueCare"}</p>
        <h2 className="mt-4 text-4xl font-extrabold text-primary">Get your OPD token on your phone</h2>
        <p className="mt-2 text-3xl font-bold">अपने फ़ोन पर OPD टोकन पाएँ</p>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code for check-in" className="mx-auto my-6 size-80" />
        ) : (
          <p className="my-12 text-muted-foreground">QR code needs APP_URL.</p>
        )}
        <p className="text-2xl">Scan with your phone camera</p>
        <p className="text-2xl">फ़ोन के कैमरे से स्कैन करें</p>
        <p className="mt-4 break-all text-sm text-muted-foreground">{checkInUrl}</p>
      </section>
    </div>
  );
}
