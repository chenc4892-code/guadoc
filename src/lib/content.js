const path = require("path");
const hljs = require("highlight.js");
const slugify = require("slugify");
const sanitizeHtml = require("sanitize-html");
const { parse } = require("node-html-parser");

const escapeHtml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtmlToText = (html = "") => parse(html).textContent.replace(/\u00a0/g, " ");

const cleanHtml = (html = "") =>
  sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "blockquote",
      "pre",
      "code",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "u",
      "s",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
      "br",
      "span",
      "div",
      "figure",
      "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["class", "id", "style"],
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        width: [/^.*$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: "lazy",
        },
      }),
    },
  });

const looksLikeCode = (text = "") => {
  const normalized = text.trim();

  if (!normalized) {
    return false;
  }

  if (normalized.includes("```")) {
    return true;
  }

  const codeSignals = [
    /(^|\n)\s{2,}\S/,
    /(^|\n)[#>*-]\s+\S/,
    /[{};=<>()]/,
    /\b(const|let|var|function|class|import|export|SELECT|INSERT|UPDATE|DELETE|curl|docker|npm|git)\b/i,
    /https?:\/\//i,
  ];

  return codeSignals.some((pattern) => pattern.test(normalized));
};

const addHeadingAnchors = (root) => {
  const headings = root.querySelectorAll("h1, h2, h3, h4");

  headings.forEach((heading, index) => {
    const baseId = slugFromValue(heading.textContent, `section-${index + 1}`);
    if (!heading.getAttribute("id")) {
      heading.setAttribute("id", baseId);
    }
  });
};

const highlightSource = (sourceCode, language = "") => {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(sourceCode, {
      language,
      ignoreIllegals: true,
    });
  }

  return hljs.highlightAuto(sourceCode);
};

const normalizePreBlocksInHtml = (html = "") =>
  html.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_match, innerHtml) => {
    const codeMatch = innerHtml.match(/<code\b([^>]*)>([\s\S]*?)<\/code>/i);

    if (codeMatch) {
      const attrs = codeMatch[1] || "";
      const classMatch = attrs.match(/class=(["'])(.*?)\1/i);
      const existingClasses = classMatch ? classMatch[2].split(/\s+/).filter(Boolean) : [];
      const languageClass = existingClasses.find((name) => name.startsWith("language-"));
      const language = languageClass ? languageClass.slice("language-".length) : "";
      const sourceCode = stripHtmlToText(codeMatch[2]).trimEnd();
      const highlighted = highlightSource(sourceCode, language);
      const nextClasses = new Set(existingClasses);

      nextClasses.add("hljs");
      if (language) {
        nextClasses.add(`language-${language}`);
      } else if (highlighted.language) {
        nextClasses.add(`language-${highlighted.language}`);
      }

      return `<pre><code class="${escapeHtml(Array.from(nextClasses).join(" "))}">${highlighted.value}</code></pre>`;
    }

    const text = stripHtmlToText(innerHtml).trim();

    if (!text) {
      return "";
    }

    if (looksLikeCode(text)) {
      const highlighted = highlightSource(text);
      const languageClass = highlighted.language ? ` language-${highlighted.language}` : "";
      return `<pre><code class="hljs${languageClass}">${highlighted.value}</code></pre>`;
    }

    return text
      .split(/\n{2,}/)
      .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, "<br>")}</p>`)
      .join("");
  });

const renderContentHtml = (html = "") => {
  const normalizedHtml = normalizePreBlocksInHtml(cleanHtml(html));
  const root = parse(normalizedHtml);
  addHeadingAnchors(root);
  return root.toString();
};

const slugFromValue = (value, fallback = "item") => {
  const source = (value || "").trim();
  const asciiSlug = slugify(source, {
    lower: true,
    strict: true,
    trim: true,
  });

  if (asciiSlug) {
    return asciiSlug;
  }

  const unicodeSlug = source
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return unicodeSlug || fallback;
};

const plainTextFromHtml = (html = "") => {
  const root = parse(cleanHtml(html));
  return root.textContent.replace(/\s+/g, " ").trim();
};

const excerptFromHtml = (html = "", maxLength = 180) => {
  const text = plainTextFromHtml(html);

  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
};

const buildToc = (html = "") => {
  const root = parse(html);
  const headings = root.querySelectorAll("h1, h2, h3, h4");

  return headings.map((heading, index) => {
    const baseId = slugFromValue(heading.textContent, `section-${index + 1}`);
    const anchorId = heading.getAttribute("id") || baseId;

    heading.setAttribute("id", anchorId);

    return {
      id: anchorId,
      level: Number(heading.tagName.slice(1)),
      text: heading.textContent.trim(),
    };
  });
};

const relativeUploadPath = (filename) => path.posix.join("/uploads", filename);

module.exports = {
  buildToc,
  cleanHtml,
  excerptFromHtml,
  plainTextFromHtml,
  relativeUploadPath,
  renderContentHtml,
  slugFromValue,
};
