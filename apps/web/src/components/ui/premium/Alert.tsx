import { forwardRef, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive";
  showCloseButton?: boolean;
  onClose?: () => void;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = "default",
      showCloseButton = false,
      onClose,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: "bg-accent text-accent-foreground border-border",
      success: "bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200 border border-green-200 dark:border-green-800",
      warning: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800",
      destructive: "bg-destructive text-destructive-foreground",
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative flex items-center justify-between gap-4 p-4 rounded-xl",
          "shadow-sm",
          variants[variant],
          className
        )}
        {...props}
      >
        <div className="flex-1">{children}</div>
        {showCloseButton && onClose && (
          <button
            type="button"
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = "Alert";

export { Alert };