const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');

let mainWindow;
let fetchSessionReady = false;

function getFetchSession() {
  const ses = session.fromPartition('persist:metal-fetch');
  if (!fetchSessionReady) {
    fetchSessionReady = true;
    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      const blockTypes = new Set(['image', 'media', 'font', 'stylesheet']);
      const url = details.url.toLowerCase();
      const blockedHosts = [
        'google-analytics', 'googletagmanager', 'facebook', 'hotjar',
        'doubleclick', 'adservice', 'clarity.ms'
      ];
      if (
        blockTypes.has(details.resourceType) ||
        blockedHosts.some(h => url.includes(h))
      ) {
        callback({ cancel: true });
      } else {
        callback({ cancel: false });
      }
    });
  }
  return ses;
}

// 商品設定：名稱、URL、顏色
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 900,
    minWidth: 800,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: '金屬期貨價格追蹤器',
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 依天數產生提取 Highcharts 數據的 JS
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

// 使用隱藏視窗抓取單一商品數據
async function fetchCommodityData(commodity, historyDays = 60) {
  const extractJs = buildExtractJs(historyDays);
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1024,
      height: 720,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: false,
        javascript: true,
        webSecurity: false,
        session: getFetchSession()
      }
    });

    let resolved = false;
    let pollTimer = null;
    let attempts = 0;
    const maxAttempts = 30;
    const pollIntervalMs = 500;
    const initialDelayMs = 1200;

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      if (pollTimer) clearTimeout(pollTimer);
      clearTimeout(timeout);
      try { win.destroy(); } catch (e) {}
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        id: commodity.id,
        error: '載入超時',
        price: null,
        date: null,
        history: []
      });
    }, 35000);

    async function tryExtract() {
      if (resolved) return;
      attempts++;
      try {
        const result = await win.webContents.executeJavaScript(extractJs);
        const data = JSON.parse(result);

        if (!data.error && data.price !== null && data.price !== undefined) {
          finish({
            id: commodity.id,
            price: data.price,
            date: data.date || null,
            history: data.history || [],
            historyDays: data.historyDays || historyDays,
            error: null,
            source: data.source || null
          });
          return;
        }

        if (attempts < maxAttempts) {
          pollTimer = setTimeout(tryExtract, pollIntervalMs);
          return;
        }

        finish({
          id: commodity.id,
          price: data.price !== undefined ? data.price : null,
          date: data.date || null,
          history: data.history || [],
          historyDays: data.historyDays || historyDays,
          error: data.error || '無法取得走勢資料',
          source: data.source || null
        });
      } catch (e) {
        if (attempts < maxAttempts) {
          pollTimer = setTimeout(tryExtract, pollIntervalMs);
        } else {
          finish({
            id: commodity.id,
            error: e.message,
            price: null,
            date: null,
            history: []
          });
        }
      }
    }

    win.webContents.on('did-finish-load', () => {
      pollTimer = setTimeout(tryExtract, initialDelayMs);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      finish({
        id: commodity.id,
        error: errorDescription,
        price: null,
        date: null,
        history: []
      });
    });

    win.loadURL(commodity.url, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
  });
}

// IPC: 開啟外部瀏覽器
ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

// IPC: 取得商品列表
ipcMain.handle('get-commodities', () => {
  return COMMODITIES;
});

// IPC: 抓取單一商品數據
ipcMain.handle('fetch-commodity', async (event, commodityId, historyDays = 60) => {
  const commodity = COMMODITIES.find(c => c.id === commodityId);
  if (!commodity) return { error: '找不到商品', history: [] };
  return await fetchCommodityData(commodity, historyDays);
});

// IPC: 抓取所有商品數據（並行）
ipcMain.handle('fetch-all', async (event, historyDays = 60) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    for (const commodity of COMMODITIES) {
      mainWindow.webContents.send('fetch-progress', {
        id: commodity.id,
        status: 'loading'
      });
    }
  }

  const entries = await Promise.all(
    COMMODITIES.map(async (commodity) => {
      const result = await fetchCommodityData(commodity, historyDays);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('fetch-progress', {
          id: commodity.id,
          status: 'done',
          data: result
        });
      }
      return [commodity.id, result];
    })
  );

  return Object.fromEntries(entries);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
