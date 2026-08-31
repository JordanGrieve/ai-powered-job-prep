import { getCurrentUser } from "../services/clerk/lib/getCurrentUser";
import { ReactNode } from "react";
import { Navbar } from "./_Navbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  // Deliberately NOT awaited. Awaiting here blocked every Suspense boundary
  // below - including the ones the dashboard and interviews pages define - so
  // their fallbacks never got to buy the time they were written to buy.
  //
  // The old `userId == null -> redirect("/")` guard is gone because proxy.ts
  // already runs auth.protect() on every non-public route. The "signed in but
  // no users row yet" guard moved down into the dashboard page, which awaits
  // getCurrentUser anyway; the deeper routes are independently safe because
  // every job-info read is scoped by userId and createJobInfo pre-checks the
  // users row before inserting.
  const userPromise = getCurrentUser({ allData: true }).then((r) => r.user);

  return (
    <>
      <Navbar userPromise={userPromise} />
      {children}
    </>
  );
}
