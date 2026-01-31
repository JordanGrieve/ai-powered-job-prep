import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ComponentProps } from "react";

function UserAvatar({
  user,
  ...props
}: {
  user: { name: string; imageUrl: string } | null | undefined;
} & ComponentProps<typeof Avatar>) {
  return (
    <Avatar {...props}>
      <AvatarImage src={user?.imageUrl} alt={user?.name} />
      <AvatarFallback className="uppercase">
        {user?.name
          ?.split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  );
}

export default UserAvatar;
