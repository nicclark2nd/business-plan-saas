import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Business planning platform",
  description: "Build an accurate business plan and the document that goes with it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
