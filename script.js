// Global State
let currentSymbol = 'MYX:MAYBANK';
let currentInterval = '15m'; // 15m, 60m, 1d, 1wk, 1mo
let currentRange = '5d';
let stockCache = {};
let chartData = [];

// Interactive State
let viewState = {
    offset: 0,      // How many candles shifted from the right
    candleWidth: 10,
    isDragging: false,
    dragStartX: 0,
    dragStartOffset: 0,
    crosshair: { x: -1, y: -1, visible: false }
};

// Layout Config
const layout = {
    padding: { top: 20, right: 60, bottom: 30, left: 10 }
};

// Top 5 Market Cap + Index
const stocks = {
    "MYX:MAYBANK": { name: "Maybank", ticker: "1155.KL" },
    "MYX:PBBANK": { name: "Public Bank", ticker: "1295.KL" },
    "MYX:CIMB": { name: "CIMB Group", ticker: "1023.KL" },
    "MYX:TENAGA": { name: "Tenaga Nasional", ticker: "5347.KL" },
    "MYX:PCHEM": { name: "Petronas Chemicals", ticker: "5183.KL" },
    "FTSEMYX:FBMKLCI": { name: "FBM KLCI Index", ticker: "^KLSE" }
};

// ---------------------------------------------------------
// 1. DATA FETCHING (Unchanged logic, robust)
// ---------------------------------------------------------
async function fetchStockData(symbolKey, interval, range) {
    const stockInfo = stocks[symbolKey];
    const ticker = stockInfo.ticker;
    const cacheKey = `${ticker}_${interval}_${range}`;

    if (stockCache[cacheKey]) {
        return stockCache[cacheKey];
    }

    // Adjust candle width based on density
    if (interval === '1d' || interval === '1wk') viewState.candleWidth = 15;
    else viewState.candleWidth = 8;
    viewState.offset = 0; // Reset view on load

    console.log(`Fetching ${ticker}...`);
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

        const data = timestamps.map((t, i) => ({
            time: t,
            open: quote.open[i],
            high: quote.high[i],
            low: quote.low[i],
            close: quote.close[i]
        })).filter(d => d.open != null);

        stockCache[cacheKey] = data;
        return data;

    } catch (e) {
        console.error(`Fetch failed for ${ticker}:`, e);
        // User explicitly requested NO MOCK DATA.
        return [];
    }
}

function generateFallbackData(interval) {
    // Robust fallback
    const data = [];
    let now = Math.floor(Date.now() / 1000);
    let step = 900;
    if (interval === '1d') step = 86400;

    let price = 10.0;
    for (let i = 0; i < 100; i++) {
        let chg = (Math.random() - 0.5) * 0.2;
        let o = price;
        let c = o + chg;
        let h = Math.max(o, c) + Math.random() * 0.1;
        let l = Math.min(o, c) - Math.random() * 0.1;
        data.push({ time: now - (100 - i) * step, open: o, high: h, low: l, close: c });
        price = c;
    }
    return data;
}

// ---------------------------------------------------------
// 2. CHART RENDERER (New Interactive Engine)
// ---------------------------------------------------------
function render() {
    const canvas = document.getElementById('stockChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Auto-Resize
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const W = rect.width;
    const H = rect.height;

    // Clear
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#161b22"; // Background
    ctx.fillRect(0, 0, W, H);

    if (chartData.length === 0) {
        ctx.fillStyle = "#8b949e";
        ctx.fillText("Loading or No Data...", W / 2 - 40, H / 2);
        return;
    }

    // Dimensions
    const plotW = W - layout.padding.left - layout.padding.right;
    const plotH = H - layout.padding.top - layout.padding.bottom;

    // Viewport Calculations
    const visibleCandlesCount = Math.ceil(plotW / viewState.candleWidth);
    const maxOffset = Math.max(0, chartData.length - visibleCandlesCount);
    // Clamp offset
    if (viewState.offset < 0) viewState.offset = 0;
    if (viewState.offset > maxOffset) viewState.offset = maxOffset;

    // Slice visible data
    // We render from right to left conceptually, but slice normally
    // index 0 of data is OLD, index length-1 is NEW.
    // We want to show [end - offset - count] to [end - offset]
    const endIndex = Math.floor(chartData.length - viewState.offset);
    const startIndex = Math.max(0, endIndex - visibleCandlesCount - 1); // -1 for padding

    const visibleData = chartData.slice(startIndex, endIndex);

    // Calculate Min/Max Price for scaling (Auto-Scale Y)
    let minP = Infinity, maxP = -Infinity;
    visibleData.forEach(d => {
        if (d.low < minP) minP = d.low;
        if (d.high > maxP) maxP = d.high;
    });
    // Add padding to price range
    const range = maxP - minP;
    minP -= range * 0.1;
    maxP += range * 0.1;
    const safeRange = maxP - minP || 1;

    // Helper: Map Price to Y (pixels)
    const getY = (price) => {
        return layout.padding.top + plotH - ((price - minP) / safeRange) * plotH;
    };
    // Helper: Map Index to X (pixels)
    const getX = (i) => {
        return layout.padding.left + (i * viewState.candleWidth);
    };

    // ----------------------
    // Draw Grid & Axes
    // ----------------------
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 1;
    ctx.font = "11px Inter";
    ctx.fillStyle = "#8b949e";
    ctx.textAlign = "right";

    // Y Axis Grid
    const gridRows = 5;
    ctx.beginPath();
    for (let i = 0; i <= gridRows; i++) {
        const val = minP + (safeRange * (i / gridRows));
        const y = getY(val);

        ctx.moveTo(layout.padding.left, y);
        ctx.lineTo(W - layout.padding.right, y); // Grid line

        // Label (Right Side)
        ctx.fillText(val.toFixed(2), W - 5, y + 4);
    }
    ctx.stroke();

    // X Axis Labels (Time)
    ctx.textAlign = "center";
    ctx.beginPath();
    const xStep = Math.ceil(visibleData.length / 5); // Show ~5 labels
    visibleData.forEach((d, i) => {
        if (i % xStep === 0) {
            const x = getX(i) + viewState.candleWidth / 2;
            ctx.moveTo(x, layout.padding.top);
            ctx.lineTo(x, H - layout.padding.bottom);

            // Format Date
            const date = new Date(d.time * 1000);
            let label = "";
            if (currentInterval.includes('m') || currentInterval.includes('h')) {
                label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
            ctx.fillText(label, x, H - 10);
        }
    });
    // ctx.stroke(); // Daintier grid for time? Maybe skip vertical lines to reduce clutter

    // ----------------------
    // Draw Candles
    // ----------------------
    const candleW = viewState.candleWidth * 0.8;
    const wickW = Math.max(1, candleW * 0.1);

    visibleData.forEach((d, i) => {
        const xCenter = getX(i) + viewState.candleWidth / 2;
        const yOpen = getY(d.open);
        const yClose = getY(d.close);
        const yHigh = getY(d.high);
        const yLow = getY(d.low);

        const isGreen = d.close >= d.open;
        ctx.fillStyle = isGreen ? '#2ea043' : '#da3633';
        ctx.strokeStyle = ctx.fillStyle;

        // Wick
        ctx.beginPath();
        ctx.moveTo(xCenter, yHigh);
        ctx.lineTo(xCenter, yLow);
        ctx.stroke();

        // Body
        let hBody = Math.abs(yClose - yOpen);
        if (hBody < 1) hBody = 1;
        let yBody = Math.min(yOpen, yClose);

        ctx.fillRect(xCenter - candleW / 2, yBody, candleW, hBody);
    });

    // ----------------------
    // Current Price Line & Label
    // ----------------------
    if (chartData.length > 0) {
        const lastCandle = chartData[chartData.length - 1];
        const currentPrice = lastCandle.close;
        const cpY = getY(currentPrice);

        // Only draw if within reasonable bounds
        if (cpY >= -50 && cpY <= H + 50) {
            // Line
            ctx.strokeStyle = "#58a6ff"; // Blue accent
            ctx.setLineDash([2, 2]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(layout.padding.left, cpY);
            ctx.lineTo(W - layout.padding.right, cpY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = "#58a6ff";
            const labelH = 20;
            const labelY = Math.max(0, Math.min(H - labelH, cpY - labelH / 2)); // Clamp to screen vert

            // Draw axis badge
            ctx.beginPath();
            ctx.moveTo(W - layout.padding.right, cpY);
            ctx.lineTo(W - layout.padding.right + 5, labelY);
            ctx.lineTo(W, labelY);
            ctx.lineTo(W, labelY + labelH);
            ctx.lineTo(W - layout.padding.right + 5, labelY + labelH);
            ctx.closePath();
            ctx.fill();

            // Text
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "left";
            ctx.font = "bold 11px Inter";
            ctx.fillText(currentPrice.toFixed(2), W - layout.padding.right + 8, labelY + 14);
        }
    }

    // ----------------------
    // Crosshair
    // ----------------------
    if (viewState.crosshair.visible) {
        const mx = viewState.crosshair.x;
        const my = viewState.crosshair.y;

        // Only draw if inside chart area
        if (mx > layout.padding.left && mx < W - layout.padding.right &&
            my > layout.padding.top && my < H - layout.padding.bottom) {

            ctx.strokeStyle = "#8b949e";
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;

            // Horizontal Line
            ctx.beginPath();
            ctx.moveTo(layout.padding.left, my);
            ctx.lineTo(W - layout.padding.right, my);
            ctx.stroke();

            // Vertical Line
            // Snap to closest candle
            // Inverse X calc: i = (x - padding) / width
            const relX = mx - layout.padding.left;
            let index = Math.floor(relX / viewState.candleWidth);
            if (index >= 0 && index < visibleData.length) {
                const candle = visibleData[index];
                const cx = getX(index) + viewState.candleWidth / 2;

                // Vert Line
                ctx.beginPath();
                ctx.moveTo(cx, layout.padding.top);
                ctx.lineTo(cx, H - layout.padding.bottom);
                ctx.stroke();

                ctx.setLineDash([]);

                // --- Labels ---
                const priceVal = minP + (1 - (my - layout.padding.top) / plotH) * safeRange;
                const timeVal = new Date(candle.time * 1000).toLocaleString();

                // Y-Label Box
                ctx.fillStyle = "#30363d";
                ctx.fillRect(W - layout.padding.right, my - 10, 55, 20);
                ctx.fillStyle = "#fff";
                ctx.textAlign = "left";
                ctx.fillText(priceVal.toFixed(2), W - layout.padding.right + 5, my + 4);

                // X-Label Box
                const textW = ctx.measureText(timeVal).width + 10;
                ctx.fillStyle = "#30363d";
                ctx.fillRect(cx - textW / 2, H - 25, textW, 20);
                ctx.fillStyle = "#fff";
                ctx.textAlign = "center";
                ctx.fillText(timeVal, cx, H - 10);

                // Overlay Info (Top Left)
                ctx.textAlign = "left";
                ctx.fillStyle = "#c9d1d9";
                const info = `O: ${candle.open.toFixed(2)}  H: ${candle.high.toFixed(2)}  L: ${candle.low.toFixed(2)}  C: ${candle.close.toFixed(2)}`;
                ctx.fillText(info, layout.padding.left + 10, layout.padding.top + 15);
            }
        }
    }
}

// ---------------------------------------------------------
// 3. INTERACTION HANDLERS
// ---------------------------------------------------------
function setupInteraction() {
    const canvas = document.getElementById('stockChart');

    // Mouse Move (Crosshair + Drag)
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (viewState.isDragging) {
            const dx = x - viewState.dragStartX;
            // Drag RIGHT (positive dx) = see OLDER data (increase offset)
            // Use 0.5x sensitivity for smoother feel
            const offsetChange = (dx / viewState.candleWidth) * 0.5;
            viewState.offset = Math.max(0, viewState.dragStartOffset + offsetChange);
            render();
        } else {
            viewState.crosshair = { x, y, visible: true };
            render();
        }
    });

    canvas.addEventListener('mousedown', e => {
        viewState.isDragging = true;
        const rect = canvas.getBoundingClientRect();
        viewState.dragStartX = e.clientX - rect.left;
        viewState.dragStartOffset = viewState.offset;
        canvas.style.cursor = "grabbing";
    });

    const stopDrag = () => {
        viewState.isDragging = false;
        canvas.style.cursor = "crosshair";
    };
    window.addEventListener('mouseup', stopDrag);
    canvas.addEventListener('mouseleave', () => {
        viewState.crosshair.visible = false;
        render(); // clear crosshair
    });

    // Zoom (Wheel)
    canvas.addEventListener('wheel', e => {
        e.preventDefault();

        const zoomIntensity = 0.1;
        const delta = Math.sign(e.deltaY);

        // Zoom IN (Scroll Up, delta < 0) -> Increase width
        // Zoom OUT (Scroll Down, delta > 0) -> Decrease width

        let newWidth = viewState.candleWidth;
        if (delta < 0) {
            newWidth = viewState.candleWidth * (1 + zoomIntensity);
        } else {
            newWidth = viewState.candleWidth * (1 - zoomIntensity);
        }

        // Clamp
        if (newWidth < 2) newWidth = 2;       // Max Zoom Out (~2px candles)
        if (newWidth > 100) newWidth = 100;   // Max Zoom In

        viewState.candleWidth = newWidth;
        render();
    }, { passive: false });
}

// ---------------------------------------------------------
// 4. APP LOGIC
// ---------------------------------------------------------
async function loadView(symbolKey) {
    currentSymbol = symbolKey;
    chartData = await fetchStockData(symbolKey, currentInterval, currentRange);
    render();
}

document.addEventListener('DOMContentLoaded', () => {
    setupInteraction();
    loadView("MYX:MAYBANK");

    // UI Buttons
    document.getElementById('view-toggle').addEventListener('click', function () {
        // Toggle Logic
        let isIndex = this.textContent.includes('Index'); // currently showing index?
        // Wait, text says "Switch to..."
        isIndex = this.textContent.includes('Top 5'); // If "Switch to Top 5", we ARE in Index

        if (isIndex) {
            // Switch to Normal
            this.textContent = "Switch to Top 30 Index";
            document.getElementById('tabs').style.display = 'flex';
            loadView("MYX:MAYBANK");
        } else {
            // Switch to Index
            this.textContent = "Switch to Top 5 Stocks";
            document.getElementById('tabs').style.display = 'none';
            loadView("FTSEMYX:FBMKLCI");
        }
    });

    document.querySelectorAll('.tab-btn:not(#view-toggle)').forEach(b => {
        b.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            loadView(e.target.dataset.symbol);
        });
    });

    document.querySelectorAll('.interval-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            document.querySelectorAll('.interval-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentInterval = e.target.dataset.interval;
            currentRange = e.target.dataset.range;
            loadView(currentSymbol);
        });
    });

    window.addEventListener('resize', render);
});
