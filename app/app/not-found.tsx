import { Button } from "@/components/ui/button";
import Link from "next/link";

// Lives under app/app so it renders inside AppLayout and keeps the Navbar.
// A root-only boundary would drop the app shell entirely.
export default function AppNotFound() {
  return (
    <div className="h-screen-header flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl md:text-4xl">We couldn&apos;t find that</h1>
      <p className="text-muted-foreground max-w-prose">
        This job description or interview either doesn&apos;t exist or
        isn&apos;t yours.
      </p>
      <Button asChild className="mt-2">
        <Link href="/app">Back to dashboard</Link>
      </Button>
    </div>
  );
}
