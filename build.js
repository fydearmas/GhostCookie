/**
 * Ghost Cookie - Build Script
 * Adds watermarks and prepares production build
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Configuration
const BUILD_ID = Date.now().toString(36);
const WATERMARK = `GC-${BUILD_ID}`;
const VERSION = "1.0.0";

// Copyright header
const COPYRIGHT_HEADER = `/**
 * Ghost Cookie v${VERSION}
 * Copyright (c) 2025 Franky Solutions
 * Developed by: Franky Solutions
 * Build: ${BUILD_ID}
 * Watermark: ${WATERMARK}
 * 
 * This code is protected by copyright.
 * Unauthorized use is prohibited.
 */

`;

// Files to process
const FILES_TO_WATERMARK = [
  "popup/popup.js",
  "background/service-worker.js",
  "content/content.js",
  "options/options.js",
  "background/tracker-list.js",
  "utils/cookie-classifier.js",
];

// Add watermark to file
function addWatermark(filePath) {
  const fullPath = path.join(__dirname, filePath);
  let content = fs.readFileSync(fullPath, "utf8");

  // Remove existing watermark if present
  content = content.replace(/\/\*\*[\s\S]*?\*\/\n\n/, "");

  // Add new watermark
  content = COPYRIGHT_HEADER + content;

  // Add inline watermark
  const inlineWatermark = `\n// Watermark: ${WATERMARK}\n// Build: ${BUILD_ID}\n`;
  content = content + inlineWatermark;

  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`✓ Watermarked: ${filePath}`);
}

// Generate integrity hash
function generateIntegrityHash() {
  const hashes = {};

  FILES_TO_WATERMARK.forEach((file) => {
    const fullPath = path.join(__dirname, file);
    const content = fs.readFileSync(fullPath, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    hashes[file] = hash;
  });

  return hashes;
}

// Main build process
function build() {
  console.log("🔨 Building Ghost Cookie...\n");

  // Add watermarks
  console.log("📝 Adding watermarks...");
  FILES_TO_WATERMARK.forEach(addWatermark);

  // Generate integrity hashes
  console.log("\n🔐 Generating integrity hashes...");
  const hashes = generateIntegrityHash();

  // Save build info
  const buildInfo = {
    version: VERSION,
    buildId: BUILD_ID,
    watermark: WATERMARK,
    timestamp: new Date().toISOString(),
    integrity: hashes,
  };

  fs.writeFileSync(
    path.join(__dirname, "build-info.json"),
    JSON.stringify(buildInfo, null, 2),
    "utf8"
  );

  console.log("\n✅ Build complete!");
  console.log(`Build ID: ${BUILD_ID}`);
  console.log(`Watermark: ${WATERMARK}`);
  console.log("\n📦 Next steps:");
  console.log('1. Run "npm run obfuscate" to minify code');
  console.log("2. Update manifest.json to use .min.js files");
  console.log("3. Test the extension");
  console.log("4. Package for distribution");
}

// Run build
build();
