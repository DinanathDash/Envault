"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps extends React.ComponentPropsWithoutRef<
  typeof Avatar
> {
  user?: {
    email?: string;
    avatar?: string;
    firstName?: string;
    lastName?: string;
    name?: string; // For cases where we just have a full name
    username?: string; // Username field
  };
  userId?: string; // Alternative to user object - just the ID (deprecated, avoid using)
  email?: string; // Email for the user
  avatar?: string; // Direct avatar URL
  avatarSeed?: string; // Optional override for generating the avatar
  fallbackType?: "dicebear" | "initials";
}

export function UserAvatar({
  user,
  email: propEmail,
  avatar: propAvatar,
  className,
  avatarSeed,
  fallbackType: _fallbackType = "dicebear",
  ...props
}: UserAvatarProps) {
  const proxiedAvatar = React.useMemo(() => {
    if (!propAvatar && !user?.avatar) return "";

    const rawAvatar = propAvatar || user?.avatar || "";
    if (!rawAvatar) return "";

    // Keep internal assets and already-proxied URLs untouched.
    if (
      rawAvatar.startsWith("/") ||
      rawAvatar.startsWith("data:") ||
      rawAvatar.startsWith("blob:") ||
      rawAvatar.startsWith("/api/avatar?")
    ) {
      return rawAvatar;
    }

    try {
      const parsed = new URL(rawAvatar);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return rawAvatar;
      }

      return `/api/avatar?url=${encodeURIComponent(rawAvatar)}`;
    } catch {
      return rawAvatar;
    }
  }, [propAvatar, user?.avatar]);

  // Determine the values to use
  const email = propEmail || user?.email || "";
  const avatar = proxiedAvatar;

  // Use username if available, otherwise email for display name
  const displayName =
    user?.username || user?.name || user?.firstName || email || "User";
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  // Use username or email for seeding (avoid userId for privacy)
  const seed = avatarSeed || user?.username || email || "user";
  const dicebearUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
  const [imageSrc, setImageSrc] = React.useState(avatar || dicebearUrl);

  React.useEffect(() => {
    setImageSrc(avatar || dicebearUrl);
  }, [avatar, dicebearUrl]);

  return (
    <Avatar className={cn("h-8 w-8", className)} {...props}>
      <AvatarImage
        src={imageSrc}
        alt={displayName}
        onError={() => {
          if (imageSrc !== dicebearUrl) {
            setImageSrc(dicebearUrl);
          }
        }}
      />
      <AvatarFallback className="bg-muted">
        {_fallbackType === "initials" ? initials : null}
      </AvatarFallback>
    </Avatar>
  );
}
