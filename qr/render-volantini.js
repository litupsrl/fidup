const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  for (const l of ['it', 'en', 'fr', 'de', 'es', 'zh']) {
    await p.goto(`file:///home/user/fidup/qr/volantino${l === 'it' ? '' : '-' + l}.html`); await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready);
    // adatta i testi lunghi: riga finale su una riga, pagina entro A4
    const fit = await p.evaluate(() => {
      const last = document.querySelector('.slogan .last'), box = document.querySelector('.slogan'), ul = document.querySelector('.slogan ul');
      let fs = 15, us = 21, q = 80, steps = 0;
      while (last.scrollWidth > last.clientWidth + 1 && fs > 10) { fs -= 0.5; last.style.fontSize = fs + 'pt'; }
      const lis = [...ul.children];
      while (lis.some(li => li.getBoundingClientRect().height > us * 1.35 * 1.34 * 1.5) && us > 15) { us -= 0.5; ul.style.fontSize = us + 'pt'; }
      while (document.documentElement.scrollHeight > 1123 + 1 && q > 64) { q -= 2; document.querySelector('.qr img').style.width = document.querySelector('.qr img').style.height = q + 'mm'; steps++; }
      return { last: fs, list: us, qr: q, overflow: document.documentElement.scrollHeight > 1124 };
    });
    console.log(l, JSON.stringify(fit));
    await p.pdf({ path: `/home/user/fidup/qr/fidup-volantino${l === 'it' ? '' : '-' + l}.pdf`, format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    await p.screenshot({ path: `/home/user/fidup/qr/fidup-volantino${l === 'it' ? '' : '-' + l}.png` });
  }
  await b.close();
})();
