import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vitrine — Product Intelligence",
  description: "Semantic product search and clustering",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
