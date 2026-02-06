import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import NightVisionTrigger from "./components/night-vision-trigger";
import PrimaryNav from "./components/primary-nav";

const display = Nunito_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const body = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "The Build Notes Kitchen",
  description: "A calm build log chronicling the craft behind this blog.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <NightVisionTrigger>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <PrimaryNav />
          <main id="main-content">{children}</main>
        </NightVisionTrigger>
      </body>
    </html>
  );
}
