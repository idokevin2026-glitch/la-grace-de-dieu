import type { Metadata } from "next";
import { Marcellus, Karla } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { Assistant } from "@/components/assistant/Assistant";

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "La Grâce de Dieu — Tenues traditionnelles & cérémonies",
  description: "Boutique en ligne à Gagnoa, Côte d'Ivoire. Tenues traditionnelles (Kita tissé main, Adinkra), pagnes wax et Hitarget, bijoux, chaussures, bagagerie et prêt-à-porter pour vos mariages, baptêmes, dot et fiançailles.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${marcellus.variable} ${karla.variable}`}>
      <body>
        <Providers>
          <Header />
          <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</main>
          <Footer />
          <Assistant />
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
