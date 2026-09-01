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
import { Suspense, use } from "react";

// Every nav item now has a route segment. `ready: false` renders a disabled
// button instead of a link — use it for anything added before its segment
// exists, so the nav can never point at Next's default 404.
const navLinks = [
  { name: "Interviews", href: "interviews", Icon: SpeechIcon, ready: true },
  { name: "Questions", href: "questions", Icon: BookOpenIcon, ready: true },
  { name: "Resume", href: "resume", Icon: FileSlidersIcon, ready: true },
];

type NavUser = { name: string; imageUrl: string } | null | undefined;

// Only the avatar depends on the user, so only the avatar suspends. Wrapping
// the whole Navbar would blank the logo, nav links and theme toggle for no
// reason.
function NavAvatar({ userPromise }: { userPromise: Promise<NavUser> }) {
  const user = use(userPromise);
  return <UserAvatar user={user} />;
}

export function Navbar({ userPromise }: { userPromise: Promise<NavUser> }) {
  const { openUserProfile, signOut } = useClerk();
  const { jobinfoid } = useParams();
  const pathName = usePathname();

  return (
    // The border spans the full viewport; the CONTENT sits in the same
    // `container` every /app page uses, so the logo lines up with the page
    // heading beneath it instead of sitting 16px from the edge.
    <nav className="h-header border-b">
      <div className="container h-full flex items-center justify-between">
        <Link href="/app" className="flex items-center gap-2">
          <BrainCircuit className="size-6 text-primary" />
          <span className="text-lg font-semibold">Land</span>
        </Link>

        <div className="flex items-center gap-2">
          {typeof jobinfoid === "string" &&
            navLinks.map(({ name, href, Icon, ready }) => {
              const hrefPath = `/app/job-infos/${jobinfoid}/${href}`;
              const isActive = pathName === hrefPath;

              if (!ready) {
                return (
                  <Button
                    variant="ghost"
                    key={name}
                    disabled
                    title={`${name} is coming soon`}
                    className="max-sm:hidden"
                  >
                    <Icon />
                    {name}
                  </Button>
                );
              }

              return (
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  key={name}
                  asChild
                  className="cursor-pointer max-sm:hidden"
                >
                  <Link
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
              <Suspense
                fallback={
                  <div className="size-8 rounded-full bg-muted animate-pulse" />
                }
              >
                <NavAvatar userPromise={userPromise} />
              </Suspense>
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
      </div>
    </nav>
  );
}
