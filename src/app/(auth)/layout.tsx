import { Brand } from "@/components/Brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        {/* The name belongs on the first screen a client sees (§6.101). It read "Business
            planning platform" until now, which described the product without ever naming it. */}
        <div className="mb-6 flex items-center">
          <Brand height={30} />
        </div>
        {children}
      </div>
    </main>
  );
}
