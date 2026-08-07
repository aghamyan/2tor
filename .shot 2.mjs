import { chromium } from "/Users/aram/Desktop/Projects/2tor/2tor/node_modules/.pnpm/playwright@1.62.0/node_modules/playwright/index.mjs";

const OUT = process.argv[2] ?? "before";
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "820x1180", width: 820, height: 1180 },
  { name: "1024x600", width: 1024, height: 600 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1512x982", width: 1512, height: 982 },
  { name: "2560x1440", width: 2560, height: 1440 },
  { name: "912x1368", width: 912, height: 1368 },



  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
];
const locales = ["en", "hy"];

const browser = await chromium.launch();
const results = [];

for (const locale of locales) {
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await page.goto(`http://localhost:3000/${locale}/home`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const metrics = await page.evaluate((vh) => {
      const q = (sel) => document.querySelector(sel);
      const note = [...document.querySelectorAll("div")].find((el) =>
        el.className && typeof el.className === "string" && el.className.includes("teacherNote"),
      );
      const title = document.getElementById("home-title");
      const accentWord = title?.querySelector("span > span");
      const rule = title?.querySelector("i");
      const noteRect = note?.getBoundingClientRect();
      const wordRect = accentWord?.getBoundingClientRect();
      const ruleRect = rule?.getBoundingClientRect();
      const tags = note ? [...note.querySelectorAll("li")] : [];
      const noteInner = note?.querySelector("ul")?.parentElement;
      return {
        docScrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        noteTop: noteRect ? Math.round(noteRect.top) : null,
        noteBottom: noteRect ? Math.round(noteRect.bottom) : null,
        noteH: noteRect ? Math.round(noteRect.height) : null,
        noteW: noteRect ? Math.round(noteRect.width) : null,
        noteClipped: note ? note.scrollHeight - note.clientHeight : null,
        innerOverflow: noteInner ? noteInner.scrollWidth - noteInner.clientWidth : null,
        tagsOverflow: tags.map((t) => Math.round(t.getBoundingClientRect().right)),
        wordW: wordRect ? +wordRect.width.toFixed(1) : null,
        ruleW: ruleRect ? +ruleRect.width.toFixed(1) : null,
        wordLeft: wordRect ? +wordRect.left.toFixed(1) : null,
        ruleLeft: ruleRect ? +ruleRect.left.toFixed(1) : null,
        vh,
      };
    }, vp.height);

    results.push({ locale, vp: vp.name, ...metrics });
    await page.screenshot({
      path: `/private/tmp/claude-501/-Users-aram-Desktop-Projects-2tor-2tor/64383a11-c9e9-4b96-8ac1-bc7f9ca9866d/scratchpad/${OUT}-${locale}-${vp.name}.png`,
    });
    await page.close();
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 1));
