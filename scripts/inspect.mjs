import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1512, height: 1080 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto('http://127.0.0.1:5173');
await page.getByRole('heading', { name: '研究项目.' }).waitFor();
await page.locator('a.project-card h3').first().waitFor();
await page.screenshot({ path: 'artifacts/projects-desktop.png', fullPage: true });
await page.locator('a.project-card').first().click();
try {
  await page.locator('.workspace-panel').waitFor({ timeout: 15000 });
} catch {
  console.log(JSON.stringify({ errors, body: await page.locator('body').innerText() }));
  await page.screenshot({ path: 'artifacts/failure.png' });
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/workbench-desktop.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'artifacts/workbench-mobile.png', fullPage: true });
console.log(
  JSON.stringify({
    errors,
    title: await page.title(),
    horizontalOverflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  }),
);
await browser.close();
