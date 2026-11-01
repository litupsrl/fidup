const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const p = await c.newPage();
  await p.goto('http://localhost:8774/?app=1'); await p.waitForSelector('#view-list:not([hidden])');
  await p.evaluate(() => localStorage.setItem('install_dismissed', String(Date.now())));
  const demo = [['Venchi', '#3A3A3A'], ['Original Marines', '#3B82F6'], ['Obaibi', '#3A3A3A'], ['Miroglio OUTLET', '#3A3A3A'], ['MediaWorld', '#C8102E'], ['KASANOVA', '#3A3A3A'], ['IKEA', '#0058A3'], ["IDEXE'", '#3A3A3A']];
  for (const [n, col] of demo) {
    await p.click('.fab'); await p.fill('#f-name', n); await p.fill('#f-number', '1234567890'); await p.fill('#f-color', col);
    await p.click('#form-edit button[type=submit]'); await p.waitForSelector('#view-list:not([hidden])');
  }
  // ordine come nell'esempio: più usate = apri in ordine inverso più volte
  for (let i = 0; i < demo.length; i++) for (let k = 0; k < demo.length - i; k++) {
    await p.click(`.card-tile[data-id] >> text="${demo[i][0]}"`); await p.waitForSelector('#view-detail:not([hidden])'); await p.goBack(); await p.waitForSelector('#view-list:not([hidden])');
  }
  await p.reload(); await p.waitForSelector('.card-tile');
  await p.evaluate(() => document.querySelectorAll('.card-tile .num').forEach((e) => { e.textContent = '•••• •••• ••••'; }));
  await p.waitForTimeout(3200);
  await p.screenshot({ path: '/tmp/promo/en-list.png' });
  await p.click('.fab'); await p.fill('#f-number', '4000000000006'); await p.selectOption('#f-format', 'EAN13'); await p.dispatchEvent('#f-number', 'input');
  await p.type('#f-name', 'Ike', { delay: 30 }); await p.waitForSelector('#name-suggest:not([hidden])'); await p.waitForTimeout(3200);
  await p.screenshot({ path: '/tmp/promo/en-edit.png' });
  await b.close();
})();
