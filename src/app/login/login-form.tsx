"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { loginAction } from "./actions";

export function LoginForm({ callbackUrl, passwordChanged }: { callbackUrl: string; passwordChanged: boolean }) {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {passwordChanged && (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          Password changed. Please log in again with the new password.
        </p>
      )}
      <div>
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="username" required autoFocus />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
