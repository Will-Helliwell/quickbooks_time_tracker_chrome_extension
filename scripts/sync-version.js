const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Read manifest.json
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update version in manifest
manifest.version = version;

// Write back to manifest.json with proper formatting
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`✓ Synced version to ${version} in manifest.json`);
