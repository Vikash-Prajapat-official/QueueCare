// Shown by the service worker when the phone has no network. Static and in both languages on purpose:
// it is saved on the device once, so it cannot depend on the language cookie.
export const dynamic = "force-static";
export const metadata = { title: "Offline · ऑफ़लाइन" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold text-primary">QueueCare</h1>
      <p className="text-xl font-semibold">You are offline.</p>
      <p className="text-muted-foreground">
        Queue screens need a connection to the hospital server. Check your Wi-Fi, then try again.
      </p>
      <p lang="hi" className="mt-2 text-xl font-semibold">
        आप ऑफ़लाइन हैं।
      </p>
      <p lang="hi" className="text-muted-foreground">
        कतार देखने के लिए अस्पताल के सर्वर से जुड़ना ज़रूरी है। अपना वाई-फ़ाई जाँचें और फिर कोशिश करें।
      </p>
    </main>
  );
}
