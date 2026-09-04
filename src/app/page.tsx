export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F2F4F7] text-[#1F2933]">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto h-10 w-10 rounded-md bg-[#1F6FCB] text-white grid place-items-center font-bold">▲</div>
        <h1 className="text-2xl font-semibold">Business planning platform</h1>
        <p className="text-sm text-[#6B7A8C]">
          Skeleton deployment. The application is being built from the requirements in
          <code className="mx-1">docs/planning</code>.
        </p>
      </div>
    </main>
  );
}
