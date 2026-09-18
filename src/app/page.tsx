import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="flex justify-center"><Brand height={38} /></div>
        {/* The lockup carries the name, so the heading says what the thing is rather than
            repeating it (§6.101). */}
        <h1 className="text-2xl font-semibold">Business planning, start to finish</h1>
        <p className="text-[13px] text-muted-foreground">Build an accurate business plan, step by step, and the document that goes with it — for a bank, a grant, an investor, or yourself.</p>
        <div className="flex justify-center gap-2">
          <Button render={<Link href="/signup" />}>Create an account</Button>
          <Button variant="outline" render={<Link href="/login" />}>Sign in</Button>
        </div>
      </div>
    </main>
  );
}
