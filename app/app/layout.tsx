import { redirect } from "next/navigation";
import { getCurrentUser } from "../services/clerk/lib/getCurrentUser";
import { ReactNode } from "react";
import { Navbar } from "./_Navbar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { userId, user } = await getCurrentUser({
    allData: true,
  });

  if (userId == null) return redirect("/");
  // A signed-in Clerk user whose users row does not exist yet must not reach
  // the app: the Navbar renders an empty avatar and createJobInfo would hit a
  // foreign-key violation. /onboarding polls until the webhook lands and then
  // bounces back here.
  if (user == null) return redirect("/onboarding");

  return (
    <>
      <Navbar user={user} />
      {children}
    </>
  );
}
