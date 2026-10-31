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

    // Identical vector geometry to the four real ParkPulse PWA navigation
    // buttons. Font-dependent Unicode placeholders cannot pass this check.
    const appNavPaths = [
      "m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z",
      "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
      "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15",
      "M9.02 4.79 L10.25 4.4 L10.17 2.58 L13.83 2.58 L13.75 4.4 L14.98 4.79 L16.13 5.39 L17.37 4.04 L19.96 6.63 L18.61 7.87 L19.21 9.02 L19.6 10.25 L21.42 10.17 L21.42 13.83 L19.6 13.75 L19.21 14.98 L18.61 16.13 L19.96 17.37 L17.37 19.96 L16.13 18.61 L14.98 19.21 L13.75 19.6 L13.83 21.42 L10.17 21.42 L10.25 19.6 L9.02 19.21 L7.87 18.61 L6.63 19.96 L4.04 17.37 L5.39 16.13 L4.79 14.98 L4.4 13.75 L2.58 13.83 L2.58 10.17 L4.4 10.25 L4.79 9.02 L5.39 7.87 L4.04 6.63 L6.63 4.04 L7.87 5.39 Z"
    ];
    const actualNavPaths = await page.locator(".phone-nav > span > svg > path").evaluateAll(
      nodes => nodes.map(node => node.getAttribute("d"))
    );
    assert.deepEqual(actualNavPaths, appNavPaths, "All four preview icons match the actual app SVGs");
    assert.equal(await page.locator(".phone-nav svg circle").count(),1,"Settings retains its correct gear center");
    const navGraphics = await page.locator(".phone-nav svg").evaluateAll(nodes =>
      nodes.map(el=>({width:getComputedStyle(el).width,height:getComputedStyle(el).height,stroke:getComputedStyle(el).stroke}))
    );
    assert(navGraphics.every(x=>x.width==="22px"&&x.height==="22px"&&x.stroke!=="none"),
      "SVGs must render as 22px outlined app icons");

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
