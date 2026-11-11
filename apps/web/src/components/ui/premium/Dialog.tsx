import * as React from "react";
import { forwardRef, useId } from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

const DialogContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  titleId: string;
  descriptionId: string;
} | null>(null);

const Dialog = ({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const isOpen = open !== undefined ? open : internalOpen;
  const setOpen = React.useCallback(
    (open: boolean) => {
      if (open !== isOpen) {
        if (open !== undefined) {
          onOpenChange?.(open);
        } else {
          setInternalOpen(open);
        }
      }
    },
    [isOpen, onOpenChange]
  );

  const titleId = useId();
  const descriptionId = useId();

  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen, titleId, descriptionId }}>
      {children}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onPointerDownCapture={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-50 mx-auto mt-0 w-full max-w-lg">
            <DialogContent />
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof React.button>,
  React.ComponentPropsWithoutRef<typeof React.button> & { asChild?: boolean }
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("DialogTrigger must be used within a Dialog");
  }

  return (
    <React.button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      onClick={() => context.setOpen(true)}
      {...props}
    >
      {children}
    </React.button>
  );
});
DialogTrigger.displayName = "DialogTrigger";

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("DialogContent must be used within a Dialog");
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col space-y-4 rounded-xl bg-background p-6 shadow-lg",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end space-x-2",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("DialogTitle must be used within a Dialog");
  }

  return (
    <h2
      ref={ref}
      id={context.titleId}
      aria-describedby={context.descriptionId}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
});
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("DialogDescription must be used within a Dialog");
  }

  return (
    <p
      ref={ref}
      id={context.descriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
});
DialogDescription.displayName = "DialogDescription";

const DialogClose = React.forwardRef<
  React.ElementRef<typeof React.button>,
  React.ComponentPropsWithoutRef<typeof React.button>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("DialogClose must be used within a Dialog");
  }

  return (
    <button
      ref={ref}
      className={cn(
        "absolute right-3 top-3 rounded-sm p-1 opacity-70 transition-opacity",
        "hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2",
        "focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
        className
      )}
      onClick={() => context.setOpen(false)}
      {...props}
    >
      {children || <X className="h-4 w-4" />}
    </button>
  );
});
DialogClose.displayName = "DialogClose";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};