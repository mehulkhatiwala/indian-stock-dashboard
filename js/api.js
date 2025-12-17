const BASE_URL = "/api";

function fetchBulkStocks() {
    return $.getJSON(`${BASE_URL}/stock/list`, {
        symbols: STOCKS.join(","),
        res: "val",
    })
    .then((res) => {
        localStorage.setItem("bulk_cache", JSON.stringify(res.stocks));
        return res.stocks;
    })
    .catch(() => {
        return JSON.parse(localStorage.getItem("bulk_cache")) || [];
    });
}

function fetchDayRange(symbol) {
    const key = `range_${symbol}`;

    return $.getJSON(`${BASE_URL}/stock`, {
        symbol,
        res: "val",
    })
    .then((res) => {
        const range = {
            high: res.data.day_high,
            low: res.data.day_low,
        };
        localStorage.setItem(key, JSON.stringify(range));
        return range;
    })
    .catch(() => {
        return JSON.parse(localStorage.getItem(key));
    });
}
