import Link from "next/link";
export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-primary font-bold text-white">▲</div>
        <h1 className="text-2xl font-semibold">Business planning platform</h1>
        <p className="text-[13px] text-muted">Build an accurate business plan, step by step, and the document that goes with it — for a bank, a grant, an investor, or yourself.</p>
        <div className="flex justify-center gap-2"><Link href="/signup" className="btn btn-primary">Create an account</Link><Link href="/login" className="btn">Sign in</Link></div>
      </div>
    </main>
  );
}
