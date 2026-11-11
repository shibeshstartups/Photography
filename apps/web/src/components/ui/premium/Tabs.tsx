import * as React from "react";
import { forwardRef, useId, createContext, useContext } from "react";
import { cn } from "../../lib/utils";

const TabsContext = createContext<{
  value: string;
  setValue: (value: string) => void;
  id: string;
} | null>(null);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      className,
      value,
      defaultValue,
      onValueChange,
      orientation = "horizontal",
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState<string>(
      defaultValue ?? ""
    );
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;
    const id = useId();

    const setValue = React.useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setInternalValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [isControlled, onValueChange]
    );

    return (
      <TabsContext.Provider value={{ value: currentValue, setValue, id }}>
        <div
          ref={ref}
          className={cn(
            "flex",
            orientation === "vertical" ? "flex-row" : "flex-col",
            className
          )}
          {...props}
        />
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

const TabsList = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsList must be used within Tabs");

  return (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        "h-9",
        className
      )}
      {...props}
    />
  );
});
TabsList.displayName = "TabsList";

const TabsTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const value = props.value as string;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={context.value === value}
      aria-controls={`${context.id}-panel-${value}`}
      id={`${context.id}-tab-${value}`}
      onClick={() => context.setValue(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        context.value === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  const value = props.value as string;
  if (context.value !== value) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      aria-labelledby={`${context.id}-tab-${value}`}
      id={`${context.id}-panel-${value}`}
      className={cn("mt-2 ring-offset-background", className)}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };