import { Noto_Sans_Armenian, Noto_Serif_Armenian } from "next/font/google";

export const learningDisplayFont = Noto_Serif_Armenian({
  subsets: ["armenian", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--learning-font-display",
});

export const learningBodyFont = Noto_Sans_Armenian({
  subsets: ["armenian", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--learning-font-body",
});
