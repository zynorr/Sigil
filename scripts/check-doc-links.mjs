import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const extensions = new Set([".md", ".html"]);
const ignored = new Set(["node_modules", ".git", "dist", "coverage"]);
const problems = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && !ignored.has(entry.name)) {
      files.push(...(await walk(path.join(directory, entry.name))));
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function headingAnchors(markdown) {
  const anchors = new Set();
  const counts = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = match[1]
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

const files = await walk(root);
const contents = new Map();
for (const file of files) contents.set(file, await readFile(file, "utf8"));

// Supports inline Markdown links/images and HTML src/href references. Links
// inside fenced code are intentionally not parsed as real links.
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
const htmlReference = /(?:src|href)=["']([^"']+)["']/gi;
for (const file of files) {
  const source = contents.get(file);
  const lines = source.split(/\r?\n/);
  let fenced = false;
  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    const references = [
      ...Array.from(line.matchAll(markdownLink), (match) => match[1].trim()),
      ...Array.from(line.matchAll(htmlReference), (match) => match[1].trim()),
    ];
    for (const raw of references) {
      if (!raw || /^(?:https?:|mailto:|data:|javascript:)/i.test(raw)) continue;
      // Site-root paths in the Vite HTML entry are runtime URLs, not repository-relative docs.
      if (raw.startsWith("/")) continue;
      const [pathPart, fragmentPart] = raw.split("#", 2);
      const target = (pathPart ?? "").split("?", 1)[0];
      const resolved = target
        ? path.resolve(path.dirname(file), decodeURIComponent(target))
        : file;
      try {
        const targetStat = await stat(resolved);
        if (targetStat.isDirectory()) continue;
        if (fragmentPart && path.extname(resolved).toLowerCase() === ".md") {
          const targetText =
            contents.get(resolved) ?? (await readFile(resolved, "utf8"));
          const fragment = decodeURIComponent(fragmentPart).toLowerCase();
          if (!headingAnchors(targetText).has(fragment)) {
            problems.push(
              `${path.relative(root, file)}:${lineNumber}: missing anchor "#${fragmentPart}" in ${path.relative(root, resolved)}`,
            );
          }
        }
      } catch {
        problems.push(
          `${path.relative(root, file)}:${lineNumber}: broken local reference "${raw}"`,
        );
      }
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Documentation links and image references OK (${files.length} Markdown/HTML files scanned).`,
  );
}
