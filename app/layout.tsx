import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "./services/clerk/components/ClerkProvider";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { SkipToContent } from "@/components/SkipToContent";
import { SITE_URL } from "@/lib/siteUrl";

const outfitSans = Outfit({
  variable: "--font-outfit-sans",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Practise a live voice mock interview against the exact job you're applying for, then get scored, specific feedback on how you did.";

export const metadata: Metadata = {
  // Without this, the OG and canonical URLs Next emits are relative, which
  // most social scrapers will not resolve. It is the one line that makes
  // opengraph-image.tsx actually reach Slack, LinkedIn and iMessage.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Callback — AI Powered Job Prep",
    template: "%s · Callback",
  },
  description: DESCRIPTION,
  applicationName: "Callback",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Callback",
    title: "Callback — AI Powered Job Prep",
    description: DESCRIPTION,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Callback — AI Powered Job Prep",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Clerk v7 requires ClerkProvider INSIDE <body> rather than wrapping
    // <html>. Wrapping the document element is a v6 pattern and no longer
    // supported.
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfitSans.variable} antialiased font-sans`}>
        {/* First focusable element in the document, ahead of every provider,
            so one Tab from page load reaches it. */}
        <SkipToContent />
        <ClerkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            enableColorScheme
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
