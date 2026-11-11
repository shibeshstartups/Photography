import { forwardRef, ImgHTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { User } from "lucide-react";

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, fallback, size = "md", ...props }, ref) => {
    const sizes = {
      xs: "h-6 w-6 text-xs",
      sm: "h-8 w-8 text-sm",
      md: "h-10 w-10 text-base",
      lg: "h-12 w-12 text-lg",
      xl: "h-16 w-16 text-xl",
    };

    const initials = fallback
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <span
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          "bg-muted text-muted-foreground",
          "border border-border",
          sizes[size],
          className
        )}
      >
        {props.src && !props.src.includes("error") ? (
          <img
            {...props}
            className="h-full w-full object-cover"
            onError={(e) => {
              if (props.onError) props.onError(e);
              e.currentTarget.src = "";
            }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {initials || <User className="h-5 w-5" />}
          </span>
        )}
      </span>
    );
  }
);

Avatar.displayName = "Avatar";

export { Avatar };