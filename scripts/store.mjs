import { execSync } from 'child_process';
import { open } from 'fs';

const CHROME_DASHBOARD_URL =
    'https://chrome.google.com/u/1/webstore/devconsole';

const CHROME_ZIP = '.output/corsair-0.1.0-chrome.zip';
const FIREFOX_ZIP = '.output/corsair-0.1.0-firefox.zip';

function run(command, options = {}) {
    console.log(`\n$ ${command}`);
    execSync(command, {
        stdio: 'inherit',
        ...options,
    });
}

console.log('=== Corsair: Building and packaging ===');

console.log('\n[1/3] Building Chrome extension...');
run('pnpm build');

console.log('\n[2/3] Building Firefox extension...');
run('pnpm build:firefox');

console.log('\n[3/3] Packaging zips...');
run('pnpm zip');
run('pnpm zip:firefox');

console.log(`
=== Packaging complete ===

Artifacts:
  Chrome: ${CHROME_ZIP}
  Firefox: ${FIREFOX_ZIP}

Next steps:
  1. Go to the Chrome Web Store Developer Dashboard:
     ${CHROME_DASHBOARD_URL}
  2. Select your extension or create a new one.
  3. Upload the ${CHROME_ZIP} file on the "Package" tab.
  4. Fill in the store listing (description, screenshots, promo tile).
  5. Click "Submit for review".

For Firefox:
  - Go to https://addons.mozilla.org/developers/
  - Create a new extension or select an existing one.
  - Upload the ${FIREFOX_ZIP} file.
`);

console.log('Opening Chrome Web Store Dashboard...');
openUrl(CHROME_DASHBOARD_URL);

function openUrl(url) {
    const platform = process.platform;
    const cmd =
        platform === 'darwin'
            ? 'open'
            : platform === 'win32'
                ? 'start'
                : 'xdg-open';
    require('child_process').exec(`${cmd} "${url}"`);
}
