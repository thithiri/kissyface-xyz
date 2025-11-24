import Providers from "@/app/providers";
import type { Metadata, Viewport } from "next";
import PlausibleProvider from "next-plausible";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-dm-sans",
});

let title = "KissyFace 😘 - monetizations for HuggingFace 🤗 AI models creators";
let description = "Beautiful images 🖼️ for you. Rewards 💋 for creators.";
let url = "https://www.kissyface.xyz/";
let sitename = "kissyface.xyz";

export const metadata: Metadata = {
  // metadataBase: new URL(url),
  title,
  description,
  openGraph: {
    title,
    description,
    url: url,
    siteName: sitename,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0891b2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full ${ibmPlexMono.variable} ${dmSans.variable}`}
    >
      <head>
        <PlausibleProvider domain="kissyface.xyz" />
      </head>
      <body className="h-full min-h-full font-sans text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
