import { ReactNode, forwardRef } from "react";
import { cn } from "../../lib/utils";

interface TypographyProps {
  children: ReactNode;
  className?: string;
}

const H1 = forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ children, className }, ref) => (
    <h1
      ref={ref}
      className={cn(
        "text-3xl font-bold text-foreground tracking-tight",
        "sm:text-4xl md:text-5xl",
        className
      )}
    >
      {children}
    </h1>
  )
);

H1.displayName = "H1";

const H2 = forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ children, className }, ref) => (
    <h2
      ref={ref}
      className={cn(
        "text-2xl font-bold text-foreground tracking-tight",
        className
      )}
    >
      {children}
    </h2>
  )
);

H2.displayName = "H2";

const H3 = forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ children, className }, ref) => (
    <h3
      ref={ref}
      className={cn("text-xl font-semibold text-foreground", className)}
    >
      {children}
    </h3>
  )
);

H3.displayName = "H3";

const Body = forwardRef<HTMLParagraphElement, TypographyProps>(
  ({ children, className }, ref) => (
    <p ref={ref} className={cn("text-base text-foreground", className)}>
      {children}
    </p>
  )
);

Body.displayName = "Body";

const BodySmall = forwardRef<HTMLParagraphElement, TypographyProps>(
  ({ children, className }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  )
);

BodySmall.displayName = "BodySmall";

export { H1, H2, H3, Body, BodySmall };