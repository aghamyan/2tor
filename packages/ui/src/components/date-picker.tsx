import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "../lib/utils";
import { Input } from "./input";

function isDateValue(value: string | Date | undefined): value is Date {
  return value instanceof Date;
}
function toDateInputValue(value: string | Date | undefined) {
  return isDateValue(value) ? value.toISOString().slice(0, 10) : (value ?? "");
}
export function formatDateInTimeZone(
  value: string | Date,
  timeZone: string,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions,
) {
  const date = isDateValue(value) ? value : new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone, ...options }).format(
    date,
  );
}
interface DatePickerProps extends Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type" | "value" | "defaultValue" | "onChange"
> {
  value?: string | Date;
  defaultValue?: string | Date;
  onValueChange?: (value: string) => void;
  timeZone: string;
  locale?: string | string[];
  displayOptions?: Intl.DateTimeFormatOptions;
  displayLabel: (formattedDate: string) => string;
}
const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      className,
      value,
      defaultValue,
      onValueChange,
      timeZone,
      locale,
      displayOptions,
      displayLabel,
      ...props
    },
    ref,
  ) => {
    const currentValue = toDateInputValue(value ?? defaultValue);
    const formatted = currentValue
      ? formatDateInTimeZone(currentValue, timeZone, locale, displayOptions)
      : undefined;
    return (
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Input
            ref={ref}
            type="date"
            value={value === undefined ? undefined : toDateInputValue(value)}
            defaultValue={value === undefined ? toDateInputValue(defaultValue) : undefined}
            onChange={(event) =>
              onValueChange?.((event.currentTarget as unknown as { value: string }).value)
            }
            className={cn("pr-10", className)}
            {...props}
          />
          <CalendarDays
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        {formatted ? (
          <output className="text-sm text-muted-foreground" aria-live="polite">
            {displayLabel(formatted)}
          </output>
        ) : null}
      </div>
    );
  },
);
DatePicker.displayName = "DatePicker";
export { DatePicker };
