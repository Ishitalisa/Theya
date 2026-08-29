import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://theyabrief.vercel.app"),
  title: "THEYA — Brief. Predict. Prove.",
  description:
    "Swipe categorized news briefs and take one fixed-stake daily position on Monad.",
  applicationName: "THEYA",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  openGraph: {
    title: "THEYA — Brief. Predict. Prove.",
    description:
      "Swipe categorized news briefs and take one fixed-stake daily position.",
    images: ["/theya-logo.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "THEYA",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#11110f",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
