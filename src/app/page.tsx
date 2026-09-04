import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-md bg-primary font-bold text-primary-foreground">▲</div>
        <h1 className="text-2xl font-semibold">Business planning platform</h1>
        <p className="text-[13px] text-muted-foreground">Build an accurate business plan, step by step, and the document that goes with it — for a bank, a grant, an investor, or yourself.</p>
        <div className="flex justify-center gap-2">
          <Button render={<Link href="/signup" />}>Create an account</Button>
          <Button variant="outline" render={<Link href="/login" />}>Sign in</Button>
        </div>
      </div>
    </main>
  );
}
