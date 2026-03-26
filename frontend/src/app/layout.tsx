import type { Metadata } from "next";
import Nav from "@/components/Nav";
import OnboardingGuide from "@/components/OnboardingGuide";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vitrine · Catalogue Intelligent",
  description: "Recherche intelligente et analyse du catalogue produit",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col">
        <Nav />
        <OnboardingGuide />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
