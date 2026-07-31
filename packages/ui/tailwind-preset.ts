import type { Config } from "tailwindcss";

const semantic = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

/** Import this preset after loading `@app/ui/src/theme/tokens.css`. */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        background: semantic("background"),
        foreground: semantic("foreground"),
        card: { DEFAULT: semantic("card"), foreground: semantic("card-foreground") },
        popover: { DEFAULT: semantic("popover"), foreground: semantic("popover-foreground") },
        primary: { DEFAULT: semantic("primary"), foreground: semantic("primary-foreground") },
        secondary: { DEFAULT: semantic("secondary"), foreground: semantic("secondary-foreground") },
        muted: { DEFAULT: semantic("muted"), foreground: semantic("muted-foreground") },
        accent: { DEFAULT: semantic("accent"), foreground: semantic("accent-foreground") },
        destructive: {
          DEFAULT: semantic("destructive"),
          foreground: semantic("destructive-foreground"),
        },
        success: { DEFAULT: semantic("success"), foreground: semantic("success-foreground") },
        warning: { DEFAULT: semantic("warning"), foreground: semantic("warning-foreground") },
        border: semantic("border"),
        input: semantic("input"),
        ring: semantic("ring"),
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: { sans: ["var(--font-sans)"], mono: ["var(--font-mono)"] },
      keyframes: {
        "ui-in": {
          from: { opacity: "0", transform: "translateY(0.25rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { "ui-in": "ui-in 160ms ease-out" },
    },
  },
};

export default preset;
