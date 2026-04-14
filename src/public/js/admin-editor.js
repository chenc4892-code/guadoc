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
const preview = document.getElementById("live-preview");
const editorConfig = window.guadocEditor || {};
let slugEditedManually = Boolean(slugField?.value);

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

const renderPreview = (html) => {
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

if (contentField && !editorConfig.isPage) {
  contentField.value = "";
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
