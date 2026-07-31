import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../lib/utils";

/**
 * Semantic form building blocks. Inputs receive react-hook-form's `register()`
 * return value directly, and Zod-derived error text is rendered by FormMessage.
 */
const Form = React.forwardRef<HTMLFormElement, React.ComponentPropsWithoutRef<"form">>(
  ({ className, ...props }, ref) => (
    <form ref={ref} className={cn("flex flex-col gap-5", className)} {...props} />
  ),
);
Form.displayName = "Form";
const FieldGroup = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-5", className)} {...props} />
  ),
);
FieldGroup.displayName = "FieldGroup";
const Field = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props} />
  ),
);
Field.displayName = "Field";
const FieldLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
));
FieldLabel.displayName = "FieldLabel";
const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p">
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
FieldDescription.displayName = "FieldDescription";
const FieldMessage = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<"p">>(
  ({ className, role = "alert", ...props }, ref) => (
    <p
      ref={ref}
      role={role}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    />
  ),
);
FieldMessage.displayName = "FieldMessage";
const FieldSet = React.forwardRef<HTMLFieldSetElement, React.ComponentPropsWithoutRef<"fieldset">>(
  ({ className, ...props }, ref) => (
    <fieldset ref={ref} className={cn("flex flex-col gap-3", className)} {...props} />
  ),
);
FieldSet.displayName = "FieldSet";
const FieldLegend = React.forwardRef<HTMLLegendElement, React.ComponentPropsWithoutRef<"legend">>(
  ({ className, ...props }, ref) => (
    <legend ref={ref} className={cn("mb-2 text-sm font-medium", className)} {...props} />
  ),
);
FieldLegend.displayName = "FieldLegend";

export {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldMessage,
  FieldSet,
  Form,
};
