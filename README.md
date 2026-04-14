# Guadoc

Guadoc is a self-hosted documentation center for API guides and ecosystem tutorials. It includes a public reading experience, a browser-based admin editor, local image uploads, automatic navigation, full-text search, and JSON APIs for future retrieval workflows.

## Features

- Public docs without a login requirement
- Local admin account with username and password only
- Rich text editor with drag-and-drop image upload
- Live preview while editing
- Multi-level navigation with drag-and-drop ordering
- Right-side table of contents and previous or next links
- SQLite persistence with immediate publishing
- Custom CSS support
- JSON API endpoints for pages and search

## Stack

- Node.js 22
- Express 5
- SQLite with `better-sqlite3`
- EJS server-rendered templates
- TinyMCE served locally for WYSIWYG editing
- SortableJS for navigation ordering

## Quick Start

### Local

```bash
npm install
npm start
```

Open `http://localhost:3210`.

Default seeded admin credentials:

- Username: `admin`
- Password: read from `.env` or `docker-compose.yml`

Change the credentials immediately after the first login from the settings page.

### Docker Compose

```bash
docker compose up -d --build
```

The app stores its SQLite database and uploaded images in the named Docker volume `guadoc_data`.

Before the first production deploy, create a local `.env` file from `.env.example` and set your real domain and admin password there. Do not commit the real password to Git.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3210` | HTTP port inside the container |
| `APP_ORIGIN` | empty | Public origin used to decide secure cookies |
| `ADMIN_USERNAME` | `admin` | Seeded username on first boot only |
| `ADMIN_PASSWORD` | `change-me-now` | Seeded password on first boot only |
| `DATA_DIR` | `./data` locally | Root path for persistent data |
| `DATABASE_PATH` | `DATA_DIR/guadoc.sqlite` | SQLite database file |
| `UPLOADS_DIR` | `DATA_DIR/uploads` | Uploaded image directory |

## Admin Flow

1. Sign in at `/admin/login`.
2. Create a group or page.
3. Paste rich content into the editor.
4. Drag images into the editor to upload them.
5. Save and publish.

New pages appear in the public navigation automatically.

## Public API

### List published pages

```http
GET /api/pages
```

### Read one page by path

```http
GET /api/page?path=getting-started/welcome
```

### Search published pages

```http
GET /api/search?q=workflow
```

## Reverse Proxy Notes

Guadoc works behind Nginx reverse proxy setups such as BaoTa. Forward the original host and scheme headers so absolute origin handling stays correct.

Example location block:

```nginx
location / {
    proxy_pass http://127.0.0.1:3210;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Set `APP_ORIGIN` to the final external HTTPS URL in production and keep the real admin password in `.env`, not in a committed file.

## Notes

- Publishing is dynamic. Content changes do not require a rebuild.
- The initial database is seeded with a small sample section so the site is not empty on first boot.
- All Markdown files and code comments in this repository are kept in English to avoid encoding issues.
