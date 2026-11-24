// Public demo mode (DEMO_MODE=1). Only for a shared online demo: it stops visitors from changing the
// shared logins. A real hospital install never sets it, and then nothing here has any effect.
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}
