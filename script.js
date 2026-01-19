// Global State
let currentSymbol = 'MYX:MAYBANK';
let currentInterval = '15m';
let currentRange = '5d';
let stockCache = {};

// Top 5 Stock Data + Index
const stocks = {
    "MYX:MAYBANK": { name: "Malayan Banking Berhad", ticker: "1155.KL" },
    "MYX:PBBANK": { name: "Public Bank Berhad", ticker: "1295.KL" },
    "MYX:CIMB": { name: "CIMB Group Holdings", ticker: "1023.KL" },
    "MYX:TENAGA": { name: "Tenaga Nasional Berhad", ticker: "5347.KL" },
    "MYX:PCHEM": { name: "Petronas Chemicals Group", ticker: "5183.KL" },
    "FTSEMYX:FBMKLCI": { name: "FBM KLCI Index", ticker: "^KLSE" }
};

// 1. Data Fetching
async function fetchStockData(symbolKey, interval, range) {
    const stockInfo = stocks[symbolKey];
    const ticker = stockInfo.ticker;
    const cacheKey = `${ticker}_${interval}_${range}`;

    if (stockCache[cacheKey]) {
        console.log(`Loading ${cacheKey} from cache...`);
        return stockCache[cacheKey];
    }

    console.log(`Fetching ${ticker} (${interval})...`);
    try {
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const json = await response.json();
        const result = json.chart.result?.[0];

        if (!result) throw new Error("Invalid structure");

        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp;

        // Process OHLC
        const data = timestamps.map((t, i) => ({
            time: t,
            open: quote.open[i],
            high: quote.high[i],
            low: quote.low[i],
            close: quote.close[i]
        })).filter(d => d.open != null && d.close != null);

        stockCache[cacheKey] = data;
        return data;

    } catch (e) {
        console.warn(`Fetch failed for ${ticker}:`, e);
        return generateFallbackData(interval);
    }
}

function generateFallbackData(interval) {
    const data = [];
    const now = Math.floor(Date.now() / 1000);
    let step = 900; // 15m
    if (interval === '60m') step = 3600;
    if (interval === '1d') step = 86400;

    let price = 10.0;
    for (let i = 0; i < 50; i++) {
        const change = (Math.random() - 0.5) * 0.2;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.abs(change) * 0.5;
        const low = Math.min(open, close) - Math.abs(change) * 0.5;

        data.push({
            time: now - (50 - i) * step,
            open, high, low, close
        });
        price = close;
    }
    return data;
}

// 2. Candlestick Renderer
function drawChart(data) {
    const canvas = document.getElementById('stockChart');
    const ctx = canvas.getContext('2d');

    // HiDPI Resizing
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    // Calc Range
    const allPrices = [];
    data.forEach(d => { allPrices.push(d.low, d.high); });
    const minPrice = Math.min(...allPrices) * 0.999;
    const maxPrice = Math.max(...allPrices) * 1.001;
    const range = maxPrice - minPrice;

    // Grid
    drawGrid(ctx, width, height);

    // Candles
    const candleWidth = (width / data.length) * 0.7;
    // Ensure minimal visibility
    const finalCandleWidth = Math.max(candleWidth, 1);

    data.forEach((d, i) => {
        const x = (i / (data.length)) * width + (width / data.length) / 2; // Center alignment

        const yOpen = height - ((d.open - minPrice) / range) * height;
        const yClose = height - ((d.close - minPrice) / range) * height;
        const yHigh = height - ((d.high - minPrice) / range) * height;
        const yLow = height - ((d.low - minPrice) / range) * height;

        // Color
        const isGreen = d.close >= d.open;
        ctx.fillStyle = isGreen ? '#2ea043' : '#da3633'; // Green : Red
        ctx.strokeStyle = ctx.fillStyle;

        // Draw Wick
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Draw Body
        // If close == open (doji), draw mild height
        let bodyHeight = Math.abs(yClose - yOpen);
        if (bodyHeight < 1) bodyHeight = 1;

        const bodyTop = Math.min(yOpen, yClose);

        ctx.fillRect(x - finalCandleWidth / 2, bodyTop, finalCandleWidth, bodyHeight);
    });

    // Info Text
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '12px Inter';
    ctx.fillText(`${currentSymbol} (${currentInterval})`, 10, height - 10);
    ctx.fillText(maxPrice.toFixed(2), width - 40, 15);
    ctx.fillText(minPrice.toFixed(2), width - 40, height - 5);
}

function drawGrid(ctx, w, h) {
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    // 4 horizontal lines
    for (let i = 1; i < 5; i++) {
        const y = (h / 5) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();
}

// 3. UI Logic
async function loadView(symbolKey) {
    currentSymbol = symbolKey;
    const data = await fetchStockData(symbolKey, currentInterval, currentRange);
    drawChart(data);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    refresh();

    // Resize
    window.addEventListener('resize', refresh);

    // Toggle Index View
    const toggleBtn = document.getElementById('view-toggle');
    const tabsContainer = document.getElementById('tabs');
    let isIndexView = false;

    toggleBtn.addEventListener('click', () => {
        isIndexView = !isIndexView;
        if (isIndexView) {
            toggleBtn.textContent = "Switch to Top 5";
            tabsContainer.style.display = 'none';
            loadView("FTSEMYX:FBMKLCI");
        } else {
            toggleBtn.textContent = "Switch to Index";
            tabsContainer.style.display = 'flex';
            const activeTab = document.querySelector('.tab-btn.active');
            const symbol = activeTab ? activeTab.getAttribute('data-symbol') : "MYX:MAYBANK";
            loadView(symbol);
        }
    });

    // Tab Clicks
    document.querySelectorAll('.tab-btn:not(#view-toggle)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (isIndexView) return;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            loadView(e.target.getAttribute('data-symbol'));
        });
    });

    // Interval Clicks
    document.querySelectorAll('.interval-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update Active UI
            document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update State
            currentInterval = e.target.getAttribute('data-interval');
            currentRange = e.target.getAttribute('data-range');

            // Reload Data
            refresh();
        });
    });
});

function refresh() {
    loadView(currentSymbol);
}
