import { useForm, UseFormProps, UseFormReturn, FieldValues, FormProvider } from "react-hook-form";
import { HTMLAttributes, forwardRef, ReactNode } from "react";
import { clsx } from "clsx";

export interface FormProps<T extends FieldValues> extends UseFormProps<T> {
  children: ReactNode;
  onSubmit?: (values: T) => void;
}

export function Form<T extends FieldValues>({
  children,
  onSubmit,
  ...props
}: FormProps<T>) {
  const form = useForm<T>(props);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.handleSubmit(onSubmit)();
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {children}
      </form>
    </FormProvider>
  );
}

export interface FormFieldProps<T extends FieldValues> {
  name: string;
  render: (field: UseFormReturn<T>["getFieldState"](string) & {
    value: any;
    onChange: (value: any) => void;
    onBlur: () => void;
    ref: React.Ref<any>
  }) => ReactNode;
}

export function FormField<T extends FieldValues>({ name, render }: FormFieldProps<T>) {
  const form = useForm<T>();
  const fieldState = form.getFieldState(name);

  return render({
    ...fieldState,
    value: fieldState.value,
    onChange: (value: any) => form.setValue(name, value, { shouldValidate: true }),
    onBlur: () => form.trigger(name),
    ref: form.register(name).ref,
  });
}

export interface FormItemProps extends HTMLAttributes<HTMLDivElement> {}

const FormItem = forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={clsx("space-y-2", className)} {...props} />
  )
);
FormItem.displayName = "FormItem";

export interface FormLabelProps extends HTMLAttributes<HTMLLabelElement> {}

const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={clsx("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
  )
);
FormLabel.displayName = "FormLabel";

export interface FormControlProps extends HTMLAttributes<HTMLDivElement> {}

const FormControl = forwardRef<HTMLDivElement, FormControlProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={clsx("", className)} {...props} />
  )
);
FormControl.displayName = "FormControl";

export interface FormDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

const FormDescription = forwardRef<HTMLParagraphElement, FormDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={clsx("text-sm text-muted-foreground", className)} {...props} />
  )
);
FormDescription.displayName = "FormDescription";

export interface FormMessageProps extends HTMLAttributes<HTMLParagraphElement> {}

const FormMessage = forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={clsx("text-sm font-medium text-destructive", className)} {...props}>
      {children}
    </p>
  )
);
FormMessage.displayName = "FormMessage";

export { FormItem, FormLabel, FormControl, FormDescription, FormMessage };