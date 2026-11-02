const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs=[];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/fonts.googleapis.com/**', r=>r.abort());
  await p.goto('http://localhost:3000/'); await p.waitForTimeout(800);
  const ask = async (lang, q) => { if (lang) { await p.click(`#lang button[data-l="${lang}"]`); await p.waitForTimeout(300); }
    await p.fill('#input', q); await p.press('#input','Enter'); await p.waitForTimeout(400);
    const m = await p.$$eval('.msg.bot', n=>n.at(-1).textContent.slice(0,110)); const c = await p.$$eval('.card h3', n=>n.map(x=>x.textContent).slice(-1));
    console.log(`[${lang||'-'}] ${q}\n   -> ${m}  ${c.length? 'CARD:'+c[0]:''}`); };
  await ask('en','How much is Sega Metro Park?');
  await ask(null,'Is there a park near the sea in Istanbul?');
  await ask(null,'Can I get citizenship with this?');
  await ask('fa','مالیات خرید خانه چقدره؟');
  await ask('tr','Tapu nasıl alınır?');
  await ask('ru','Расскажите про Babacan Port Royal');
  await ask('ar','هل يمكنني الحصول على الجنسية؟');
  await ask('en','What is the weather like?');
  console.log('ERRS', errs); await b.close();
})();
