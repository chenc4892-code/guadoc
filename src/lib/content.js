const path = require("path");
const slugify = require("slugify");
const sanitizeHtml = require("sanitize-html");
const { parse } = require("node-html-parser");

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
        color: [/^.*$/],
        "background-color": [/^.*$/],
        "text-align": [/^(left|right|center|justify)$/],
        "font-size": [/^.*$/],
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

const slugFromValue = (value, fallback = "item") => {
  const source = (value || "").trim();
  const normalized = slugify(source, {
    lower: true,
    strict: true,
    trim: true,
  });

  return normalized || fallback;
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

const withHeadingAnchors = (html = "") => {
  const root = parse(html);
  const headings = root.querySelectorAll("h1, h2, h3, h4");

  headings.forEach((heading, index) => {
    const baseId = slugFromValue(heading.textContent, `section-${index + 1}`);
    if (!heading.getAttribute("id")) {
      heading.setAttribute("id", baseId);
    }
  });

  return root.toString();
};

const relativeUploadPath = (filename) => path.posix.join("/uploads", filename);

module.exports = {
  buildToc,
  cleanHtml,
  excerptFromHtml,
  plainTextFromHtml,
  relativeUploadPath,
  slugFromValue,
  withHeadingAnchors,
};
