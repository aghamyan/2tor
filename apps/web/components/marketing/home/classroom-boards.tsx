"use client";

import { motion } from "framer-motion";
import styles from "./compact-home.module.css";

/**
 * The four whiteboard artworks behind the rotating hero lesson card.
 *
 * Each one is drawn, not photographed and not a screenshot of a real product surface — the same
 * rule the rest of this page follows. They share one visual language: strokes that draw themselves
 * in sequence, as if a tutor were writing on the board while you watch.
 *
 * `delay` is scaled by the caller. On first paint the card is part of a longer entrance
 * choreography and the strokes take their time; on a rotation the same drawing has to land in
 * about half a second, or the board is still being written when the next subject arrives.
 */

const ease = [0.22, 1, 0.36, 1] as const;

export type BoardKey = "math" | "programming" | "armenian" | "chess";

interface BoardProps {
  reduceMotion: boolean | null;
  /** Multiplies every stroke delay. 1 on first paint, ~0.42 when rotating. */
  pace: number;
}

function draw(reduceMotion: boolean | null, duration: number, delay: number, pace: number) {
  return reduceMotion ? { duration: 0 } : { duration: duration * pace, delay: delay * pace, ease };
}

/** Mathematics: `x + 3 = 8`, underlined the way a tutor underlines the thing to solve. */
export function MathBoard({ reduceMotion, pace }: BoardProps) {
  return (
    <svg className={styles.equation} viewBox="0 0 390 176" aria-hidden="true">
      <motion.path
        d="M35 58 L70 102 M70 58 L35 102"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw(reduceMotion, 0.55, 0.45, pace)}
      />
      <motion.path
        d="M96 80 L130 80 M113 63 L113 97"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw(reduceMotion, 0.8, 0.68, pace)}
      />
      <motion.path
        d="M157 63 C174 54 193 59 193 72 C193 81 184 85 173 85 C186 85 196 91 196 102 C196 117 176 121 157 112"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw(reduceMotion, 0.8, 0.9, pace)}
      />
      <motion.path
        d="M222 74 L255 74 M222 96 L255 96"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw(reduceMotion, 0.75, 1.1, pace)}
      />
      <motion.path
        d="M304 84 C286 77 287 57 304 56 C321 57 321 77 304 84 C285 91 286 114 304 116 C323 114 323 91 304 84"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw(reduceMotion, 0.8, 1.32, pace)}
      />
      <motion.path
        className={styles.answerStroke}
        d="M40 132 C104 148 193 151 354 128"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw(reduceMotion, 0.9, 1.45, pace)}
      />
    </svg>
  );
}

/**
 * Programming: a loop taking shape on the board, written line by line.
 *
 * Deliberately NOT legible source code. At this size real syntax would be either unreadable or so
 * large it stops looking like a screen, and it would need translating for `hy` — a whiteboard is
 * the one surface on this page where the shape of the thing communicates better than its text. So
 * the lines are drawn strokes whose LENGTH and INDENTATION carry the meaning: a header, an indented
 * body, a closing line, with the braces written as real characters either side.
 *
 * Same grammar as the other three: strokes draw themselves left to right, in the order a person
 * writes them, and exactly one stroke is accented — here the loop body, which is the line the
 * lesson is actually about.
 */
export function ProgrammingBoard({ reduceMotion, pace }: BoardProps) {
  /*
   * x-start, x-end, y. Indentation is the whole point, so these are authored, not generated.
   * Three code lines and a fourth row that holds only the closing brace — the brace IS that line,
   * which is why there is no stroke at y=152.
   */
  const lines = [
    { from: 96, to: 244, y: 46, accent: false },
    { from: 126, to: 300, y: 84, accent: true },
    { from: 126, to: 232, y: 118, accent: false },
  ];
  const gutter = [46, 84, 118, 152];
  return (
    <svg className={styles.codeBoard} viewBox="0 0 390 190" aria-hidden="true">
      {/* Gutter ticks — the line numbers of an editor, reduced to marks. */}
      {gutter.map((y, index) => (
        <motion.circle
          key={`tick-${y}`}
          className={styles.codeTick}
          cx={70}
          cy={y}
          r={3.2}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={draw(reduceMotion, 0.3, 0.28 + index * 0.1, pace)}
        />
      ))}

      {lines.map((line, index) => (
        <motion.path
          key={`line-${line.y}`}
          className={line.accent ? styles.codeLineAccent : styles.codeLine}
          d={`M${line.from} ${line.y} L${line.to} ${line.y}`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={draw(reduceMotion, 0.5, 0.4 + index * 0.22, pace)}
        />
      ))}

      {/*
        The braces. `{` sits just past the end of the header stroke, `}` occupies the last gutter
        row on its own — the block opening and closing where they actually would.

        Only `opacity` is animated. framer treats `x`/`y` on SVG children as ATTRIBUTES, so
        animating `y` here would fight the positioning attribute of the same name rather than
        translating the glyph.
      */}
      <motion.text
        className={styles.codeBrace}
        x={258}
        y={58}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={draw(reduceMotion, 0.4, 0.62, pace)}
      >
        {"{"}
      </motion.text>
      <motion.text
        className={styles.codeBrace}
        x={96}
        y={164}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={draw(reduceMotion, 0.4, 1.3, pace)}
      >
        {"}"}
      </motion.text>

      {/*
        The caret. The one looping animation on this board, and it only runs once the lines are
        written — a cursor blinking over an empty board reads as a bug. Reduced motion gets a
        static caret rather than none, since it marks where the writing stopped.
      */}
      <motion.rect
        className={styles.codeCaret}
        x={306}
        y={74}
        width={3}
        height={20}
        rx={1.5}
        initial={{ opacity: 0 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 0, 0, 1] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 2.2, delay: 1.15 * pace, repeat: Infinity, ease: "linear" }
        }
      />
    </svg>
  );
}

/**
 * Armenian: the word բարև ("hello") written letter by letter, then underlined.
 *
 * Set as real text rather than traced as paths. Armenian letterforms carry diacritics and
 * ligature-like joins that hand-drawn béziers get subtly wrong, and getting them wrong in the
 * script the brand is named in is worse than not animating the strokes. The letters are staggered
 * so it still reads as writing rather than as a label appearing.
 */
export function ArmenianBoard({ reduceMotion, pace }: BoardProps) {
  const letters = ["բ", "ա", "ր", "և"];
  return (
    <div className={styles.boardWord} aria-hidden="true">
      <div className={styles.boardWordRow} lang="hy">
        {letters.map((letter, index) => (
          <motion.span
            key={letter}
            initial={{ opacity: 0, y: 16, rotate: -4 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={draw(reduceMotion, 0.5, 0.45 + index * 0.16, pace)}
          >
            {letter}
          </motion.span>
        ))}
      </div>
      <svg className={styles.boardWordRule} viewBox="0 0 390 24" aria-hidden="true">
        <motion.path
          className={styles.answerStroke}
          d="M18 12 C96 21 214 22 372 9"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={draw(reduceMotion, 0.9, 1.25, pace)}
        />
      </svg>
    </div>
  );
}

/**
 * Chess: a knight and the L it can travel, drawn as an arrow onto a four-square board fragment.
 *
 * The knight is an SVG path, not the `♞` codepoint. Unicode chess pieces depend entirely on a
 * symbol font being installed, and the failure mode is a tofu box in the hero of the marketing
 * site. A traced silhouette renders identically everywhere and matches the drawn-stroke motif.
 */
export function ChessBoard({ reduceMotion, pace }: BoardProps) {
  // The dark squares of a 4x4 board fragment, in the SVG's own coordinate space.
  const dark = [
    { column: 0, row: 0 },
    { column: 2, row: 0 },
    { column: 1, row: 1 },
    { column: 3, row: 1 },
    { column: 0, row: 2 },
    { column: 2, row: 2 },
    { column: 1, row: 3 },
    { column: 3, row: 3 },
  ];
  const cell = 42;
  // Centred in the 390x190 viewBox: (390 - 168) / 2 and (190 - 168) / 2.
  const originX = 111;
  const originY = 11;
  const knightColumn = 1;
  const knightRow = 3;
  return (
    <svg className={styles.chessBoard} viewBox="0 0 390 190" aria-hidden="true">
      <g>
        {dark.map(({ column, row }) => (
          <motion.rect
            key={`${column}-${row}`}
            x={originX + column * cell}
            y={originY + row * cell}
            width={cell}
            height={cell}
            className={styles.chessSquareDark}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={draw(reduceMotion, 0.4, 0.3 + (column + row) * 0.05, pace)}
          />
        ))}
        <motion.rect
          x={originX}
          y={originY}
          width={cell * 4}
          height={cell * 4}
          className={styles.chessFrame}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={draw(reduceMotion, 0.7, 0.25, pace)}
        />
      </g>

      {/*
        The knight. This is the standard open-licence chess knight outline (the one the Wikipedia
        piece set uses), authored in a 45x45 box and scaled to sit inside one 42px square. An
        earlier hand-drawn silhouette read as a pawn-shaped blob — a knight's notch, muzzle and ear
        are exactly the details a freehand bézier loses.
      */}
      {/*
        Placement lives on a plain outer <g> and the animation on an inner <motion.g>. They cannot
        share an element: framer-motion writes its own `transform` for any animated x/y, which
        silently overwrites a `transform` attribute set alongside it — that bug put the knight
        outside the board entirely. The entrance is opacity-only for the same reason.
      */}
      <g
        transform={`translate(${originX + knightColumn * cell + 4} ${originY + knightRow * cell + 4}) scale(${34 / 45})`}
      >
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={draw(reduceMotion, 0.5, 0.75, pace)}
        >
          <path
            className={styles.chessKnight}
            d="M22 10C32.5 11 38.5 18 38 39L15 39C15 30 25 32.5 23 18"
          />
          <path
            className={styles.chessKnight}
            d="M24 18C24.38 20.91 18.45 25.37 16 27C13 29 13.18 31.34 11 31C9.958 30.06 12.41 27.96 11 28C10 28 11.19 29.23 10 30C9 30 6 31 6 26C6 24 12 14 12 14C12 14 13.89 12.1 14 10.5C13.27 9.506 13.5 8.5 13.5 7.5C14.5 6.5 16.5 10 16.5 10L18.5 10C18.5 10 19.28 8.008 21 7C22 7 22 10 22 10"
          />
        </motion.g>
      </g>

      {/* The L: two squares up, one across. Drawn last, the way a coach annotates a position. */}
      <motion.path
        className={styles.chessMove}
        d={`M${originX + 1.5 * cell} ${originY + 3.5 * cell - 22} L${originX + 1.5 * cell} ${originY + 1.5 * cell} L${originX + 2.5 * cell - 22} ${originY + 1.5 * cell}`}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw(reduceMotion, 0.75, 1.2, pace)}
      />
      <motion.path
        className={styles.chessMove}
        d={`M${originX + 2.5 * cell - 30} ${originY + 1.5 * cell - 8} L${originX + 2.5 * cell - 20} ${originY + 1.5 * cell} L${originX + 2.5 * cell - 30} ${originY + 1.5 * cell + 8}`}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw(reduceMotion, 0.35, 1.75, pace)}
      />
      <motion.circle
        className={styles.chessTarget}
        cx={originX + cell * 2.5}
        cy={originY + cell * 1.5}
        r="15"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={draw(reduceMotion, 0.45, 1.95, pace)}
      />
    </svg>
  );
}

export function ClassroomBoard({ subject, ...props }: BoardProps & { subject: BoardKey }) {
  if (subject === "armenian") return <ArmenianBoard {...props} />;
  if (subject === "chess") return <ChessBoard {...props} />;
  if (subject === "programming") return <ProgrammingBoard {...props} />;
  return <MathBoard {...props} />;
}
