import type { Metadata } from "next";
import { DM_Serif_Display, Work_Sans } from "next/font/google";
import "./globals.css";
import NightVisionTrigger from "./components/night-vision-trigger";

const display = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const body = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
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
        <NightVisionTrigger>{children}</NightVisionTrigger>
      </body>
    </html>
  );
}
