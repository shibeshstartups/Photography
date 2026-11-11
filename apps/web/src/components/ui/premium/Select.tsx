import { SelectProps, Select as RadixSelect } from "@radix-ui/react-select";
import { forwardRef, ReactNode } from "react";
import { clsx } from "clsx";
import { cn } from "../../lib/utils";
import { ChevronDown, Check } from "lucide-react";

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  noLabel?: boolean;
  children: ReactNode;
}

const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      placeholder = "Select an option...",
      disabled = false,
      noLabel = false,
      children,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);

    return (
      <div className="w-full">
        {!noLabel && label && (
          <label className="block text-sm font-medium text-foreground mb-2">
            {label}
          </label>
        )}
        <RadixSelect.Root {...props}>
          <RadixSelect.Trigger
            ref={ref}
            disabled={disabled}
            className={cn(
              "flex h-12 w-full items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm",
              "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-transparent",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
              error && "border-destructive focus:ring-destructive",
              "border-input hover:border-input/80",
              className
            )}
          >
            <span className={cn(children && typeof children === "object" && children.props && children.props.value ? "" : "text-muted-foreground")}>
              {children}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
          </RadixSelect.Trigger>

          <RadixSelect.Portal>
            <RadixSelect.Content
              className="z-50 max-h-60 overflow-y-auto rounded-xl border bg-popover shadow-lg p-1",
              position="popper"
            >
              <RadixSelect.List className="py-1">
                {children}
              </RadixSelect.List>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
        {error && (
          <p className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

const SelectItem = ({
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof RadixSelect.Item>) => (
  <RadixSelect.Item
    className={cn(
      "flex items-center cursor-default select-none items-center rounded-lg px-3 py-2 text-sm",
      "transition-colors focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "hover:bg-accent hover:text-accent-foreground"
    )}
    {...props}
  >
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    <RadixSelect.ItemIndicator className="ml-auto flex items-center justify-center">
      <Check className="h-4 w-4" />
    </RadixSelect.ItemIndicator>
  </RadixSelect.Item>
);

SelectItem.displayName = "SelectItem";

const SelectLabel = ({
  children,
  ...props
}: React.ComponentProps<typeof RadixSelect.Label>) => (
  <RadixSelect.Label
    className="px-3 py-1.5 text-xs font-semibold text-muted-foreground"
    {...props}
  >
    {children}
  </RadixSelect.Label>
);

SelectLabel.displayName = "SelectLabel";

const SelectSeparator = ({
  ...props
}: React.ComponentProps<typeof RadixSelect.Separator>) => (
  <RadixSelect.Separator
    className="my-1 border-border"
    {...props}
  />
);

SelectSeparator.displayName = "SelectSeparator";

export { Select, SelectItem, SelectLabel, SelectSeparator };