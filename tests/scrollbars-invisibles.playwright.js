"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage();
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
    const result = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "width:100px;height:100px;overflow:auto;position:fixed;left:-9999px";
      const content = document.createElement("div");
      content.style.cssText = "width:300px;height:300px";
      probe.appendChild(content);
      document.body.appendChild(probe);

      probe.scrollTop = 45;
      probe.scrollLeft = 35;
      const measured = {
        scrollbarWidth:getComputedStyle(probe).scrollbarWidth,
        webkitDisplay:getComputedStyle(probe, "::-webkit-scrollbar").display,
        scrollTop:probe.scrollTop,
        scrollLeft:probe.scrollLeft
      };
      probe.remove();
      return measured;
    });

    assert.equal(result.scrollbarWidth, "none");
    assert.equal(result.webkitDisplay, "none");
    assert.equal(result.scrollTop, 45);
    assert.equal(result.scrollLeft, 35);
    console.log("PASS Playwright: barres invisibles, défilement conservé");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
