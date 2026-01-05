# QuickBooks Time Tracker Chrome Extension

A Chrome extension for managing and tracking time in QuickBooks Time.

## Development Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd quickbooks-time-tracker-chrome-extension
```

2. Install dependencies:
```bash
npm install
```

3. Start the Tailwind CSS build process in watch mode:
```bash
npm run build
```
This will watch for changes in your HTML/JS files and automatically rebuild the CSS.

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the project directory

## Development Workflow

- Keep the `npm run build` process running while developing to automatically compile Tailwind CSS changes
- Any changes to HTML/JS files will be automatically picked up by the Tailwind watcher
- The extension will automatically reload when you make changes to the files

## Production Deployment

1. Create a production build:
```bash
npm run package
```
This will:
- Build a minified version of the CSS
- Create a `dist` directory with all necessary files
- Generate a `quickbooks-time-tracker.zip` file

2. The generated `quickbooks-time-tracker.zip` file is ready for:
   - Submission to the Chrome Web Store
   - Distribution to clients

## Project Structure

```
├── src/                    # Source files
│   ├── input.css          # Tailwind CSS source
│   └── config.js          # Configuration constants
├── popup/                  # Extension popup files
│   ├── popup.html         # Main popup interface
│   ├── popup.js           # Popup logic
│   └── styles.css         # Generated CSS (do not edit directly)
├── background/            # Background scripts
├── images/               # Extension images
├── sounds/              # Alert sound files
├── manifest.json        # Extension manifest
├── offscreen.html      # Offscreen document for audio
├── offscreen.js        # Offscreen document logic
├── package.json        # Project configuration
├── tailwind.config.js  # Tailwind CSS configuration
└── postcss.config.js   # PostCSS configuration
```

## Version Management

**IMPORTANT:** The version number is managed in `package.json` only.

- To update the version, manually edit in `package.json`
- The version in `manifest.json` is automatically synced when you run `npm run package`
- You can manually sync versions at any time with: `npm run sync-version`
- **DO NOT** manually edit the version in `manifest.json` - it will be overwritten

## Important Notes

- Never edit the generated `popup/styles.css` file directly
- Always make style changes using Tailwind classes in your HTML/JS files
- Keep the `npm run build` process running during development
- The `dist` directory is automatically cleaned and recreated during packaging
- The production build includes only the necessary files for distribution
- Version numbers are automatically synced from `package.json` to `manifest.json`

## Troubleshooting

If you encounter any issues:

1. Make sure all dependencies are installed:
```bash
npm install
```

2. If styles aren't updating:
   - Ensure the `npm run build` process is running
   - Check that you're using valid Tailwind classes
   - Try stopping and restarting the build process

3. If the extension isn't loading:
   - Check the Chrome extension page for error messages
   - Verify all required files are present in the `dist` directory
   - Ensure the manifest.json is properly configured 