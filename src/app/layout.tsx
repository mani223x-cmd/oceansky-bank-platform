import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/shared/ThemeProvider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OceanSky Bank — Modern Digital Banking",
  description:
    "OceanSky Bank — a modern digital banking platform. Customer portal and administrative portal with accounts, transfers, cards, bills, statements, support and full bank operations.",
  keywords: [
    "OceanSky Bank",
    "digital banking",
    "online banking",
    "fintech",
    "customer portal",
    "admin portal",
  ],
  authors: [{ name: "OceanSky Bank" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "OceanSky Bank",
    description: "Modern digital banking platform",
    siteName: "OceanSky Bank",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
