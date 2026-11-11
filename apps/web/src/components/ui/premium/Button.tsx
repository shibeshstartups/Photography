import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost" | "link" | "icon";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  fullWidth?: boolean;
  noShadow?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      fullWidth,
      noShadow,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      primary:
        "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md dark:bg-blue-500 dark:hover:bg-blue-600",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md dark:bg-gray-800 dark:hover:bg-gray-700",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md dark:bg-red-500 dark:hover:bg-red-600",
      outline:
        "border border-border bg-background hover:bg-accent hover:text-accent-foreground shadow-sm dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-accent-foreground",
      ghost:
        "hover:bg-accent hover:text-accent-foreground text-foreground shadow-sm dark:hover:bg-gray-800 dark:hover:text-accent-foreground",
      link:
        "text-primary underline-offset-4 hover:underline transparent-border hover:shadow-none dark:text-blue-400",
      icon:
        "hover:bg-accent text-foreground shadow-sm dark:hover:bg-gray-800",
    };

    const sizes = {
      sm: "h-8 px-3 text-sm font-medium",
      md: "h-10 px-4 py-2 text-sm font-medium",
      lg: "h-12 px-6 text-base font-semibold",
      xl: "h-14 px-8 text-lg font-semibold",
    };

    const shadowClass = noShadow ? "" : (variant !== "ghost" && variant !== "link" ? "shadow-sm" : "");

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          shadowClass,
          fullWidth && "w-full",
          loading && "relative cursor-not-allowed",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };