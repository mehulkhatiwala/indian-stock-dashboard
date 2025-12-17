const throttle = {};
const THROTTLE_MS = 60000;

const val = (f) => f?.value ?? f;

$(document).ready(() => {
    loadStocks();
    $("#refreshBtn").on("click", loadStocks);
    setInterval(loadStocks, 30000);
});

function loadStocks() {
    const c = $("#stockContainer").empty();
    $("#loading").show();

    fetchBulkStocks()
        .then((stocks) => {
            stocks.forEach((stock) => {
                if (stock.error) return;
                renderCard(stock);
                enhanceDayRange(stock.ticker);
            });
        })
        .always(() => $("#loading").hide());
}

function renderCard(s) { 
    const pct = val(s.percent_change); 
    const marketCapText = s.market_cap ? `${val(s.market_cap).toLocaleString()}` : "—";
    const sectorText = s.sector || "N/A";
    let changeClass = "text-muted";
    let arrow = "→";

    if (pct > 0) {
        changeClass = "text-success";
        arrow = "▲";
    } else if (pct < 0) {
        changeClass = "text-danger";
        arrow = "▼";
    }
    $("#stockContainer").append(`
        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
            <div class="card stock-card h-100" data-symbol="${s.ticker}">
                <div class="card-body d-flex flex-column">

                    <div class="card-header-block">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="fw-bold mb-0">${s.company_name}</h6>
                            <span class="badge bg-light text-dark">${sectorText}</span>
                        </div>
                        <small class="text-muted">${s.symbol} • ${s.exchange}</small>
                    </div>

                    <hr class="my-2">

                    <!-- Price -->
                    <div class="fs-4 fw-semibold price">
                        ₹&nbsp;${val(s.last_price).toFixed(2)}
                    </div>

                    <!-- Change -->
                    <div class="${changeClass} fw-semibold mb-2">
                        ${arrow} ${pct.toFixed(2)}%
                        <span class="small">(${val(s.change)})</span>
                    </div>

                    <!-- Market Cap -->
                    <div class="d-flex justify-content-between small mt-2">
                        <span class="text-muted">Market Cap</span>
                        <span class="fw-semibold text-dark">₹${marketCapText}</span>
                    </div>

                    <!-- Day High / Low -->
                    <div class="mt-3 small">
                        <div class="d-flex justify-content-between">
                            <span class="text-muted">High</span>
                            <span class="high fw-semibold">--</span>
                        </div>

                        <div class="d-flex justify-content-between">
                            <span class="text-muted">Low</span>
                            <span class="low fw-semibold">--</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `); 
}


function enhanceDayRange(symbol) {
    const card = $(`[data-symbol="${symbol}"]`);
    if (!card.length) return;

    // Read cached data first
    const cached = JSON.parse(localStorage.getItem(`range_${symbol}`));
    if (cached) {
        updateRangeUI(card, cached);
    }

    // Throttle only API calls
    const now = Date.now();
    if (throttle[symbol] && now - throttle[symbol] < THROTTLE_MS) {
        return;
    }

    throttle[symbol] = now;

    // Fetch fresh data
    fetchDayRange(symbol).then((r) => {
        if (!r) return;

        localStorage.setItem(`range_${symbol}`, JSON.stringify(r));
        updateRangeUI(card, r);
    });
}

function updateRangeUI(card, r) {
    const price = Number(card.find(".fs-4").text().replace("₹", ""));
    const high = val(r.high);
    const low = val(r.low);

    console.log(`Price: ${price}, high: ${high}, low: ${low}`);
    

    if (!high || !low || high === low) return;

    card.find(".high").text(`₹${high}`);
    card.find(".low").text(`₹${low}`);

    // const pct = ((price - low) / (high - low)) * 100;
    // card.find(".progress-bar").css("width", `${Math.min(Math.max(pct, 0), 100)}%`);
}
