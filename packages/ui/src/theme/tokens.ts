/** Semantic token names intended for documentation and non-Tailwind consumers. */
export const tokens = {
  color: {
    background: "hsl(var(--background))",
    foreground: "hsl(var(--foreground))",
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
    destructive: "hsl(var(--destructive))",
    success: "hsl(var(--success))",
    warning: "hsl(var(--warning))",
  },
  font: {
    sans: "var(--font-sans)",
    mono: "var(--font-mono)",
  },
  radius: "var(--radius)",
} as const;
