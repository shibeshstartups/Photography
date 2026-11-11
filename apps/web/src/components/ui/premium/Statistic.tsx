import { forwardRef, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface StatisticProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  value: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  formatting?: "currency" | "percentage" | "number";
  locale?: string;
  currency?: string;
}

const Statistic = forwardRef<HTMLDivElement, StatisticProps>(
  (
    {
      className,
      title,
      value,
      prefix,
      suffix,
      formatting = "number",
      locale = "en-US",
      currency = "USD",
      ...props
    },
    ref
  ) => {
    const formatValue = () => {
      if (typeof value === "number") {
        switch (formatting) {
          case "currency":
            return new Intl.NumberFormat(locale, {
              style: "currency",
              currency,
            }).format(value);
          case "percentage":
            return new Intl.NumberFormat(locale, {
              style: "percent",
              sign: "auto",
            }).format(value / 100);
          default:
            return new Intl.NumberFormat(locale).format(value);
        }
      }
      return value;
    };

    return (
      <div ref={ref} className={cn("space-y-1", className)} {...props}>
        {title && (
          <p className="text-sm text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
        )}
        <div className="flex items-center gap-1 text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-foreground">
          {prefix}
          {formatValue()}
          {suffix}
        </div>
      </div>
    );
  }
);

Statistic.displayName = "Statistic";

export { Statistic };