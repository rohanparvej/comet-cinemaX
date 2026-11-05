// Runs on Cloudflare Pages at build time (build command: node build-config.mjs).
// Writes the API_BASE_URL environment variable into js/config.js, like VITE_API_URL in a React app.
// If API_BASE_URL is not set (local development) js/config.js is left untouched.
import fs from 'node:fs';

const url = (process.env.API_BASE_URL || '').trim().replace(/\/+$/, '');
if (!url) {
  console.log('API_BASE_URL not set - js/config.js left as is.');
  process.exit(0);
}
if (!/^https?:\/\//.test(url)) {
  console.error('API_BASE_URL must start with http:// or https://');
  process.exit(1);
}

const file = new URL('./js/config.js', import.meta.url);
const before = fs.readFileSync(file, 'utf8');
const after = before.replace(/apiBaseUrl:\s*"[^"]*"/, `apiBaseUrl: ${JSON.stringify(url)}`);
if (after === before && !before.includes(JSON.stringify(url))) {
  console.error('Could not find apiBaseUrl in js/config.js');
  process.exit(1);
}
fs.writeFileSync(file, after);
console.log('js/config.js apiBaseUrl set to', url);