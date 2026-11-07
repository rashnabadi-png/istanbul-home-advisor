const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs=[];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.route('**/fonts.googleapis.com/**', r=>r.abort());
  await p.goto("http://localhost:3000/chat.html"); await p.waitForTimeout(800);
  console.log('TITLE', await p.title(), '|', await p.textContent('#brandName'));
  // Persian typed question
  await p.click('#lang button[data-l="fa"]'); await p.waitForTimeout(400);
  await p.fill('#input','قیمت سگا مترو پارک چنده؟'); await p.press('#input','Enter'); await p.waitForTimeout(800);
  console.log('FA', (await p.$$eval('.msg', n=>n.slice(-2).map(x=>x.textContent.slice(0,140)))).join(' || '));
  console.log('DIR', await p.getAttribute('html','dir'));
  // English, click through
  await p.click('#lang button[data-l="en"]'); await p.waitForTimeout(400);
  for (let i=0;i<25 && !(await p.$('.card')); i++){
    const inp = await p.$eval('#input', x=>x.placeholder);
    const chips = await p.$$('#replies .reply');
    if (!chips.length){ await p.fill('#input', i<8?'Iran':'Şişli'); await p.press('#input','Enter'); }
    else { const done = await p.$('#replies .reply[data-done="1"]');
      if (done && (await p.$$('#replies .reply[aria-pressed="true"]')).length) await done.click(); else await chips[0].click(); }
    await p.waitForTimeout(350);
  }
  const cards = await p.$$eval('.card h3', n=>n.map(x=>x.textContent)); console.log('CARDS', cards);
  await p.click('.card .agent'); await p.waitForTimeout(300);
  await p.fill('#input','Ali Test'); await p.press('#input','Enter'); await p.waitForTimeout(300);
  await p.fill('#input','+98 912 000 0000'); await p.press('#input','Enter'); await p.waitForTimeout(300);
  for (let i=0;i<2;i++){ await p.click('#replies .reply >> nth=0'); await p.waitForTimeout(300); }
  await p.click('#replies .reply >> nth=0'); await p.waitForTimeout(800);
  console.log('LEAD', (await p.$$eval('.msg', n=>n.slice(-2).map(x=>x.textContent.slice(0,120)))).join(' || '));
  await p.setViewportSize({width:390,height:800}); await p.screenshot({path: process.argv[2]+'/public_phone.png'});
  const ov = await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth); console.log('OVERFLOW', ov);
  await p.goto('http://localhost:3000/privacy.html'); console.log('PRIV', await p.title());
  console.log('ERRS', errs); await b.close();
})();
