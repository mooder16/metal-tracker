#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const COMMODITIES = require('./commodities');

const historyDays = Math.max(1, Math.min(365, parseInt(process.argv[2], 10) || 60));
const outputPath = path.join(__dirname, '..', 'public', 'data', 'metals.json');

function buildExtractJs(days) {
  return `
(function() {
  try {
    if (typeof Highcharts === 'undefined' || !Highcharts.charts) {
      return JSON.stringify({ error: 'Highcharts not found' });
    }
    var charts = Highcharts.charts.filter(function(c) { return c != null; });
    if (charts.length === 0) return JSON.stringify({ error: 'No charts found' });
    var bestSeries = null;
    var bestLen = 0;
    for (var i = 0; i < charts.length; i++) {
      var chart = charts[i];
      for (var j = 0; j < chart.series.length; j++) {
        var s = chart.series[j];
        var xd = s.xData || [];
        var yd = s.yData || [];
        var validCount = 0;
        for (var v = 0; v < yd.length; v++) {
          if (yd[v] !== null && yd[v] !== undefined) validCount++;
        }
        if (validCount > bestLen) {
          bestLen = validCount;
          bestSeries = { xd: xd, yd: yd, name: s.name };
        }
      }
    }
    if (!bestSeries || bestLen === 0) return JSON.stringify({ error: 'No series data found' });
    var xd = bestSeries.xd;
    var yd = bestSeries.yd;
    var historyDays = ${days};
    var history = [];
    var startIdx = Math.max(0, xd.length - historyDays);
    for (var k = startIdx; k < xd.length; k++) {
      if (yd[k] !== null && yd[k] !== undefined) {
        history.push({
          date: new Date(xd[k]).toISOString().split('T')[0],
          price: yd[k]
        });
      }
    }
    var lastPrice = null;
    var lastDate = null;
    for (var m = yd.length - 1; m >= 0; m--) {
      if (yd[m] !== null && yd[m] !== undefined) {
        lastPrice = yd[m];
        lastDate = new Date(xd[m]).toISOString().split('T')[0];
        break;
      }
    }
    return JSON.stringify({
      price: lastPrice,
      date: lastDate,
      history: history,
      historyDays: historyDays,
      seriesName: bestSeries.name,
      source: 'highcharts'
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
})()
`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOne(browser, commodity, days) {
  const page = await browser.newPage();
  const extractJs = buildExtractJs(days);

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) req.abort();
      else req.continue();
    });

    await page.goto(commodity.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1200);

    for (let attempt = 0; attempt < 30; attempt++) {
      const raw = await page.evaluate(extractJs);
      const data = JSON.parse(raw);
      if (!data.error && data.price != null) {
        return {
          id: commodity.id,
          name: commodity.name,
          nameEn: commodity.nameEn,
          unit: commodity.unit,
          color: commodity.color,
          icon: commodity.icon,
          price: data.price,
          date: data.date,
          history: data.history || [],
          historyDays: data.historyDays || days,
          error: null
        };
      }
      await sleep(500);
    }

    return {
      id: commodity.id,
      name: commodity.name,
      nameEn: commodity.nameEn,
      unit: commodity.unit,
      color: commodity.color,
      icon: commodity.icon,
      price: null,
      date: null,
      history: [],
      historyDays: days,
      error: '無法取得走勢資料'
    };
  } catch (error) {
    return {
      id: commodity.id,
      name: commodity.name,
      nameEn: commodity.nameEn,
      unit: commodity.unit,
      color: commodity.color,
      icon: commodity.icon,
      price: null,
      date: null,
      history: [],
      historyDays: days,
      error: error.message
    };
  } finally {
    await page.close();
  }
}

async function main() {
  console.log(`Scraping ${COMMODITIES.length} commodities (${historyDays} days)...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const results = await Promise.all(
      COMMODITIES.map((c) => fetchOne(browser, c, historyDays))
    );

    const payload = {
      updatedAt: new Date().toISOString(),
      historyDays,
      commodities: Object.fromEntries(results.map((r) => [r.id, r]))
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Saved ${outputPath}`);
    const ok = results.filter((r) => r.price != null).length;
    console.log(`Success: ${ok}/${results.length}`);
    process.exit(ok === 0 ? 1 : 0);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
