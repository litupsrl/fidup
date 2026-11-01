const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file:///tmp/promo/slides.html'); await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 7; i++) await p.locator('#s' + i).screenshot({ path: `/tmp/promo/slide${i}.png` });
  await b.close();
})();
