import { HTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, ...props }, ref) => {
    const [hasError, setHasError] = useState(false);

    const initials = fallback || alt?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

    return (
      <div
        ref={ref}
        className={clsx("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
        {...props}
      >
        {src && !hasError ? (
          <img
            src={src}
            alt={alt || ""}
            className="aspect-square h-full w-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-muted">
            <span className="text-sm font-medium">{initials}</span>
          </div>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

import { useState } from "react";

export { Avatar };