const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const archiver = require("archiver");
const XLSX = require("xlsx");

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static("public"));

// Create uploads folder if not exist
const uploadFolder = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// CSV file path
const csvFile = path.join(__dirname, "data.csv");

// Registration endpoint
app.post("/api/register", upload.single("screenshot"), (req, res) => {
  const body = req.body;
  const file = req.file ? req.file.filename : "";

  const entry = {
    firstName: body.firstName || "",
    lastName: body.lastName || "",
    email: body.email || "",
    contact: body.contact || "",
    ieeeId: body.ieeeId || "",
    membershipType: body.membershipType || "",
    renewalPassword: body.renewalPassword || "",
    branch: body.branch || "",
    batch: body.batch || "",
    year: body.year || "",
    societies: Array.isArray(body.societies) ? body.societies.join(",") : body.societies || "",
    totalFee: body.totalFee || "",
    submittedAt: body.submittedAt || new Date().toISOString(),
    screenshot: file
  };

  // Prepare CSV line
  const csvLine = Object.values(entry).map(v => `"${v}"`).join(",") + "\n";

  // Write headers if file doesn't exist
  if (!fs.existsSync(csvFile)) {
    const headers = Object.keys(entry).join(",") + "\n";
    fs.writeFileSync(csvFile, headers, "utf8");
  }

  // Append data
  fs.appendFileSync(csvFile, csvLine, "utf8");

  res.json({ success: true });
});

// Download Excel (.xlsx) file
app.get("/api/download/excel", (req, res) => {
  if (!fs.existsSync(csvFile)) return res.status(404).send("No data found");

  const workbook = XLSX.utils.book_new();
  const csvData = fs.readFileSync(csvFile, "utf8");
  const rows = csvData.split("\n").filter(r => r).map(r => r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, "")));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, ws, "Registrations");

  const tempFile = path.join(__dirname, "registrations.xlsx");
  XLSX.writeFile(workbook, tempFile);

  res.download(tempFile, "registrations.xlsx");
});

// Download all screenshots as ZIP
app.get("/api/download/screenshots", (req, res) => {
  const zipPath = path.join(__dirname, "screenshots.zip");
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => res.download(zipPath, "screenshots.zip"));
  archive.on("error", err => res.status(500).send({ error: err.message }));

  archive.pipe(output);
  archive.directory(uploadFolder, false);
  archive.finalize();
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
