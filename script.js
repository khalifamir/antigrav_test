// Global State
let currentSymbol = 'MAYBANK';
let chartData = [];
const stockCache = {}; // Cache to prevent API spam (429 Errors)

// Top 5 Stock Data + Index
const stocks = {
    "MYX:MAYBANK": { name: "Malayan Banking Berhad", ticker: "1155.KL" },
    "MYX:PBBANK": { name: "Public Bank Berhad", ticker: "1295.KL" },
    "MYX:CIMB": { name: "CIMB Group Holdings", ticker: "1023.KL" },
    "MYX:TENAGA": { name: "Tenaga Nasional Berhad", ticker: "5347.KL" },
    "MYX:PCHEM": { name: "Petronas Chemicals Group", ticker: "5183.KL" },
    "FTSEMYX:FBMKLCI": { name: "FBM KLCI Index", ticker: "^KLSE" }
};

// 1. Data Fetching (Yahoo Finance + Proxy + Caching)
async function fetchStockData(symbolKey) {
    const stockInfo = stocks[symbolKey];
    const ticker = stockInfo.ticker;

    // Check Cache first
    if (stockCache[ticker]) {
        console.log(`Loading ${ticker} from cache...`);
        return stockCache[ticker];
    }

    console.log(`Fetching data for ${ticker}...`);
    try {
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=15m&range=5d`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const json = await response.json();
        const result = json.chart.result?.[0];

        if (!result) throw new Error("Invalid structure");

        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp;

        // processing
        const data = timestamps.map((t, i) => ({
            time: t,
            price: quote.close[i] // Using close price for simple line chart
        })).filter(d => d.price != null);

        // Save to cache
        stockCache[ticker] = data;
        return data;

    } catch (e) {
        console.warn(`Fetch failed for ${ticker}:`, e);
        // Minimal fallback just to keep app running if API fails hard
        return generateFallbackData();
    }
}

function generateFallbackData() {
    // Just a simple sine wave to show *something* if Internet/API is dead
    const data = [];
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 100; i++) {
        data.push({
            time: now - (100 - i) * 900,
            price: 10 + Math.sin(i * 0.1)
        });
    }
    return data;
}

// 2. Raw Canvas Chart Renderer
function drawChart(data) {
    const canvas = document.getElementById('stockChart');
    const ctx = canvas.getContext('2d');

    // Resize canvas to fit container (HiDPI friendly)
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

    if (data.length === 0) {
        ctx.fillStyle = "#8b949e";
        ctx.font = "16px Inter";
        ctx.fillText("No Data Available", width / 2 - 50, height / 2);
        return;
    }

    // Callcs
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices) * 0.999;
    const maxPrice = Math.max(...prices) * 1.001;
    const priceRange = maxPrice - minPrice;

    // Draw Grid
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horz lines
    for (let i = 1; i < 5; i++) {
        const y = (height / 5) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Draw Graph Line
    ctx.beginPath();
    ctx.strokeStyle = "#58a6ff"; // Accent Blue
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    for (let i = 0; i < data.length; i++) {
        const d = data[i];

        // X coord: Normalize time index (0 to 1) -> width
        const x = (i / (data.length - 1)) * width;

        // Y coord: Normalize price (0 to 1) -> height (inverted because canvas Y is down)
        const normalizedPrice = (d.price - minPrice) / priceRange;
        const y = height - (normalizedPrice * height); // Invert
        // Add minimal padding so it doesn't touch edges
        const paddedY = height - 20 - (normalizedPrice * (height - 40));

        if (i === 0) ctx.moveTo(x, paddedY);
        else ctx.lineTo(x, paddedY);
    }
    ctx.stroke();

    // Draw simple gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(88, 166, 255, 0.2)");
    gradient.addColorStop(1, "rgba(88, 166, 255, 0.0)");

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Text Labels (Max/Min Price)
    ctx.fillStyle = "#8b949e";
    ctx.font = "12px Inter";
    ctx.fillText(maxPrice.toFixed(2), 5, 20);
    ctx.fillText(minPrice.toFixed(2), 5, height - 10);

    // Current Price (Last point)
    const lastPrice = prices[prices.length - 1];
    ctx.fillStyle = "#f0f6fc";
    ctx.font = "bold 14px Inter";
    ctx.fillText(`Current: ${lastPrice.toFixed(2)}`, width - 100, 20);
}

// 3. UI Logic
async function loadView(symbolKey) {
    currentSymbol = symbolKey;
    const data = await fetchStockData(symbolKey);
    drawChart(data);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initial
    loadView("MYX:MAYBANK");

    // Resize Listener
    window.addEventListener('resize', () => {
        // Redraw with current cache
        if (stockCache[stocks[currentSymbol].ticker]) {
            drawChart(stockCache[stocks[currentSymbol].ticker]);
        }
    });

    // Toggle Logic
    let isIndexView = false;
    const toggleBtn = document.getElementById('view-toggle');
    const tabsContainer = document.getElementById('tabs');

    toggleBtn.addEventListener('click', () => {
        isIndexView = !isIndexView;
        if (isIndexView) {
            toggleBtn.textContent = "Switch to Top 5 Stocks";
            tabsContainer.style.display = 'none';
            loadView("FTSEMYX:FBMKLCI");
        } else {
            toggleBtn.textContent = "Switch to Top 30 Index";
            tabsContainer.style.display = 'flex';
            const activeTab = document.querySelector('.tab-btn.active'); // Keep previous active
            const symbol = activeTab ? activeTab.getAttribute('data-symbol') : "MYX:MAYBANK";
            loadView(symbol);
        }
    });

    // Valid Tabs
    document.querySelectorAll('.tab-btn:not(#view-toggle)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (isIndexView) return;

            // Update Active UI
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Load
            loadView(e.target.getAttribute('data-symbol'));
        });
    });
});
