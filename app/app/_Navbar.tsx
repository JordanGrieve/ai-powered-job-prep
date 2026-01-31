"use client";

import { BrainCircuit, LogOut, User } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";

export function Navbar({
  user,
}: {
  user: { name: string; imageUrl: string } | null | undefined;
}) {
  const { openUserProfile, signOut } = useClerk();

  return (
    <nav className="h-header flex items-center justify-between px-4 border-b">
      <Link href="/app" className="flex items-center gap-2">
        <BrainCircuit className="size-6 text-primary" />
        <span className="text-lg font-semibold">Land</span>
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger>
            <UserAvatar user={user} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openUserProfile()}>
              <User />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOut({ redirectUrl: "/" })}
            >
              <LogOut />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
