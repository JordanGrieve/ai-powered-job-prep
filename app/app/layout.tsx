import { redirect } from "next/navigation";
import { getCurrentUser } from "../services/clerk/lib/getCurrentUser";
import { ReactNode } from "react";
import { Navbar } from "./_Navbar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { userId, user } = await getCurrentUser({
    allData: true,
  });

  if (userId == null) return redirect("/");

  return (
    <>
      <Navbar user={user} />
      {children}
    </>
  );
}
