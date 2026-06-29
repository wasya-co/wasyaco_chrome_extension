
/*
 * node src/talking_head/example_puppeteer.js --input_url=<> --api_key=<> --api_secret=<>
**/

import puppeteer from 'puppeteer';

const logg = (a, b="") => {
  console.log(`+++ ${b}:`, a); // eslint-disable-line no-console
};

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const args = process.argv.slice(2);
const params = {};
for (const arg of args) {
  const [key, value] = arg.replace(/^--/, '').split('=');
  params[key] = value ?? true;
}
// logg(params, 'ze params')

const page_url = `http://localhost:8080/2025/talking-head/example-3.html?input_url=${params.input_url}&api_key=${params.api_key}&api_secret=${params.api_secret}&w_px=${params.w_px}&h_px=${params.h_px}`
logg(page_url, 'page_url')
await page.goto(page_url);


setTimeout(async () => {
  await page.screenshot({ path: 'screenshots/example-3.png' });
  await browser.close();
}, 30*1000)
