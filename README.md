# Indian Stock Price Dashboard
A web-based dashboard displaying real-time prices of top Indian stocks using **HTML, Bootstrap, jQuery, and Docker**.


## Features
- Displays **Top 10 Indian NSE stocks**
- Bulk stock data fetch for fast initial load
- Lazy-loaded **Day High / Day Low** per stock
- **Arrow indicators** for price movement (▲ / ▼)
- Sector tagging with badges
- Market Cap display with proper units
- Mini High–Low visual range support
- Manual refresh + auto refresh (30s)
- API throttling to prevent over-fetching
- Client-side caching using `localStorage`
- Fully responsive (desktop, tablet, mobile)
- Dockerized using **Nginx**

## Tech Stack
- HTML5
- Bootstrap 5
- jQuery
- Docker + Nginx

> jQuery is intentionally used for simplicity since the dataset is fixed and UI complexity is moderate.

---

## API Used
This project uses the open-source **Indian Stock Market API by 0xramm**.
- Base URL: https://nse-api-sand.vercel.app
- Public API (no authentication required)
- Designed specifically for Indian NSE stocks
- Simple REST endpoints
- Client-side caching is implemented to handle temporary API unavailability

## Run with Docker

```bash
docker build -t stock-dashboard .
docker run -p 8080:80 stock-dashboard

# Open: http://localhost:8080


## Data Fetching Strategy
- Bulk stock data is fetched using `/stock/list` for fast initial rendering.
- Day High and Day Low are not available in the bulk endpoint.
- These values are lazily fetched per stock using `/stock`.

### Performance Optimizations
- Per-stock API calls are throttled to avoid unnecessary requests.
- Day range data is cached in `localStorage`.
- UI updates progressively without blocking initial render.

This approach balances performance, API efficiency, and user experience.
```

## Project Structure
stock-dashboard/
│
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js
│   ├── api.js
│   └── app.js
├── Dockerfile
├── nginx.conf
└── README.md
