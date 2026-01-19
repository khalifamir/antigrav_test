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
    // State
    let isIndexView = false;
    const toggleBtn = document.getElementById('view-toggle');
    const tabsContainer = document.getElementById('tabs');

    // Initial Load
    loadWidget("MYX:MAYBANK");

    // Toggle View Handler
    toggleBtn.addEventListener('click', () => {
        isIndexView = !isIndexView;

        if (isIndexView) {
            // Switch to Index Mode
            toggleBtn.textContent = "Switch to Top 5 Stocks";
            tabsContainer.style.display = 'none';
            // Try Bursa Malaysia Exchange prefix directly
            loadWidget("MYX:FBMKLCI");
        } else {
            // Switch to Top 5 Mode
            toggleBtn.textContent = "Switch to Top 30 Index";
            tabsContainer.style.display = 'flex';
            // Reset to first tab
            const firstTab = document.querySelector('.tab-btn[data-symbol="MYX:MAYBANK"]');
            if (firstTab) firstTab.click();
        }
    });

    // Handle Tab Clicks (only active in Top 5 mode)
    const tabs = document.querySelectorAll('.tab-btn:not(#view-toggle)');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (isIndexView) return; // Should not happen if tabs are hidden, but safety first

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
