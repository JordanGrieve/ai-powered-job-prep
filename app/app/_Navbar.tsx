"use client";

import {
  BookOpenIcon,
  BrainCircuit,
  FileSlidersIcon,
  LogOut,
  SpeechIcon,
  User,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import UserAvatar from "../features/users/components/UserAvatar";
import { useParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const navLinks = [
  { name: "Interviews", href: "interviews", Icon: SpeechIcon },
  { name: "Questions", href: "questions", Icon: BookOpenIcon },
  { name: "Resume", href: "resume", Icon: FileSlidersIcon },
];

export function Navbar({
  user,
}: {
  user: { name: string; imageUrl: string } | null | undefined;
}) {
  const { openUserProfile, signOut } = useClerk();
  const { jobinfoid } = useParams();
  const pathName = usePathname();

  return (
    <nav className="h-header flex items-center justify-between px-4 border-b">
      <Link href="/app" className="flex items-center gap-2">
        <BrainCircuit className="size-6 text-primary" />
        <span className="text-lg font-semibold">Land</span>
      </Link>

      <div className="flex items-center gap-2">
        {typeof jobinfoid === "string" &&
          navLinks.map(({ name, href, Icon }) => {
            const hrefPath = `/app/job-infos/${jobinfoid}/${href}`;
            const isActive = pathName === hrefPath;

            return (
              <Button
                variant={pathName === href ? "secondary" : "ghost"}
                key={name}
                asChild
                className="cursor-pointer max-sm:hidden"
              >
                <Link
                  key={name}
                  href={hrefPath}
                  className={`flex items-center gap-2 ${
                    isActive ? "text-primary" : "text-muted"
                  }`}
                >
                  <Icon />
                  {name}
                </Link>
              </Button>
            );
          })}

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
