"use client";

import { useSyncExternalStore } from "react";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const themes = [
  {
    name: "Light",
    icon: Sun,
    value: "light",
  },
  {
    name: "Dark",
    icon: Moon,
    value: "dark",
  },
  { name: "System", icon: Monitor, value: "system" },
] as const;

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  // next-themes cannot resolve a theme during SSR, so the trigger has to wait
  // for hydration. useSyncExternalStore reports false on the server and true on
  // the client without the extra setState-in-effect render pass.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {resolvedTheme === "light" ? <Sun /> : <Moon />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map(({ name, icon: Icon, value }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "cursor-pointer",
              theme === value && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
