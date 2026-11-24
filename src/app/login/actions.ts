"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function loginAction(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  // Only same-site paths are accepted as the page to return to.
  const callback = String(formData.get("callbackUrl") ?? "");
  const redirectTo = callback.startsWith("/") && !callback.startsWith("//") ? callback : "/login";

  try {
    await signIn("credentials", {
      phone: String(formData.get("phone") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      const tooMany = (e as { code?: string }).code === "rate_limited";
      return {
        error: tooMany
          ? "Too many tries. Please wait 15 minutes, or ask the admin to help."
          : "Wrong phone number or password.",
      };
    }
    throw e; // the redirect after a successful login is thrown on purpose
  }
  return {};
}
