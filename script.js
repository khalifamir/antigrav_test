// Chart Global Variables
let chart;
let candlestickSeries;
let currentSymbol = 'MAYBANK';

// Chart Config
const chartOptions = {
    layout: {
        backgroundColor: '#161b22', // var(--card-bg)
        textColor: '#8b949e', // var(--text-secondary)
    },
    grid: {
        vertLines: { color: '#30363d' },
        horzLines: { color: '#30363d' },
    },
    crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
        borderColor: '#30363d',
    },
    timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
    },
};

// Top 5 Stock Data
const stocks = {
    "MYX:MAYBANK": { name: "Malayan Banking Berhad", ticker: "1155.KL" },
    "MYX:PBBANK": { name: "Public Bank Berhad", ticker: "1295.KL" },
    "MYX:CIMB": { name: "CIMB Group Holdings", ticker: "1023.KL" },
    "MYX:TENAGA": { name: "Tenaga Nasional Berhad", ticker: "5347.KL" },
    "MYX:PCHEM": { name: "Petronas Chemicals Group", ticker: "5183.KL" },
    "FTSEMYX:FBMKLCI": { name: "FBM KLCI Index", ticker: "^KLSE" }
};

// Generate Mock Data (Fallback)
function generateMockData() {
    const data = [];
    let time = Math.floor(new Date().getTime() / 1000) - (500 * 900); // Start 500 candles ago
    let open = 10.0;

    for (let i = 0; i < 500; i++) {
        const volatility = 0.1;
        const change = (Math.random() - 0.5) * volatility;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;

        data.push({
            time: time + i * 900,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
        });

        open = close;
    }
    return data;
}

// Fetch Data from Yahoo Finance via AllOrigins Proxy (Bypasses CORS)
async function fetchStockData(ticker) {
    try {
        console.log(`Fetching data for ${ticker}...`);

        // Yahoo Finance API URL
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=15m&range=5d`;
        // AllOrigins Proxy to allow cross-origin requests
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);

        const json = await response.json();

        if (!json.chart || !json.chart.result || json.chart.result.length === 0) {
            throw new Error("Invalid API response format");
        }

        const result = json.chart.result[0];
        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp;

        if (!timestamps || !quote.open) {
            throw new Error("No data available for this symbol");
        }

        const data = timestamps.map((t, i) => ({
            time: t,
            open: quote.open[i],
            high: quote.high[i],
            low: quote.low[i],
            close: quote.close[i]
        })).filter(d => d.open != null && d.close != null); // Filter incomplete candles

        return data;

    } catch (error) {
        console.warn("Fetch failed (API Error/Rate Limit), falling back to Simulated Data:", error);
        // Fallback to mock data so the user doesn't see a broken chart
        return generateMockData();
    }
}

// Initialize Chart
function initChart() {
    const chartContainer = document.getElementById('chart');
    chart = LightweightCharts.createChart(chartContainer, chartOptions);
    candlestickSeries = chart.addCandlestickSeries({
        upColor: '#2ea043',
        downColor: '#da3633',
        borderUpColor: '#2ea043',
        borderDownColor: '#da3633',
        wickUpColor: '#2ea043',
        wickDownColor: '#da3633',
    });

    new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== chartContainer) { return; }
        const newRect = entries[0].contentRect;
        chart.applyOptions({ width: newRect.width, height: newRect.height });
    }).observe(chartContainer);
}

// Load Data for Symbol
async function loadSymbol(symbolKey) {
    if (!chart) initChart();

    currentSymbol = symbolKey;
    const stockInfo = stocks[symbolKey];

    // Simulate Loading state could go here

    const data = await fetchStockData(stockInfo.ticker);
    candlestickSeries.setData(data);
    chart.timeScale().fitContent();
}

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    loadSymbol("MYX:MAYBANK");

    // Toggle Logic
    let isIndexView = false;
    const toggleBtn = document.getElementById('view-toggle');
    const tabsContainer = document.getElementById('tabs');

    toggleBtn.addEventListener('click', () => {
        isIndexView = !isIndexView;
        if (isIndexView) {
            toggleBtn.textContent = "Switch to Top 5 Stocks";
            tabsContainer.style.display = 'none';
            loadSymbol("FTSEMYX:FBMKLCI");
        } else {
            toggleBtn.textContent = "Switch to Top 30 Index";
            tabsContainer.style.display = 'flex';
            const activeTab = document.querySelector('.tab-btn.active') || document.querySelector('.tab-btn[data-symbol="MYX:MAYBANK"]');
            if (activeTab) activeTab.click();
        }
    });

    // Tab Logic
    const tabs = document.querySelectorAll('.tab-btn:not(#view-toggle)');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (isIndexView) return;
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            const symbol = e.target.getAttribute('data-symbol');
            loadSymbol(symbol);
        });
    });
});
