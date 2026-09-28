"use client";

import { useActionState } from "react";
import { acceptTeamInvitation } from "./actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormMessage";

export function JoinButton({ token, firm }: { token: string; firm: string }) {
  const [state, action, pending] = useActionState(acceptTeamInvitation, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormError>{state?.error}</FormError>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Joining…" : `Join ${firm} →`}</Button>
    </form>
  );
}
