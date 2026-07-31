import * as React from "react";
import { cn } from "../lib/utils";

const inputClassName =
  "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive md:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputClassName, className)} {...props} />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentPropsWithoutRef<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("min-h-24", inputClassName, className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export { Input, Textarea, inputClassName };
