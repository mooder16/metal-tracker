const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

admin.initializeApp();
const db = admin.firestore();

const COMMODITIES = [
  {
    id: 'copper',
    name: '銅',
    nameEn: 'Copper',
    unit: 'USD/噸',
    url: 'https://www.macromicro.me/series/5630/copper-contract',
    color: '#CD7F32',
    icon: '🔶'
  },
  {
    id: 'aluminum',
    name: '鋁',
    nameEn: 'Aluminum',
    unit: 'USD/噸',
    url: 'https://www.macromicro.me/series/4257/aluminum-futures',
    color: '#A8A9AD',
    icon: '⬜'
  },
  {
    id: 'iron',
    name: '鐵礦石',
    nameEn: 'Iron Ore',
    unit: 'CNY/噸',
    url: 'https://www.macromicro.me/series/3987/china-iron-ore-futures',
    color: '#8B4513',
    icon: '⛏️'
  },
  {
    id: 'oil',
    name: '石油 (WTI)',
    nameEn: 'WTI Crude Oil',
    unit: 'USD/桶',
    url: 'https://www.macromicro.me/series/486/crude-oil-futures',
    color: '#2F4F4F',
    icon: '🛢️'
  }
];

const RUNTIME_OPTS = {
  region: 'asia-east1',
  memory: '2GiB',
  timeoutSeconds: 540,
  cors: true
};

function buildExtractJs(historyDays) {
  const days = Math.max(1, Math.min(365, Number(historyDays) || 60));
  return `
(function() {
  try {
    if (typeof Highcharts === 'undefined' || !Highcharts.charts) {
      return JSON.stringify({ error: 'Highcharts not found' });
    }
    var charts = Highcharts.charts.filter(function(c) { return c != null; });
    if (charts.length === 0) {
      return JSON.stringify({ error: 'No charts found' });
    }
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
    if (!bestSeries || bestLen === 0) {
      return JSON.stringify({ error: 'No series data found' });
    }
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
      totalPoints: bestLen,
      source: 'highcharts'
    });
  } catch(e) {
    return JSON.stringify({ error: e.message });
  }
})()
`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchBrowser() {
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  });
}

async function fetchCommodityData(browser, commodity, historyDays = 60) {
  const page = await browser.newPage();
  const extractJs = buildExtractJs(historyDays);

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(commodity.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await sleep(1200);

    for (let attempt = 0; attempt < 30; attempt++) {
      const raw = await page.evaluate(extractJs);
      const data = JSON.parse(raw);
      if (!data.error && data.price !== null && data.price !== undefined) {
        return {
          id: commodity.id,
          name: commodity.name,
          nameEn: commodity.nameEn,
          unit: commodity.unit,
          color: commodity.color,
          icon: commodity.icon,
          price: data.price,
          date: data.date || null,
          history: data.history || [],
          historyDays: data.historyDays || historyDays,
          error: null,
          source: data.source || null
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
      historyDays,
      error: '無法取得走勢資料',
      source: null
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
      historyDays,
      error: error.message,
      source: null
    };
  } finally {
    await page.close();
  }
}

async function refreshAllMetals(historyDays = 60) {
  const browser = await launchBrowser();
  try {
    const results = await Promise.all(
      COMMODITIES.map((commodity) => fetchCommodityData(browser, commodity, historyDays))
    );

    try {
      const batch = db.batch();
      const now = admin.firestore.FieldValue.serverTimestamp();

      for (const result of results) {
        batch.set(db.collection('metals').doc(result.id), {
          ...result,
          updatedAt: now
        });
      }

      batch.set(db.collection('metals').doc('_meta'), {
        lastRefresh: now,
        historyDays,
        count: results.length
      });

      await batch.commit();
    } catch (firestoreError) {
      console.warn('Firestore write skipped:', firestoreError.message);
    }

    return results;
  } finally {
    await browser.close();
  }
}

exports.refreshMetals = onRequest(RUNTIME_OPTS, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const historyDays = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 60));

  try {
    const results = await refreshAllMetals(historyDays);
    res.json({ ok: true, historyDays, results });
  } catch (error) {
    console.error('refreshMetals failed:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
