import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes while preserving consumer overrides for layout. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
