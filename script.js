// Initial Widget Config
const widgetConfig = {
    "autosize": true,
    "symbol": "MYX:MAYBANK",
    "interval": "15",
    "timezone": "Asia/Kuala_Lumpur",
    "theme": "dark",
    "style": "1",
    "locale": "en",
    "toolbar_bg": "#f1f3f6",
    "enable_publishing": false,
    "allow_symbol_change": false,
    "container_id": "tradingview_widget_container"
};

let widget = null;

function loadWidget(symbol) {
    // Update config symbol
    const config = { ...widgetConfig, symbol: symbol };

    // Check if TradingView script is loaded
    if (typeof TradingView !== 'undefined') {
        new TradingView.widget(config);
    } else {
        console.error("TradingView library not loaded.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize first chart
    loadWidget("MYX:MAYBANK");

    // Handle Tab Clicks
    const tabs = document.querySelectorAll('.tab-btn');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Remove active class from all
            tabs.forEach(t => t.classList.remove('active'));
            // Add to click target
            e.target.classList.add('active');

            // Get symbol
            const symbol = e.target.getAttribute('data-symbol');

            // Reload widget
            loadWidget(symbol);
        });
    });
});
