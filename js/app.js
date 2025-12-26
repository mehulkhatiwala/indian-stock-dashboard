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
        const enabled = !document.body.classList.contains("dark-mode");
        applyDarkMode(enabled);
    });

    setInterval(loadStocks, 30000);
    $("#mobileSearchFocus").on("click", () => {
        $("#searchInput").focus();
    });
});

function loadStocks() {
    const c = $("#stockContainer").empty();
    $("#loading").css("display", "flex");
    $("body").addClass("loading-active");

    // Disable navbar controls while loading (buttons and links)
    const $navBtns = $(".navbar .btn, .navbar .dropdown-toggle");
    $navBtns.prop("disabled", true).addClass("disabled");
    const $navLinks = $(".navbar .nav-link");
    $navLinks.attr("aria-disabled", "true").addClass("disabled");

    // Disable mobile bottom-bar controls while loading
    const $mobileBtns = $(".mobile-bottom-bar .btn, .mobile-bottom-bar .dropdown-toggle");
    $mobileBtns.prop("disabled", true).addClass("disabled");
    const $mobileLinks = $(".mobile-bottom-bar .dropdown-item");
    $mobileLinks.attr("aria-disabled", "true").addClass("disabled");

    fetchBulkStocks()
        .then((stocks) => {
            stocks.forEach((stock) => {
                STOCK_DATA = stocks.filter(s => !s.error);

                if (STOCK_DATA.length === 0) {
                    $("#stockContainer").empty();
                    showEmptyState("No stock data available at the moment.");
                }

                hideEmptyState();
                applyFiltersAndSort();
            });
        })
        .fail((xhr) => {
            $("#stockContainer").empty();
            if (xhr.status === 404) {
                showEmptyState("Unable to fetch stock data (404). Please try again later.", "warning");
            } else if (xhr.status === 429) {
                showEmptyState("Too many requests. Please wait a moment and try again.", "error");
            } else if (xhr.status === 402) {
                showEmptyState("Data service is temporarily paused. Please try again later.", "error");
            } else if (xhr.status >= 500) {
                showEmptyState("Server error while fetching stock data. Please try again shortly." , "error");
            } else {
                showEmptyState("Unable to fetch stock data. Please check your connection.", "warning");
            }
        })
        .always(() => {
            $("#loading").css("display", "none");
            $("body").removeClass("loading-active");

            // Re-enable navbar controls after loading
            $navBtns.prop("disabled", false).removeClass("disabled");
            $navLinks.removeAttr("aria-disabled").removeClass("disabled");

            // Re-enable mobile bottom-bar controls
            $mobileBtns.prop("disabled", false).removeClass("disabled");
            $mobileLinks.removeAttr("aria-disabled").removeClass("disabled");
        });
}

function renderStockList(list) {
    $("#stockContainer").empty();

    list.forEach((stock) => {
        renderCard(stock);
        enhanceDayRange(stock.ticker);
    });
}

function applyFiltersAndSort() {
    let list = [...STOCK_DATA];

    // Search
    if (currentSearch) {
        list = list.filter((s) => {
            const hay = `${s.company_name || ""} ${s.symbol || ""} ${s.exchange || ""} ${s.sector || ""}`.toLowerCase();
            return hay.includes(currentSearch);
        });
    }

    // If nothing matches, show empty state and return
    if (!list.length) {
        $("#stockContainer").empty();
        showEmptyState("No stocks match your search.", "warning");
        return;
    }

    hideEmptyState();

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

    // Search term exists highlighting logic
    const highlightedName = highlight(s.company_name || '', currentSearch);
    const highlightedBadge = highlight(sectorText, currentSearch);
    const highlightedMeta = highlight(`${s.symbol || ''} • ${s.exchange || ''}`, currentSearch);

    $("#stockContainer").append(`
        <div class="col-lg-3 col-md-6 col-sm-12 mb-4 d-flex">
            <div class="card stock-card h-100 ${cardClass}" data-symbol="${s.ticker}">
                <div class="card-body d-flex flex-column">

                    <!-- HEADER -->
                    <div class="card-header-block">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="fw-bold mb-0 company-name">${highlightedName}</h6>
                            <span class="badge sector-badge">${highlightedBadge}</span>
                        </div>
                        <small class="text-muted">${highlightedMeta}</small>
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
    document.body.classList.add("theme-animating");
    setTimeout(() => document.body.classList.remove("theme-animating"), 420);

    document.body.classList.toggle("dark-mode", enabled);
    localStorage.setItem(DARK_MODE_KEY, enabled ? "1" : "0");

    const $icon = $(".darkModeToggle i");
    $icon.addClass("rotating");
    updateDarkModeIcon(enabled);
    setTimeout(() => $icon.removeClass("rotating"), 520);
}

function updateDarkModeIcon(isDark) {
    const iconClass = isDark ? "bi-sun" : "bi-moon";

    $(".darkModeToggle i")
        .removeClass("bi-sun bi-moon")
        .addClass(iconClass);
}


function showEmptyState(message, type = "info") {
    const iconMap = {
        info:  { icon: "bi-info-circle",    color: "text-primary" },
        warning: { icon: "bi-exclamation-triangle", color: "text-warning" },
        error: { icon: "bi-x-circle",       color: "text-danger" }
    };

    const { icon, color } = iconMap[type] || iconMap.info;

    $("#emptyState").html(`
        <div class="d-flex align-items-center justify-content-center gap-2">
            <i class="bi ${icon} ${color} fs-5" aria-hidden="true"></i>
            <span>${message}</span>
        </div>
    `).show();
}

function hideEmptyState() {
    $("#emptyState").hide();
}

// --- Search highlighting helpers ---
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text, term) {
    if (!text) return '';
    const safe = escapeHtml(text);
    if (!term) return safe;
    try {
        const re = new RegExp(escapeRegExp(term), 'gi');
        return safe.replace(re, (m) => `<mark class="search-highlight">${m}</mark>`);
    } catch (e) {
        return safe;
    }
}