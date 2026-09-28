"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AcceptState = { error?: string } | undefined;

/** Accept (§6.183): the database checks the email and that the invitation is still open (0060). */
export async function acceptInvitation(_: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_plan_invitation", { p_token: token });
  if (error || !data) {
    console.error("accept invitation", error);
    return { error: /wrong email/.test(error?.message ?? "") ? "This invitation was sent to a different email address."
      : /closed/.test(error?.message ?? "") ? "This invitation has closed. Ask your Planner for a new link."
      : "Couldn't open the plan. Try again in a moment." };
  }
  redirect(`/plans/${data as string}/dashboard`);
}
