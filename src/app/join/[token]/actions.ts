"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error?: string } | undefined;

/** Join the firm (§6.184): the database checks the email and that the invitation is still open (0061). */
export async function acceptTeamInvitation(_: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_team_invitation", { p_token: token });
  if (error || !data) {
    console.error("accept team invitation", error);
    return { error: /wrong email/.test(error?.message ?? "") ? "This invitation was sent to a different email address."
      : /closed/.test(error?.message ?? "") ? "This invitation has closed. Ask your firm's admin for a new link."
      : "Couldn't join the team. Try again in a moment." };
  }
  redirect("/firm/clients");
}
