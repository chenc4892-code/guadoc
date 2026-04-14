# Development Log

## 2026-04-14

- Bootstrapped the Guadoc application from an empty repository.
- Built a Node.js and SQLite documentation platform with server-rendered public and admin interfaces.
- Added local admin authentication with persistent session tokens.
- Implemented a browser-based rich text editor with live preview and local image uploads.
- Implemented automatic navigation, full-text search, page table of contents, and previous or next navigation.
- Added drag-and-drop ordering for groups and pages in the admin dashboard.
- Added site settings for branding, custom CSS, and credential rotation.
- Added Docker Compose deployment files, persistent data storage, and project documentation.
- Added focused automated tests for content and navigation utilities plus manual HTTP smoke verification.
- Changed the default service port from `3000` to `3210` to avoid a local port conflict.
- Added the TinyMCE GPL license configuration required for self-hosted editor initialization.
- Switched Docker Compose deployment settings to environment-variable driven configuration so the real admin password can stay out of Git.
- Fixed the container metadata to expose port `3210` instead of the old `3000` value.
- Improved page slug generation to support Chinese titles and automatically avoid sibling slug collisions.
- Rebalanced the public page layout so the documentation content sits more centrally between the sidebar and the table of contents.
- Added a configurable documentation version setting plus a visible last-updated label on public pages.
- Refined the page metadata strip by removing the duplicate inline version badge and aligning the documentation label with the last-updated timestamp.
- Tightened the metadata row layout again by switching the documentation label to inline text and forcing baseline alignment.
- Normalized pasted rich content on the server side so non-code `pre` blocks no longer render as dark panels and real code blocks receive syntax highlighting reliably.
- Fixed the admin drag-sort asset path so the SortableJS handle works in the dashboard again.
- Improved mobile navigation behavior with dismissible overlay controls and made the public topbar sticky so menu and search remain accessible on long pages.
- Added public asset cache-busting and a hidden-by-default mobile backdrop so stale CDN/browser CSS cannot shove the main content into the wrong column after a deploy.
- Softened the sticky public topbar by removing the full-width background band and keeping only the floating controls visible.
