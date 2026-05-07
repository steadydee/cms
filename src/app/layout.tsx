import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Partners",
  description: "Partners CRM for operators, agencies, and outreach tasks.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <head>
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = localStorage.getItem("ow-crm-theme");
  if (theme === "night") {
    document.documentElement.setAttribute("data-theme", "night");
    var syncBodyTheme = function () {
      if (document.body) document.body.setAttribute("data-theme", "night");
    };
    if (document.body) {
      syncBodyTheme();
    } else {
      document.addEventListener("DOMContentLoaded", syncBodyTheme, { once: true });
    }
  }
} catch (_) {}
            `.trim(),
          }}
        />
      </head>
      <body className="h-full min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
