// Runs once when the server starts (not in the browser, not at build time).
export async function register() {
  // The check must be written exactly like this so Next.js leaves the Node-only code out of the Edge build.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobs } = await import("./lib/jobs");
    startJobs();
  }
}
