import Link from "next/link";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon } from "lucide-react";

export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button variant="ghost" className={cn("-ml-3", className)} asChild>
      <Link
        href={href}
        className="flex gap-2 items-center text-muted-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {children}
      </Link>
    </Button>
  );
}

export default BackLink;
