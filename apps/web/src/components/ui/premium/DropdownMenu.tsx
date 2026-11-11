import * as React from "react";
import { forwardRef, useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { ChevronDown } from "lucide-react";

export interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
  destructive?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: "start" | "end";
  className?: string;
}

const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ trigger, items, align = "end", className }, ref) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
      <div ref={containerRef} className="relative inline-block">
        <div onClick={() => setOpen(!open)}>{trigger}</div>
        {open && (
          <div
            ref={ref}
            className={cn(
              "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-lg border bg-background p-1 shadow-lg",
              "animate-in fade-in-0 zoom-in-95",
              align === "end" ? "right-0" : "left-0",
              className
            )}
          >
            {items.map((item, index) =>
              item.separator ? (
                <div
                  key={index}
                  className="my-1 h-px bg-border"
                />
              ) : (
                <button
                  key={index}
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick?.();
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    "hover:bg-muted focus:bg-muted focus:outline-none",
                    "disabled:pointer-events-none disabled:opacity-50",
                    item.destructive && "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                  )}
                >
                  {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              )
            )}
          </div>
        )}
      </div>
    );
  }
);

DropdownMenu.displayName = "DropdownMenu";

export { DropdownMenu };