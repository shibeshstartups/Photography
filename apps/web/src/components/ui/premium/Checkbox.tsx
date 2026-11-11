import * as React from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultChecked"> {
  indeterminate?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, checked, ...props }, ref) => {
    const [checkedState, setCheckedState] = React.useState<boolean>(false);
    const isControlled = checked !== undefined;
    const currentChecked = isControlled ? checked : checkedState;
    const checkboxRef = React.useRef<HTMLInputElement>(null);

    // Handle indeterminate state
    React.useEffect(() => {
      const node = checkboxRef.current;
      if (!node) return;
      node.indeterminate = indeterminate ?? false;
    }, [indeterminate]);

    const handleCheckedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isControlled) {
        props.onChange?.(event);
      } else {
        setCheckedState(event.target.checked);
      }
    };

    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="checkbox"
            ref={(node) => {
              if (typeof ref === "function") ref(node);
              checkboxRef.current = node;
            }}
            checked={currentChecked}
            onChange={handleCheckedChange}
            className={cn(
              "peer h-4 w-4 shrink-0 rounded-sm border border-input",
              "bg-background transition-colors duration-200",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
              "hover:bg-primary/10 data-[state=checked]:hover:bg-primary/90",
              className
            )}
            {...props}
          />
          <Check
            className={cn(
              "absolute left-0.5 top-0.5 h-3 w-3 text-white",
              "transition-opacity duration-200",
              "opacity-0",
              "peer-[:checked]:opacity-100"
            )}
          />
        </div>
        {props.children}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };