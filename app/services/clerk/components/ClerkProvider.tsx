import { ClerkProvider as OriginalClerkProvider } from "@clerk/nextjs";

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <OriginalClerkProvider>{children}</OriginalClerkProvider>;
}
