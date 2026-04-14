require("dotenv").config();

const path = require("path");
const express = require("express");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const packageJson = require("../package.json");
const config = require("./lib/config");
const dbApi = require("./db/database");
const { attachAdmin } = require("./middleware/admin");
const publicRouter = require("./routes/public");
const adminRouter = require("./routes/admin");

dbApi.initializeDatabase();

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.year = new Date().getFullYear();
app.locals.assetVersion = `${packageJson.version}-${Date.now()}`;

app.use(compression());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(config.uploadsDir));
app.use("/vendor/tinymce", express.static(path.dirname(require.resolve("tinymce/tinymce.min.js"))));
app.use("/vendor/sortablejs", express.static(path.dirname(require.resolve("sortablejs/package.json"))));
app.use("/vendor/highlightjs", express.static(path.dirname(require.resolve("highlight.js/package.json"))));
app.use(attachAdmin(dbApi.db));

app.use("/", publicRouter({ dbApi }));
app.use("/admin", adminRouter({ dbApi }));

app.use((req, res) => {
  res.status(404).render("not-found", {
    pageTitle: "Not Found",
    settings: dbApi.getSettings(),
  });
});

app.listen(config.port, () => {
  console.log(`Guadoc is running on http://localhost:${config.port}`);
});
