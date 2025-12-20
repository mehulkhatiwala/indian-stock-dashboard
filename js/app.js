const throttle = {};
const THROTTLE_MS = 60000;

const val = (f) => f?.value ?? f;
let STOCK_DATA = [];
const DARK_MODE_KEY = "dark_mode";

const UI_STATE_KEY = "stock_ui_state";
let currentSort = {
    key: null,
    order: "desc"
};

let currentSearch = "";

function saveUIState() {
    localStorage.setItem(
        "stock_ui_state",
        JSON.stringify({
            search: currentSearch,
            sortKey: currentSort.key,
            sortOrder: currentSort.order,
        })
    );
}

function getUIState() {
    return JSON.parse(localStorage.getItem(UI_STATE_KEY)) || {};
}

function debounce(fn, delay = 100) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

$(document).ready(() => {
    const saved = getUIState();
    
    if (saved.search) {
        currentSearch = saved.search;
        $("#searchInput").val(saved.search);
    }

    if (saved.sortKey) {
        currentSort.key = saved.sortKey;
        currentSort.order = saved.sortOrder || "desc";

        updateSortUI();
    }

    loadStocks();
    $("#searchInput").on("input", debounce(
        function () {
            currentSearch = $(this).val().toLowerCase();
            saveUIState({
                search: currentSearch,
                sortKey: currentSort.key,
                sortOrder: currentSort.order
            });
            applyFiltersAndSort();
        }, 100)
    );

    $(".sort-btn").on("click", function () {
        const key = $(this).data("key");
        
        if (currentSort.key === key) {
            currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
        } else {
            currentSort.key = key;
            currentSort.order = "desc";
        }
        saveUIState({
            search: currentSearch,
            sortKey: currentSort.key,
            sortOrder: currentSort.order
        });
        updateSortUI();
        applyFiltersAndSort();
    });

    $("#refreshBtn").on("click", function() {
        refreshDataOnly();
    });
    $("#resetFilters").on("click", () => {
        resetUIState();
        loadStocks();
    });

    const darkEnabled = localStorage.getItem(DARK_MODE_KEY) === "1";
    applyDarkMode(darkEnabled);
    // Toggle on click
    $(".darkModeToggle").on("click", function () {
        $("body").toggleClass("dark-mode");

        const isDark = $("body").hasClass("dark-mode");
        localStorage.setItem("theme", isDark ? "dark" : "light");

        updateDarkModeIcon(isDark);
    });

    setInterval(loadStocks, 30000);
});

function loadStocks() {
    const c = $("#stockContainer").empty();
    $("#loading").show();

    fetchBulkStocks()
        .then((stocks) => {
            stocks.forEach((stock) => {
                STOCK_DATA = stocks.filter(s => !s.error);
                applyFiltersAndSort();
            });
        })
        .always(() => $("#loading").hide());
}

function renderStockList(list) {
    const container = $("#stockContainer").empty();

    list.forEach((stock) => {
        renderCard(stock);
        enhanceDayRange(stock.ticker);
    });
}

function applyFiltersAndSort() {
    let list = [...STOCK_DATA];

    // Search
    if (currentSearch) {
        list = list.filter(
            (s) =>
                s.company_name.toLowerCase().includes(currentSearch) ||
                s.symbol.toLowerCase().includes(currentSearch) ||
                (s.sector || "").toLowerCase().includes(currentSearch)
        );
    }

    // Sort
    if (currentSort.key) {
        list.sort((a, b) => {
            let va, vb;

            if (currentSort.key === "price") {
                va = val(a.last_price);
                vb = val(b.last_price);
            } else if (currentSort.key === "change") {
                va = val(a.percent_change);
                vb = val(b.percent_change);
            } else {
                va = val(a.market_cap);
                vb = val(b.market_cap);
            }

            return currentSort.order === "asc" ? va - vb : vb - va;
        });
    }

    renderStockList(list);
}

function renderCard(s) {
    const pct = val(s.percent_change);
    const marketCapText = s.market_cap ? val(s.market_cap).toLocaleString() : "—";
    const sectorText = s.sector || "N/A";

    let changeClass = "text-muted";
    let iconClass = "bi-dash";
    let cardClass = "";

    if (pct > 0) {
        changeClass = "text-success";
        iconClass = "bi-arrow-up-right";
        cardClass = "positive";
    } else if (pct < 0) {
        changeClass = "text-danger";
        iconClass = "bi-arrow-down-right";
        cardClass = "negative";
    }

    $("#stockContainer").append(`
        <div class="col-lg-3 col-md-6 col-sm-12 mb-4 d-flex">
            <div class="card stock-card h-100 ${cardClass}" data-symbol="${s.ticker}">
                <div class="card-body d-flex flex-column">

                    <!-- HEADER -->
                    <div class="card-header-block">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="fw-bold mb-0 company-name">${s.company_name}</h6>
                            <span class="badge sector-badge">${sectorText}</span>
                        </div>
                        <small class="text-muted">${s.symbol} • ${s.exchange}</small>
                    </div>

                    <!-- PRICE -->
                    <div class="price-block mt-2">
                        <div class="fs-4 fw-semibold price">
                            ₹${val(s.last_price).toFixed(2)}
                        </div>

                        <div class="${changeClass} fw-semibold d-flex align-items-center gap-1">
                            <i class="bi ${iconClass}" aria-hidden="true"></i>
                            ${pct.toFixed(2)}%
                            <span class="small">(${val(s.change)})</span>
                        </div>
                    </div>

                    <!-- METRICS -->
                    <div class="card-metrics small mt-3 mt-auto">
                        <div class="d-flex justify-content-between">
                            <span class="text-muted">Market Cap</span>
                            <span class="fw-semibold">₹${marketCapText}</span>
                        </div>

                        <div class="d-flex justify-content-between">
                            <span class="text-muted">High</span>
                            <span class="high fw-semibold">₹--</span>
                        </div>

                        <div class="d-flex justify-content-between">
                            <span class="text-muted">Low</span>
                            <span class="low fw-semibold">₹--</span>
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

    if (!high || !low || high === low) return;

    card.find(".high").text(`₹${high}`);
    card.find(".low").text(`₹${low}`);
}

function updateSortUI() {
    // Reset all buttons
    $(".sort-btn").removeClass("active");
    $(".sort-indicator").text("");

    // Reset mobile dropdown
    $(".dropdown-item.sort-btn").removeClass("active");

    if (!currentSort.key) return;

    // Activate correct button(s)
    $(`.sort-btn[data-key="${currentSort.key}"]`)
        .addClass("active")
        .find(".sort-indicator")
        .text(currentSort.order === "asc" ? "↑" : "↓");

    let sortTextMobile = currentSort.key
        ? `Sorted by ${prettyKey(currentSort.key)} (${currentSort.order})`
        : "";

    if (sortTextMobile) {
        $("#activeSortLabel")
            .text(sortTextMobile)
            .show();
    } else {
        $("#activeSortLabel").hide();
    }
}

function prettyKey(key) {
    if (key === "marketCap") return "Market Capitalization ";
    if (key === "change") return "Percentage Change ";
    if (key === "price") return "Current Live Price (LTP)";
}

function resetUIState() {
    localStorage.removeItem(UI_STATE_KEY);

    currentSearch = "";
    currentSort = { key: null, order: "desc" };

    $("#searchInput").val("");
    $(".sort-indicator").text("");
    $(".sort-btn").removeClass("active");
    $("#activeSortLabel").hide();
}

function refreshDataOnly() {
    loadStocks();
}

function applyDarkMode(enabled) {
  document.body.classList.toggle("dark-mode", enabled);
  localStorage.setItem(DARK_MODE_KEY, enabled ? "1" : "0");

  $(".darkModeToggle i")
    .toggleClass("bi-moon", !enabled)
    .toggleClass("bi-sun", enabled);
}

function updateDarkModeIcon(isDark) {
    const iconClass = isDark ? "bi-sun" : "bi-moon";

    $(".darkModeToggle i")
        .removeClass("bi-sun bi-moon")
        .addClass(iconClass);
}

$("#mobileSearchFocus").on("click", () => {
    $("#searchInput").focus();
});