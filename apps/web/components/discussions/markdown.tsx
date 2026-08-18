import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "katex/dist/katex.min.css";
import styles from "./markdown.module.css";

/**
 * Extends the default (GitHub-style) sanitize schema with only the two class names
 * `remark-math`/`remark-rehype` emit for un-rendered math spans/divs (`language-math
 * math-inline`/`language-math math-display`) — see `mdast-util-math`'s `toHast` handlers. Nothing
 * else is loosened. `rehype-katex` runs *after* this in the pipeline below, so its own generated
 * markup (MathML, KaTeX's many span classes) never has to pass through the sanitizer at all — it
 * only ever processes the math nodes this schema let through, then the finished, trusted output is
 * what actually reaches the page.
 */
const mathSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), ["className", "language-math", "math-display"]],
    span: [["className", "language-math", "math-inline"]],
  },
};

export function DiscussionMarkdown({ body }: { body: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeSanitize, mathSanitizeSchema], rehypeKatex]}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
