#!/usr/bin/env node
/**
 * Metal Futures Scraper - Yahoo Finance API
 * 不需要 Puppeteer，直接呼叫 Yahoo Finance API
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// 允許自簽憑證（本機開發用）
const agent = new https.Agent({ rejectUnauthorized: false });

const historyDays = Math.max(1, Math.min(365, parseInt(process.argv[2], 10) || 365));
const outputPath = path.join(__dirname, '..', 'public', 'data', 'metals.json');

// Yahoo Finance 期貨符號
// HG=F  = Copper Futures (USD/lb) → 換算成 USD/噸 (*2204.62)
// ALI=F = Aluminum Futures (USD/lb) → 換算成 USD/噸 (*2204.62)
// CL=F  = WTI Crude Oil (USD/barrel)
// TIO=F = Iron Ore 62% Fe CFR China (USD/噸)
// LME Nickel 代表不鏽鋼原料指標

const COMMODITIES = [
  {
    id: 'copper',
    name: '銅',
    nameEn: 'Copper (LME)',
    symbol: 'HG=F',
    unit: 'USD/噸',
    color: '#CD7F32',
    icon: '🔶',
    multiplier: 2204.62  // lb → 噸
  },
  {
    id: 'aluminum',
    name: '鋁',
    nameEn: 'Aluminum',
    symbol: 'ALI=F',
    unit: 'USD/噸',
    color: '#A8A9AD',
    icon: '⬜',
    multiplier: 1  // ALI=F 已是 USD/噸
  },
  {
    id: 'stainless',
    name: '不鏽鋼 (熱軋鋼)',
    nameEn: 'Steel HRC',
    symbol: 'HRC=F',
    unit: 'USD/噸',
    color: '#708090',
    icon: '🔩',
    multiplier: 1
  },
  {
    id: 'iron',
    name: '鐵礦石',
    nameEn: 'Iron Ore 62%',
    symbol: 'TIO=F',
    unit: 'USD/噸',
    color: '#8B4513',
    icon: '⛏️',
    multiplier: 1
  },
  {
    id: 'oil',
    name: '石油 (WTI)',
    nameEn: 'WTI Crude Oil',
    symbol: 'CL=F',
    unit: 'USD/桶',
    color: '#2F4F4F',
    icon: '🛢️',
    multiplier: 1
  }
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON parse error'));
        }
      });
    }).on('error', reject);
  });
}

async function fetchCommodity(commodity, days) {
  const range = days <= 60 ? '3mo' : days <= 180 ? '6mo' : '1y';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${commodity.symbol}?interval=1d&range=${range}`;

  try {
    const data = await fetchJson(url);
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No result');

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const mult = commodity.multiplier || 1;

    // 建立歷史數據
    const history = [];
    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (price != null && !isNaN(price)) {
        history.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          price: Math.round(price * mult * 100) / 100
        });
      }
    }

    // 最新價格
    let lastPrice = meta.regularMarketPrice || meta.previousClose;
    if (lastPrice) lastPrice = Math.round(lastPrice * mult * 100) / 100;

    const lastDate = lastPrice
      ? new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0]
      : null;

    console.log(`  ✅ ${commodity.name} (${commodity.symbol}): ${lastPrice} ${commodity.unit}, history: ${history.length} pts`);

    return {
      id: commodity.id,
      name: commodity.name,
      nameEn: commodity.nameEn,
      unit: commodity.unit,
      color: commodity.color,
      icon: commodity.icon,
      price: lastPrice,
      date: lastDate,
      history: history.slice(-days),
      historyDays: days,
      source: 'Yahoo Finance',
      symbol: commodity.symbol,
      error: null
    };
  } catch (err) {
    console.log(`  ❌ ${commodity.name} (${commodity.symbol}): ${err.message}`);
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
      source: 'Yahoo Finance',
      symbol: commodity.symbol,
      error: err.message
    };
  }
}

async function main() {
  console.log(`Fetching ${COMMODITIES.length} commodities from Yahoo Finance (${historyDays} days)...`);

  const results = [];
  for (const c of COMMODITIES) {
    const result = await fetchCommodity(c, historyDays);
    results.push(result);
    // 小延遲避免被限速
    await new Promise(r => setTimeout(r, 500));
  }

  const ok = results.filter(r => r.price != null).length;
  console.log(`\nSuccess: ${ok}/${results.length}`);

  // 讀取舊數據合併
  let oldPayload = { commodities: {} };
  if (fs.existsSync(outputPath)) {
    try {
      oldPayload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    } catch (e) {}
  }

  const mergedCommodities = { ...(oldPayload.commodities || {}) };
  for (const r of results) {
    if (r.price != null) {
      mergedCommodities[r.id] = r;
    } else if (!mergedCommodities[r.id]) {
      mergedCommodities[r.id] = r;
    }
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    historyDays,
    commodities: mergedCommodities
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Saved to ${outputPath}`);

  const totalOk = Object.values(mergedCommodities).filter(r => r.price != null).length;
  process.exit(totalOk === 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
