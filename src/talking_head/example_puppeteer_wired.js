
/*
 * node src/talking_head/example_puppeteer.js --input_url=<> --api_key=<> --api_secret=<>
**/

import puppeteer from 'puppeteer';

const logg = (a, b="") => {
  console.log(`+++ ${b}:`, a); // eslint-disable-line no-console
};


const args = process.argv.slice(2);
const params = {};
for (const arg of args) {
  const [key, value] = arg.replace(/^--/, '').split('=');
  params[key] = value ?? true;
}
let is_headless = true
if ( 'false' === params.headless) {
  is_headless = false
}
logg(params, 'ze params')

const browser = await puppeteer.launch({
  headless: is_headless,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ],
});
const page = await browser.newPage();


const page_url = `${params.wco_origin}/2025/talkinghead_auto.html?wco_origin=${params.wco_origin}&newspartial_id=${params.newspartial_id}&api_key=${params.api_key}&api_secret=${params.api_secret}&w_px=${params.w_px}&h_px=${params.h_px}`
logg(page_url, 'page_url')
await page.goto(page_url, { timeout: 15 * 60 * 1000 });


setTimeout(async () => {
  await page.screenshot({ path: 'screenshots/example-3.png' });
  await browser.close();
}, 30*1000)
