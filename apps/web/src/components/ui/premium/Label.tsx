import { LabelProps, Label as RadixLabel } from "@radix-ui/react-label";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <RadixLabel
      ref={ref}
      className={cn(
        "text-sm font-medium text-foreground",
        "not-[empty]:text-sm",
        className
      )}
      {...props}
    />
  )
);

Label.displayName = "Label";

export { Label };