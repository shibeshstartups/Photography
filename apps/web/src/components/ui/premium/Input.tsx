import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  noLabel?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      success,
      helperText,
      noLabel = false,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const hasError = !!error;
    const hasSuccess = !!success;

    return (
      <div className="w-full">
        {!noLabel && label && (
          <label
            htmlFor={inputId}
            className={cn(
              "block text-sm font-medium text-foreground mb-2",
              (error || success) && "text-muted-foreground"
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "flex h-12 w-full rounded-xl border bg-background px-3 py-2 text-sm",
              "placeholder:text-muted-foreground transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-transparent",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              hasError && "border-destructive focus:ring-destructive",
              hasSuccess && "border-green-500 focus:ring-green-500",
              !hasError && !hasSuccess && "border-input hover:border-input/80",
              className
            )}
            aria-invalid={hasError ? "true" : false}
            aria-describedby={
              (error || success || helperText)
                ? `${inputId}-${error ? "error" : success ? "success" : "helper"}-desc`
                : undefined
            }
            {...props}
          />
          {rightIcon && !error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error-desc`}
            className="mt-1 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            id={`${inputId}-success-desc`}
            className="mt-1 text-sm text-green-600 dark:text-green-500"
          >
            {success}
          </p>
        )}
        {helperText && !error && !success && (
          <p
            id={`${inputId}-helper-desc`}
            className="mt-1 text-sm text-muted-foreground"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };