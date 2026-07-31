import chromeWebstoreUpload from 'chrome-webstore-upload';

const EXTENSION_ID = process.env.CHROME_EXTENSION_ID;
const CLIENT_ID = process.env.CHROME_CLIENT_ID;
const CLIENT_SECRET = process.env.CHROME_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.CHROME_REFRESH_TOKEN;
const ZIP_PATH =
    process.env.CHROME_ZIP_PATH ?? '.output/corsair-0.1.0-chrome.zip';

if (!EXTENSION_ID || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error(
        'Missing required secrets. Set CHROME_EXTENSION_ID, CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, and CHROME_REFRESH_TOKEN in GitHub secrets.',
    );
    process.exit(1);
}

const store = chromeWebstoreUpload({
    extensionId: EXTENSION_ID,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    refreshToken: REFRESH_TOKEN,
});

async function upload() {
    console.log(`Uploading ${ZIP_PATH} to Chrome Web Store...`);

    const zipBuffer = await readFile(ZIP_PATH);

    const res = await store.uploadExisting(zipBuffer, {
        language: 'en_US',
    });

    if (res.uploadState === 'SUCCESS') {
        console.log(
            `Upload successful! Extension ID: ${EXTENSION_ID}`,
        );
    } else {
        console.error('Upload response:', res);
        process.exit(1);
    }
}

async function readFile(path) {
    const { readFileSync } = await import('fs');
    return readFileSync(path);
}

upload().catch((err) => {
    console.error('Upload failed:', err);
    process.exit(1);
});
