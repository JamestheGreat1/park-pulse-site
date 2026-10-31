const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 920 } });
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  // App icon assets are separate from this static-site repo. The preview
  // must remain interactive even if the external icon CDN is inaccessible.
  await page.route("https://app.useparkpulse.com/**", (route) =>
    route.fulfill({status:200,contentType:"image/png",body:""}));

  try {
    await page.goto("http://127.0.0.1:8767/", { waitUntil: "domcontentloaded" });
    assert.match(await page.title(), /ParkPulse/);
    assert.equal(await page.locator(".hero-scope span").count(), 3);
    assert.match(await page.locator(".hero-scope").innerText(), /101 attractions/);
    assert.match(await page.locator(".preview-disclaimer").innerText(), /not live wait times/i);

    const resort = (key) => page.locator('[data-preview-resort="' + key + '"]');
    const park = (key) => page.locator('[data-preview-park="' + key + '"]');
    const selected = async (button) => assert.equal(await button.getAttribute("aria-pressed"),"true");

    await selected(resort("wdw"));
    assert.equal(await page.locator("[data-preview-park-tabs] button").count(), 4);
    assert.match(await page.locator("[data-preview-park-name]").innerText(), /Magic Kingdom/);
    await park("epcot").click();
    await selected(park("epcot"));
    assert.equal(await page.locator("[data-preview-park-name]").innerText(),"EPCOT");

    await resort("dlr").click();
    await selected(resort("dlr"));
    assert.equal(await page.locator("[data-preview-park-tabs] button").count(),2);
    assert.equal(await page.locator("[data-preview-park-name]").innerText(),"Disneyland Park");
    assert.match(await page.locator('[data-preview-ride="0"]').innerText(), /Space Mountain/);
    await park("dca").click();
    await selected(park("dca"));
    assert.equal(await page.locator("[data-preview-park-name]").innerText(),"Disney California Adventure");
    assert.match(await page.locator('[data-preview-ride="0"]').innerText(),/Radiator Springs Racers/);
    assert.match(await page.locator("[data-preview-alert-name]").innerText(),/Radiator Springs Racers/);
    await resort("wdw").click();
    await selected(park("epcot")); // switching resorts remembers last selected park

    for (const width of [320, 375, 390, 430, 768, 1365]) {
      await page.setViewportSize({width, height:920});
      for (const key of ["wdw","dlr"]) {
        await resort(key).click();
        const layout = await page.evaluate(() => {
          const phone=document.querySelector(".phone").getBoundingClientRect();
          const inner=[
            ...document.querySelectorAll(".preview-resort-picker button"),
            ...document.querySelectorAll(".park-tabs button"),
            ...document.querySelectorAll(".phone-nav > span")
          ].map(el=>el.getBoundingClientRect());
          return {
            scrollWidth:document.documentElement.scrollWidth,
            viewport:document.documentElement.clientWidth,
            phoneLeft:phone.left,phoneRight:phone.right,
            inside:inner.every(r=>r.left>=phone.left-2 && r.right<=phone.right+2)
          };
        });
        assert(layout.inside, "Phone preview controls overflow at "+width+"px "+key+": "+JSON.stringify(layout));
        assert(layout.scrollWidth<=layout.viewport+2,
          "Page scrolls horizontally at "+width+"px "+key+": "+JSON.stringify(layout));
      }
    }
    assert.equal(await page.locator("#seasonalLayer").count(),1,"Keep existing seasonal animations");
    assert.deepEqual(failures, [], "No unhandled client JavaScript errors");
    console.log("PASS: 2.0 landing content, both resorts, six parks, mobile layout, seasonal layer");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode=1; });
