import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const DEFAULT_API = import.meta.env.PROD
  ? "https://stock-monitor-backend-one.vercel.app"
  : "/api";
const API = import.meta.env.VITE_API_URL || DEFAULT_API;
const RECENT_KEY = "stockmonitor-recent";
const PERIODS = [
  ["1M", 22], ["6M", 126], ["1Yr", 252], ["3Yr", 252], ["5Yr", 252], ["10Yr", 252], ["Max", 9999]
];

const money = (value, currency = "") => {
  if (value == null) return "—";
  const sym = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[currency] || "";
  return `${sym} ${Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
};

const compact = (value, currency = "") => {
  if (value == null) return "—";
  const sym = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[currency] || "";
  return `${sym} ${Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 }).format(value)}`;
};

const percent = (value, ratio = false) => {
  if (value == null) return "—";
  return `${(ratio ? value * 100 : value).toFixed(2)} %`;
};

const fmtTime = (d = new Date()) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

const loadRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};

const saveRecent = (item) => {
  const list = [item, ...loadRecent().filter((r) => r.ticker !== item.ticker)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  return list;
};

export default function App() {
  const [page, setPage] = useState("home");
  const [viewSource, setViewSource] = useState("home");
  const [watchlist, setWatchlist] = useState([]);
  const [movers, setMovers] = useState({ gainers: [], losers: [] });
  const [recent, setRecent] = useState(loadRecent);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("Max");

  const loadWatchlist = async () => {
    try { setWatchlist((await axios.get(`${API}/watchlist`)).data); }
    catch { setWatchlist([]); }
  };

  const loadMovers = async () => {
    try { setMovers((await axios.get(`${API}/stocks/movers`)).data); }
    catch { setMovers({ gainers: [], losers: [] }); }
  };

  const loadDetail = async (ticker) => {
    setLoading(true);
    setDetail(null);
    try {
      setDetail((await axios.get(`${API}/stocks/${encodeURIComponent(ticker)}`)).data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlist();
    loadMovers();
    const timer = setInterval(loadMovers, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError("");
      return;
    }
    setSearching(true);
    setSearchError("");
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API}/stocks/search`, { params: { q: query } });
        setResults(data);
        if (!data.length) setSearchError("No stocks found.");
      } catch {
        setResults([]);
        setSearchError("Search unavailable.");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const viewStock = async (ticker, meta = {}, source = "home") => {
    setViewSource(source);
    setPage(source);
    setSelected(ticker);
    setQuery("");
    setResults([]);
    setPeriod("Max");
    if (meta.ticker) setRecent(saveRecent(meta));
    await loadDetail(ticker);
  };

  const clearStock = () => {
    setSelected(null);
    setDetail(null);
  };

  const goHome = () => {
    setPage("home");
    setViewSource("home");
    clearStock();
    setQuery("");
    setResults([]);
  };

  const goWatchlist = () => {
    setPage("watchlist");
    setViewSource("watchlist");
    clearStock();
    loadWatchlist();
  };

  const addToWatchlist = async () => {
    if (!detail) return;
    try {
      await axios.post(`${API}/watchlist`, { ticker: detail.ticker });
      loadWatchlist();
      const updated = (await axios.get(`${API}/stocks/${encodeURIComponent(detail.ticker)}`)).data;
      setDetail(updated);
    } catch { /* ignore */ }
  };

  const openInWatchlist = () => {
    setPage("watchlist");
    setViewSource("watchlist");
  };

  const stockPage = selected ? (
    <StockPage
      detail={detail}
      loading={loading}
      period={period}
      setPeriod={setPeriod}
      viewSource={viewSource}
      onBack={clearStock}
      onAddToWatchlist={addToWatchlist}
      onOpenInWatchlist={openInWatchlist}
    />
  ) : null;

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-50 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <span className="text-lg font-bold text-ink">stockmonitor</span>
          <nav className="flex gap-1">
            <NavBtn active={page === "home"} onClick={goHome}>Home</NavBtn>
            <NavBtn active={page === "watchlist"} onClick={goWatchlist}>Watchlist</NavBtn>
          </nav>
        </div>
      </header>

      {page === "home" && (
        selected ? stockPage : (
          <HomePage
            query={query}
            setQuery={setQuery}
            results={results}
            searching={searching}
            searchError={searchError}
            recent={recent}
            movers={movers}
            onPick={(item) => viewStock(item.ticker, item, "home")}
            onRecent={(item) => viewStock(item.ticker, item, "home")}
          />
        )
      )}

      {page === "watchlist" && (
        selected ? stockPage : (
          <WatchlistPage
            watchlist={watchlist}
            onOpen={(item) => viewStock(item.ticker, item, "watchlist")}
          />
        )
      )}
    </div>
  );
}

function NavBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${active ? "bg-brand text-white" : "text-muted hover:bg-brand-light hover:text-brand"}`}
    >
      {children}
    </button>
  );
}

function HomePage({ query, setQuery, results, searching, searchError, recent, movers, onPick, onRecent }) {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section>
        <h1 className="mb-4 text-xl font-bold">Search stocks</h1>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a company"
            className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          {query && (
            <div className="absolute top-full right-0 left-0 z-10 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
              {searching ? (
                <p className="p-4 text-center text-sm text-muted">Searching…</p>
              ) : results.length ? (
                results.map((item, i) => (
                  <button
                    key={item.ticker}
                    onClick={() => onPick(item)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-brand-light ${i ? "border-t border-line" : ""}`}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{item.name}</span>
                      <span className="text-xs text-muted">{item.ticker}</span>
                    </span>
                    <span className="text-xs text-muted">{item.exchange}</span>
                  </button>
                ))
              ) : (
                <p className="p-4 text-center text-sm text-muted">{searchError || "No results"}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">Recent search</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((item) => (
              <button
                key={item.ticker}
                onClick={() => onRecent(item)}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand"
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <MoverBlock title="Top gainers" items={movers.gainers} positive onPick={onPick} />
        <MoverBlock title="Top losers" items={movers.losers} onPick={onPick} />
      </section>
    </main>
  );
}

function MoverBlock({ title, items, positive, onPick }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <h2 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No data available.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.ticker}>
              <button
                onClick={() => onPick(item)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-cream"
              >
                <span>
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="text-xs text-muted">{item.ticker}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold">{money(item.price, item.currency)}</span>
                  <span className={`text-xs font-semibold ${positive ? "text-gain" : "text-loss"}`}>
                    {item.changePercent >= 0 ? "+" : ""}{item.changePercent?.toFixed(2)}%
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WatchlistPage({ watchlist, onOpen }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-xl font-bold">Watchlist</h1>
      {watchlist.length === 0 ? (
        <p className="text-sm text-muted">No stocks in watchlist. Search from Home and add stocks.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {watchlist.map((item) => (
            <li key={item.ticker}>
              <button
                onClick={() => onOpen(item)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-brand-light/50"
              >
                <span>
                  <span className="block font-semibold">{item.name}</span>
                  <span className="text-sm text-muted">{item.ticker} · {item.exchange}</span>
                </span>
                <span className="text-right">
                  <span className="block font-bold">{money(item.live?.price, item.live?.currency)}</span>
                  {item.live?.changePercent != null && (
                    <span className={`text-xs font-semibold ${item.live.changePercent >= 0 ? "text-gain" : "text-loss"}`}>
                      {item.live.changePercent >= 0 ? "+" : ""}{item.live.changePercent.toFixed(2)}%
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StockPage({ detail, loading, period, setPeriod, viewSource, onBack, onAddToWatchlist, onOpenInWatchlist }) {
  const chartData = useMemo(() => {
    if (!detail?.history?.length) return [];
    const days = PERIODS.find(([p]) => p === period)?.[1] ?? 9999;
    return detail.history.slice(-days);
  }, [detail, period]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted">Loading…</div>;
  if (!detail) return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-loss">Stock not found.</div>;

  const snap = detail.snapshot;
  const up = Number(detail.changePercent) >= 0;
  const backLabel = viewSource === "home" ? "← Home" : "← Watchlist";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <button onClick={onBack} className="mb-4 text-sm font-medium text-brand hover:underline">{backLabel}</button>

      <section className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">{detail.name}</h1>
          <p className="mt-1 text-sm text-brand">{detail.exchange} · {detail.ticker}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-bold">{money(detail.price, detail.currency)}</p>
          {detail.changePercent != null && (
            <p className={`text-sm font-semibold ${up ? "text-gain" : "text-loss"}`}>
              {up ? "▲" : "▼"} {percent(detail.changePercent)}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">{detail.updatedAt ? fmtTime(new Date(detail.updatedAt)) : fmtTime()}</p>
          {viewSource === "home" && (
            detail.watchlisted ? (
              <button
                onClick={onOpenInWatchlist}
                className="mt-3 rounded border border-line bg-white px-4 py-2 text-xs font-bold tracking-wide text-brand uppercase hover:bg-brand-light"
              >
                Open in watchlist
              </button>
            ) : (
              <button
                onClick={onAddToWatchlist}
                className="mt-3 rounded bg-brand px-4 py-2 text-xs font-bold tracking-wide text-white uppercase hover:bg-brand-dark"
              >
                Add to watchlist
              </button>
            )
          )}
        </div>
      </section>

      <section className="mb-4 overflow-hidden rounded-lg border border-line bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-3">
          <Metric label="Market Cap" value={compact(detail.marketCap, detail.currency)} />
          <Metric label="Current Price" value={money(detail.price, detail.currency)} highlight />
          <Metric label="High / Low" value={`${money(detail.high52, detail.currency)} / ${money(detail.low52, detail.currency)}`} />
          <Metric label="Stock P/E" value={detail.pe?.toFixed?.(2) ?? "—"} highlight />
          <Metric label="Book Value" value={money(detail.bookValue, detail.currency)} />
          <Metric label="ROE" value={percent(detail.roe, true)} />
          <Metric label="ROCE" value={percent(detail.roce, true)} highlight />
          <Metric label="Dividend Yield" value={percent(detail.dividendYield, true)} />
          <Metric label="Face Value" value={detail.faceValue != null ? money(detail.faceValue, detail.currency) : "—"} />
        </div>
        {snap?.timestamp && (
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            DB snapshot {new Date(snap.timestamp).toLocaleString("en-IN")}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="mb-4 flex flex-wrap gap-1">
          {PERIODS.map(([p]) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${period === p ? "bg-brand-light text-brand ring-1 ring-brand/30" : "text-muted hover:bg-cream"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <PriceChart data={chartData} currency={detail.currency} exchange={detail.exchange} />
      </section>
    </main>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div className={`border-b border-r border-line p-4 sm:nth-[3n]:border-r-0 ${highlight ? "bg-brand-light/60" : ""}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function PriceChart({ data, currency, exchange }) {
  if (!data || data.length < 2) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted">Chart unavailable</div>;
  }

  const prices = data.map((d) => d.close);
  const volumes = data.map((d) => d.volume || 0);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;
  const vMax = Math.max(...volumes, 1);

  const pricePoints = data.map((d, i) =>
    `${(i / (data.length - 1)) * 100},${78 - ((d.close - pMin) / pRange) * 68}`
  ).join(" ");

  return (
    <div>
      <p className="mb-2 text-right text-xs text-muted">Price on {exchange || "NSE"}</p>
      <div className="relative h-72">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const h = ((d.volume || 0) / vMax) * 18;
            return <rect key={i} x={x - 0.3} y={92 - h} width={0.6} height={h} fill="#93c5fd" opacity=".7" />;
          })}
          {[20, 40, 60, 80].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e5e7eb" strokeWidth=".3" vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={pricePoints} fill="none" stroke="#6f3ff5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-sm bg-brand" /> Price</span>
        <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-sm bg-sky-300" /> Volume</span>
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span className="text-muted">{money(prices[0], currency)}</span>
        <span className={prices.at(-1) >= prices[0] ? "font-semibold text-gain" : "font-semibold text-loss"}>
          {money(prices.at(-1), currency)}
        </span>
      </div>
    </div>
  );
}

function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}
