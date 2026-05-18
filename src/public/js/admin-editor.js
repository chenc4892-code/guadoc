const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const titleField = document.getElementById("title");
const slugField = document.getElementById("slug");
const contentField = document.getElementById("content_html");
const encodedContentField = document.getElementById("content_html_encoded");
const preview = document.getElementById("live-preview");
const editorConfig = window.guadocEditor || {};
let slugEditedManually = Boolean(slugField?.value);
let previewTimer = null;
let previewRequestId = 0;

const encodeBase64Utf8 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
};

if (titleField && slugField) {
  slugField.addEventListener("input", () => {
    slugEditedManually = true;
  });

  titleField.addEventListener("input", () => {
    if (!slugEditedManually) {
      slugField.value = slugify(titleField.value);
    }
  });
}

const paintPreview = (html) => {
  if (!preview) {
    return;
  }

  preview.innerHTML = html;

  if (editorConfig.customCss) {
    let styleTag = document.getElementById("preview-custom-css");

    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "preview-custom-css";
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = editorConfig.customCss;
  }

  preview.querySelectorAll("pre code").forEach((block) => {
    if (window.hljs) {
      window.hljs.highlightElement(block);
    }
  });
};

const renderPreview = (html) => {
  if (!preview) {
    return;
  }

  const requestId = (previewRequestId += 1);
  window.clearTimeout(previewTimer);

  previewTimer = window.setTimeout(async () => {
    try {
      const response = await window.fetch("/admin/preview/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content_html_encoded: encodeBase64Utf8(html),
        }),
      });

      if (!response.ok) {
        throw new Error("Preview request failed.");
      }

      const data = await response.json();

      if (requestId === previewRequestId) {
        paintPreview(data.content_html || html);
      }
    } catch (_error) {
      if (requestId === previewRequestId) {
        paintPreview(html);
      }
    }
  }, 180);
};

if (contentField && !editorConfig.isPage) {
  contentField.value = "";
}

const editorForm = document.querySelector(".editor-form");

if (editorForm && contentField && encodedContentField) {
  editorForm.addEventListener("submit", () => {
    const activeEditor = window.tinymce?.get("wysiwyg");

    if (activeEditor && editorConfig.isPage) {
      contentField.value = activeEditor.getContent();
    }

    encodedContentField.value = encodeBase64Utf8(contentField.value || "");
  });
}

if (contentField && editorConfig.isPage && window.tinymce) {
  window.tinymce.init({
    selector: "#wysiwyg",
    license_key: "gpl",
    height: 620,
    menubar: false,
    branding: false,
    promotion: false,
    plugins: "autolink lists link image table code codesample preview searchreplace visualblocks wordcount autoresize quickbars help",
    toolbar:
      "undo redo | blocks | bold italic underline | forecolor backcolor | bullist numlist blockquote | link image table codesample | alignleft aligncenter alignright | removeformat",
    content_style:
      "body { font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; padding: 1rem; } .callout { padding: 1rem; border-radius: 12px; background: #f4f0fa; }",
    automatic_uploads: true,
    convert_urls: false,
    images_upload_url: "/admin/uploads/image",
    images_reuse_filename: true,
    paste_data_images: false,
    setup: (editor) => {
      const sync = () => {
        const html = editor.getContent();
        contentField.value = html;
        renderPreview(html);
      };

      editor.on("init", sync);
      editor.on("change input undo redo setcontent", sync);
    },
  });

  renderPreview(contentField.value);
}
