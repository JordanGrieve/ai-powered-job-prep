import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "./services/clerk/components/ClerkProvider";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const outfitSans = Outfit({
  variable: "--font-outfit-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Land — AI Powered Job Prep",
    template: "%s · Land",
  },
  description:
    "Practise a live voice mock interview against the exact job you're applying for, then get scored, specific feedback on how you did.",
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
