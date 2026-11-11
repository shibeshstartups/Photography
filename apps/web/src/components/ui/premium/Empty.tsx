import { forwardRef, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { Search, Folder, FileText, AlertCircle } from "lucide-react";

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: "default" | "search" | "folder" | "file" | "alert";
}

const icons = {
  default: Search,
  search: Search,
  folder: Folder,
  file: FileText,
  alert: AlertCircle,
};

const Empty = forwardRef<HTMLDivElement, EmptyProps>(
  (
    {
      className,
      title = "Nothing found",
      description = "Try adjusting your search or filter settings",
      icon = "search",
      ...props
    },
    ref
  ) => {
    const Icon = icons[icon];

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center p-8 text-center space-y-3",
          className
        )}
        {...props}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {description}
        </p>
      </div>
    );
  }
);

Empty.displayName = "Empty";

export { Empty };