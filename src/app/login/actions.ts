"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

// Returns a code, not text: the form shows it in the visitor's language.
export async function loginAction(
  _prev: { error?: "rate_limited" | "invalid" },
  formData: FormData,
): Promise<{ error?: "rate_limited" | "invalid" }> {
  // Only same-site paths are accepted as the page to return to.
  const callback = String(formData.get("callbackUrl") ?? "");
  const redirectTo = callback.startsWith("/") && !callback.startsWith("//") ? callback : "/post-login";

  try {
    await signIn("credentials", {
      phone: String(formData.get("phone") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: (e as { code?: string }).code === "rate_limited" ? "rate_limited" : "invalid" };
    }
    throw e; // the redirect after a successful login is thrown on purpose
  }
  return {};
}
