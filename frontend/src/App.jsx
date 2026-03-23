import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  BarChart3,
  Brain,
  Check,
  ChevronRight,
  Copy,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  Wifi,
  WifiOff,
  Download,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const PLOTLY_CDN = "https://cdn.plot.ly/plotly-2.32.0.min.js";
let plotlyLoader;

const unwrapMarkdownFence = (text) => {
  const raw = String(text || "").trim();
  const fenced = raw.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : raw).trim();
};

const MARKDOWN_RESPONSE_KEYS = new Set([
  "analysis",
  "case_file",
  "narrative",
  "insight",
  "description",
  "suggestion",
]);

const sanitizeApiPayload = (value, parentKey = "") => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeApiPayload(item, parentKey));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeApiPayload(v, k)]),
    );
  }

  if (typeof value === "string" && MARKDOWN_RESPONSE_KEYS.has(parentKey)) {
    return unwrapMarkdownFence(value);
  }

  return value;
};

const ensurePlotlyLoaded = () => {
  if (typeof window !== "undefined" && window.Plotly) {
    return Promise.resolve(window.Plotly);
  }
  if (plotlyLoader) {
    return plotlyLoader;
  }

  plotlyLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PLOTLY_CDN;
    script.async = true;
    script.onload = () => resolve(window.Plotly);
    script.onerror = () => reject(new Error("Failed to load Plotly"));
    document.head.appendChild(script);
  });

  return plotlyLoader;
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, options);
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return sanitizeApiPayload(data || {});
};

const api = {
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return requestJson("/upload", { method: "POST", body: fd });
  },
  analyze: (id) =>
    requestJson("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: id }),
    }),
  query: (id, q) =>
    requestJson("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: id, query: q }),
    }),
  visualize: (id) =>
    requestJson("/visualize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: id }),
    }),
  detective: (id) =>
    requestJson("/detective", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: id }),
    }),
  cleanup: (id) =>
    requestJson("/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: id }),
    }),
  health: () => requestJson("/health"),
};

const icons = {
  upload: <UploadCloud className="h-4 w-4" />,
  grid: <LayoutDashboard className="h-4 w-4" />,
  brain: <Brain className="h-4 w-4" />,
  chat: <MessageSquare className="h-4 w-4" />,
  bar: <BarChart3 className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  send: <Send className="h-3.5 w-3.5" />,
  spark: <Sparkles className="h-3.5 w-3.5" />,
  trash: <Trash2 className="h-4 w-4" />,
  arrow: <ChevronRight className="h-3.5 w-3.5" />,
  copy: <Copy className="h-3 w-3" />,
  check: <Check className="h-3 w-3" />,
  spin: <Loader2 className="h-4 w-4 animate-spin-smooth" />,
  zap: <Activity className="h-3.5 w-3.5" />,
  wifi: <Wifi className="h-3.5 w-3.5" />,
  wifiOff: <WifiOff className="h-3.5 w-3.5" />,
  download: <Download className="h-3.5 w-3.5" />,
};

const Spin = () => <span>{icons.spin}</span>;

const Pill = ({ children, variant = "slate" }) => {
  const v = {
    slate: "bg-slate-800 text-slate-400 border-slate-700",
    indigo: "bg-indigo-950/70 text-indigo-300 border-indigo-800",
    rose: "bg-rose-950/60 text-rose-300 border-rose-800/60",
    emerald: "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
    amber: "bg-amber-950/60 text-amber-300 border-amber-800/60",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${v[variant]}`}>{children}</span>;
};

const Err = ({ msg }) => (
  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/25 border border-rose-800/40 text-rose-300 text-sm">
    <span className="mt-0.5 shrink-0 text-rose-500">!</span>
    {msg}
  </div>
);

const Empty = ({ icon, title, body, cta }) => (
  <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
    <div className="text-5xl opacity-20 select-none">{icon}</div>
    <p className="text-slate-300 font-semibold text-base">{title}</p>
    {body && <p className="text-slate-600 text-sm max-w-xs">{body}</p>}
    {cta}
  </div>
);

const PrimaryBtn = ({ onClick, disabled, loading, icon, children }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-all hover-glow"
  >
    {loading ? <Spin /> : icon}
    {children}
  </button>
);

const GhostBtn = ({ onClick, disabled, children, className = "" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-xs font-mono transition-all disabled:opacity-40 ${className}`}
  >
    {children}
  </button>
);

const CopyBtn = ({ text }) => {
  const [ok, setOk] = useState(false);
  const go = async () => {
    await navigator.clipboard.writeText(text || "");
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  };
  return (
    <button onClick={go} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-300 text-xs font-mono transition-colors">
      {ok ? <>{icons.check}<span>Copied</span></> : <>{icons.copy}<span>Copy</span></>}
    </button>
  );
};

const SectionHead = ({ title, sub, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3 sm:gap-4">
    <div>
      <h2 className="text-lg font-display font-bold text-slate-100">{title}</h2>
      {sub && <p className="text-slate-500 text-sm mt-0.5">{sub}</p>}
    </div>
    {action && <div className="self-start">{action}</div>}
  </div>
);

const MarkdownBlock = ({ content }) => (
  <div className="md content-guard">
    <ReactMarkdown>{unwrapMarkdownFence(content)}</ReactMarkdown>
  </div>
);

const Loader = ({ text = "AI agents are working..." }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-5">
    <div className="relative w-14 h-14">
      <div className="absolute inset-0 rounded-full border border-slate-800" />
      <div className="absolute inset-0 rounded-full border border-transparent border-t-indigo-500 animate-spin-smooth" />
      <div className="absolute inset-2 rounded-full border border-transparent border-t-indigo-400/40 animate-spin-smooth" style={{ animationDirection: "reverse", animationDuration: "1.4s" }} />
    </div>
    <div className="text-center">
      <p className="text-slate-300 text-sm font-medium">{text}</p>
      <p className="text-slate-600 text-xs font-mono mt-1">deepseek-v3 via openrouter</p>
    </div>
  </div>
);

const Chart = React.memo(({ data, height = 320 }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !data) {
      return;
    }
    let cancelled = false;

    const render = async () => {
      try {
        const Plotly = await ensurePlotlyLoaded();
        if (cancelled || !Plotly || !ref.current) {
          return;
        }
        Plotly.newPlot(
          ref.current,
          data.data || [],
          {
            ...(data.layout || {}),
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(15,23,42,0.5)",
            font: { color: "#94a3b8", family: "IBM Plex Mono", size: 11 },
            margin: { t: 36, r: 14, b: 44, l: 50 },
            height,
            legend: { bgcolor: "rgba(0,0,0,0)", bordercolor: "#1e293b", font: { size: 11 } },
            xaxis: { gridcolor: "#1e293b", zerolinecolor: "#334155", tickfont: { size: 10 }, ...(data.layout?.xaxis || {}) },
            yaxis: { gridcolor: "#1e293b", zerolinecolor: "#334155", tickfont: { size: 10 }, ...(data.layout?.yaxis || {}) },
          },
          { responsive: true, displayModeBar: false },
        );
      } catch (e) {
        console.warn("Plotly render error", e);
      }
    };

    render();

    return () => {
      cancelled = true;
      try {
        if (window.Plotly && ref.current) {
          window.Plotly.purge(ref.current);
        }
      } catch {
        // noop
      }
    };
  }, [data, height]);

  return <div ref={ref} className="w-full" />;
});

const Table = ({ cols, rows, pageSize = 10 }) => {
  const [pg, setPg] = useState(0);
  const total = Math.ceil(rows.length / pageSize);
  const slice = rows.slice(pg * pageSize, pg * pageSize + pageSize);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800">
              {cols.map((c) => (
                <th key={c} className="px-3 py-2.5 text-left text-slate-500 font-mono uppercase tracking-wider whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr key={i} className="border-b border-slate-900/80 hover:bg-slate-900/40 transition-colors">
                {cols.map((c) => (
                  <td key={`${i}-${c}`} className="px-3 py-2 font-mono text-slate-400 max-w-[220px] break-words whitespace-normal sm:whitespace-nowrap sm:truncate">
                    {row[c] == null ? <span className="text-slate-700 italic">null</span> : String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 px-1 gap-2">
          <span className="text-slate-600 text-xs font-mono">{pg * pageSize + 1}-{Math.min((pg + 1) * pageSize, rows.length)} of {rows.length}</span>
          <div className="flex gap-1">
            <GhostBtn onClick={() => setPg((p) => Math.max(0, p - 1))} disabled={pg === 0}>Prev</GhostBtn>
            <span className="px-2.5 py-1 text-xs font-mono text-slate-600">{pg + 1}/{total}</span>
            <GhostBtn onClick={() => setPg((p) => Math.min(total - 1, p + 1))} disabled={pg === total - 1}>Next</GhostBtn>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, sub, variant = "default" }) => {
  const border = { default: "border-slate-800", indigo: "border-indigo-900/60", rose: "border-rose-900/50", emerald: "border-emerald-900/50", amber: "border-amber-900/50" };
  const color = { default: "text-slate-200", indigo: "text-indigo-300", rose: "text-rose-400", emerald: "text-emerald-400", amber: "text-amber-400" };
  return (
    <div className={`bg-slate-900 rounded-xl p-5 border ${border[variant]} hover-glow transition-all`}>
      <p className="text-slate-600 text-xs font-mono uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-mono font-bold ${color[variant]}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-1.5 font-mono">{sub}</p>}
    </div>
  );
};

const Upload = ({ onDone, isBackendOnline }) => {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  const handle = async (file) => {
    if (!file || !isBackendOnline) {
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "tsv", "xlsx", "sql"].includes(ext)) {
      setErr(`Unsupported format .${ext || "unknown"}`);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const res = await api.upload(file);
      if (res.error || !res.success) {
        throw new Error(res.error || "Upload failed");
      }
      onDone(res.dataset_id, res.profile, file.name);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 py-10 sm:py-16 animate-fade-in">
      <div className="mb-11 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/70 border border-indigo-900/60 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-dot" />
          <span className="text-indigo-400 text-xs font-mono tracking-widest">DEEPSEEK V3 - OPENROUTER</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-display font-black text-slate-50 tracking-tight mb-3">
          Data<span className="text-indigo-400">Detective</span>
        </h1>
        <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
          Drop any tabular dataset and get instant AI-powered intelligence with analysis, queries, charts, and anomaly detection.
        </p>
      </div>

      <div className="w-full max-w-xl">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handle(e.dataTransfer.files?.[0]);
          }}
          onClick={() => !busy && fileRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-16 text-center transition-all duration-200 bg-slate-900/50 ${drag ? "drag-over" : "border-slate-700 hover:border-slate-600 hover:bg-slate-900/70"}`}
        >
          <input ref={fileRef} type="file" className="hidden" accept=".csv,.tsv,.xlsx,.sql" onChange={(e) => handle(e.target.files?.[0])} />

          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 bg-indigo-600/10 rounded-full blur-3xl" />
          </div>

          <div className="relative">
            <div className={`w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-5 transition-all ${drag ? "border-indigo-600 bg-indigo-950/40" : ""}`}>
              {busy ? <Spin /> : <UploadCloud className="h-8 w-8 text-indigo-300" />}
            </div>
            {busy ? (
              <div>
                <p className="text-slate-200 font-bold text-lg mb-1">Ingesting dataset...</p>
                <p className="text-slate-500 text-sm font-mono">Computing statistical profile</p>
              </div>
            ) : (
              <div>
                <p className="text-slate-100 font-bold text-lg mb-1">Drop your dataset here</p>
                <p className="text-slate-500 text-sm mb-5">or click to browse</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {[".csv", ".tsv", ".xlsx", ".sql"].map((f) => (
                    <span key={f} className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-xs font-mono">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {err && <div className="mt-4"><Err msg={err} /></div>}

        {!isBackendOnline && <div className="mt-4"><Err msg="Backend is offline. Upload will be available once connection is restored." /></div>}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            ["Dashboard", "Quality scores, outliers, distributions"],
            ["NL Queries", "Ask in English, get SQL and AI insight"],
            ["Detective", "Autonomous anomaly investigation"],
          ].map(([t, d]) => (
            <div key={t} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center hover-glow transition-all">
              <p className="text-slate-200 text-sm font-bold">{t}</p>
              <p className="text-slate-600 text-xs mt-1 leading-snug">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ profile: p }) => {
  if (!p) {
    return null;
  }

  const missing = Object.entries(p.missing || {})
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].percent - a[1].percent);

  const dup = p.duplicate_rows?.percent || 0;
  const mis = Object.values(p.missing || {}).reduce((s, v) => s + v.percent / (p.columns?.length || 1), 0) * 0.5;
  const out = Object.values(p.outlier_analysis || {}).reduce((s, v) => s + v.percent / (p.numeric_columns?.length || 1), 0) * 0.3;
  const quality = Math.max(0, Math.min(100, Math.round(100 - dup - mis - out)));
  const qColor = quality > 75 ? "emerald" : quality > 50 ? "amber" : "rose";

  const typeMeta = (dtype) => {
    if (!dtype) {
      return { lbl: "UNK", v: "slate" };
    }
    if (dtype.includes("int") || dtype.includes("float")) {
      return { lbl: "NUM", v: "indigo" };
    }
    if (dtype.includes("object") || dtype.includes("str")) {
      return { lbl: "CAT", v: "emerald" };
    }
    if (dtype.includes("date") || dtype.includes("time")) {
      return { lbl: "DATE", v: "amber" };
    }
    return { lbl: "OTHER", v: "slate" };
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Total Rows" value={p.shape?.rows?.toLocaleString()} sub={`${p.shape?.columns} columns`} variant="indigo" />
        <Stat label="Quality Score" value={`${quality}%`} sub={quality > 75 ? "Analysis-ready" : quality > 50 ? "Moderate quality" : "Needs cleaning"} variant={qColor} />
        <Stat label="Duplicates" value={p.duplicate_rows?.count?.toLocaleString() ?? 0} sub={`${p.duplicate_rows?.percent ?? 0}% of rows`} variant={p.duplicate_rows?.count > 0 ? "rose" : "emerald"} />
        <Stat label="Missing Cols" value={missing.length} sub={`of ${p.columns?.length} columns`} variant={missing.length > 0 ? "amber" : "emerald"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-300">Column Schema</h3>
            <div className="flex gap-2.5 text-xs font-mono">
              <span className="text-indigo-400">{p.numeric_columns?.length ?? 0} num</span>
              <span className="text-emerald-400">{p.categorical_columns?.length ?? 0} cat</span>
              <span className="text-amber-400">{p.datetime_columns?.length ?? 0} date</span>
            </div>
          </div>
          <div className="space-y-px max-h-72 overflow-y-auto pr-1">
            {p.columns?.map((col) => {
              const { lbl, v } = typeMeta(p.dtypes?.[col] || "");
              const misCol = p.missing?.[col];
              const outCol = p.outlier_analysis?.[col];
              return (
                <div key={col} className="flex items-center gap-2 py-1.5 border-b border-slate-800/50 last:border-0">
                  <Pill variant={v}>{lbl}</Pill>
                  <span className="text-slate-300 text-xs font-mono flex-1 truncate">{col}</span>
                  {misCol?.count > 0 && <Pill variant="amber">{misCol.percent}%</Pill>}
                  {outCol?.count > 0 && <Pill variant="rose">{outCol.count} out</Pill>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-4">Missing Values</h3>
          {missing.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-emerald-400 font-semibold text-sm">No missing values</p>
              <p className="text-slate-600 text-xs">Dataset is complete</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {missing.map(([col, v]) => (
                <div key={col}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 text-xs font-mono truncate max-w-xs">{col}</span>
                    <span className="text-rose-400 text-xs font-mono ml-2 shrink-0">{v.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-700 to-rose-400 rounded-full" style={{ width: `${Math.min(v.percent, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {p.numeric_columns?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-4">Numeric Statistics</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800">
                  {["Column", "Mean", "Std", "Min", "P25", "Median", "P75", "Max", "Outliers", "Skew"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-slate-500 font-mono uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.numeric_columns.map((col) => {
                  const s = p.numeric_summary || {};
                  const oa = (p.outlier_analysis || {})[col] || {};
                  const ds = (p.distribution_stats || {})[col] || {};
                  const fmt = (v) => (v != null ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-");
                  const sk = ds.skewness;
                  return (
                    <tr key={col} className="border-b border-slate-900 hover:bg-slate-900/40 transition-colors">
                      <td className="px-3 py-2 text-slate-200 font-mono font-semibold whitespace-nowrap">{col}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmt(s?.mean?.[col])}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmt(s?.std?.[col])}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmt(s?.min?.[col])}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmt(s?.["25%"]?.[col])}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmt(s?.["50%"]?.[col])}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmt(s?.["75%"]?.[col])}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{fmt(s?.max?.[col])}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{oa.count ? <Pill variant="rose">{oa.count} ({oa.percent}%)</Pill> : <span className="text-slate-700">-</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {sk != null ? <span className={Math.abs(sk) < 0.5 ? "text-emerald-400" : Math.abs(sk) < 1 ? "text-amber-400" : "text-rose-400"}>{sk.toFixed(2)}</span> : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {p.top_correlations?.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-300 mb-4">Top Correlations</h3>
            <div className="space-y-2.5">
              {p.top_correlations.slice(0, 8).map((c, i) => {
                const abs = Math.abs(c.correlation);
                const col = abs > 0.8 ? "rose" : abs > 0.6 ? "amber" : "emerald";
                const barC = abs > 0.8 ? "bg-rose-500" : abs > 0.6 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={i} className="flex items-center gap-3">
                    <p className="text-slate-500 text-xs font-mono flex-1 truncate">{c.col1} x {c.col2}</p>
                    <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden shrink-0">
                      <div className={`h-full ${barC} rounded-full`} style={{ width: `${abs * 100}%` }} />
                    </div>
                    <Pill variant={col}>{c.correlation > 0 ? "+" : ""}{c.correlation}</Pill>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {Object.keys(p.categorical_summaries || {}).length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-300 mb-4">Category Preview</h3>
            {Object.entries(p.categorical_summaries).slice(0, 2).map(([col, info]) => (
              <div key={col} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-300 text-xs font-mono font-semibold">{col}</span>
                  <Pill variant="slate">{info.unique_count} unique</Pill>
                </div>
                {Object.entries(info.top_5 || {}).slice(0, 5).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-0.5">
                    <span className="text-slate-500 text-xs font-mono truncate max-w-xs">{k}</span>
                    <span className="text-slate-400 text-xs font-mono ml-2 shrink-0">{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {p.sample_rows?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-4">Data Preview <span className="text-slate-600 font-normal">(first 5 rows)</span></h3>
          <Table cols={p.columns || []} rows={p.sample_rows} pageSize={5} />
        </div>
      )}
    </div>
  );
};

const Analysis = ({ dsId, isBackendOnline }) => {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async () => {
    if (!isBackendOnline) {
      setErr("Backend is offline. Please retry when API is reachable.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.analyze(dsId);
      if (r.error || !r.success) {
        throw new Error(r.error || "Analysis failed");
      }
      setData(r.analysis);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="animate-fade-in">
      <SectionHead
        title="Deep Analysis"
        sub="Comprehensive AI-powered EDA with executive insights"
        action={<PrimaryBtn onClick={run} disabled={!isBackendOnline} loading={busy} icon={icons.spark}>Run Analysis</PrimaryBtn>}
      />
      {err && <div className="mb-4"><Err msg={err} /></div>}
      {busy && <Loader text="Data Profiler agent is analyzing..." />}
      {data && !busy && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 animate-slide-up content-shell">
          <MarkdownBlock content={data} />
        </div>
      )}
      {!data && !busy && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl">
          <Empty icon={<Brain className="h-12 w-12 text-indigo-300" />} title="Ready to analyze" body="Click Run Analysis for a full AI-generated EDA report on your dataset" cta={<PrimaryBtn onClick={run} disabled={!isBackendOnline} icon={icons.spark}>Run Analysis</PrimaryBtn>} />
        </div>
      )}
    </div>
  );
};

const Query = ({ dsId, isBackendOnline }) => {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [hist, setHist] = useState([]);
  const ref = useRef(null);

  const SUGG = [
    "Show top 10 rows by the largest numeric value",
    "What is the average of each numeric column?",
    "Count rows grouped by each category",
    "Show rows where any value is null or missing",
    "What are the min and max values for all columns?",
    "Find the most frequently occurring category",
  ];

  const submit = async () => {
    const queryText = q.trim();
    if (!queryText || busy || !isBackendOnline) {
      return;
    }
    setBusy(true);
    setErr(null);
    setRes(null);
    setHist((h) => [queryText, ...h.slice(0, 9)]);
    try {
      const r = await api.query(dsId, queryText);
      if (r.error || !r.success) {
        throw new Error(r.error || "Query failed");
      }
      setRes(r);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const exportCsv = () => {
    if (!res?.result?.data?.length || !res?.result?.columns?.length) {
      return;
    }
    const columns = res.result.columns;
    const rows = res.result.data;
    const escapeCsv = (value) => {
      if (value == null) {
        return "";
      }
      const text = String(value);
      if (text.includes(",") || text.includes("\n") || text.includes('"')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csvLines = [
      columns.map(escapeCsv).join(","),
      ...rows.map((row) => columns.map((col) => escapeCsv(row[col])).join(",")),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-result-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <SectionHead title="Natural Language Query" sub="Ask anything about your data in plain English; agents handle SQL and narration" />

      {!isBackendOnline && (
        <Err msg="API is currently offline. Query actions are temporarily disabled until connectivity is restored." />
      )}

      <div className="bg-slate-900 border border-slate-800 focus-within:border-indigo-700 rounded-2xl p-1.5 transition-colors">
        <div className="flex gap-2 items-center px-3 py-2">
          <span className="text-indigo-400 shrink-0">{icons.chat}</span>
          <input
            ref={ref}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
            placeholder="e.g. What is the average sales by region?"
            className="flex-1 bg-transparent text-slate-200 text-sm font-mono placeholder-slate-700 outline-none"
          />
          <button
            onClick={submit}
            disabled={!q.trim() || busy || !isBackendOnline}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-all shrink-0"
          >
            {busy ? <Spin /> : icons.send}
            <span className="hidden sm:inline">Ask</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGG.map((s) => (
          <button key={s} onClick={() => { setQ(s); ref.current?.focus(); }} className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-800 rounded-full text-slate-500 hover:text-indigo-300 text-xs font-mono transition-all">
            {s}
          </button>
        ))}
      </div>

      {err && <Err msg={err} />}
      {busy && <Loader text="Query agents are processing your question..." />}

      {res && !busy && (
        <div className="space-y-4 animate-slide-up">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">Interpretation</p>
            <div className="flex flex-wrap items-start gap-3">
              <p className="text-slate-300 text-sm flex-1 min-w-0">{res.interpretation?.interpreted_intent || "-"}</p>
              <div className="flex flex-wrap gap-2 shrink-0">
                {res.interpretation?.analysis_type && <Pill variant="indigo">{res.interpretation.analysis_type}</Pill>}
                <Pill variant={res.interpretation?.valid ? "emerald" : "rose"}>{res.interpretation?.valid ? "valid" : "invalid"}</Pill>
                {res.interpretation?.confidence != null && (
                  <Pill variant={res.interpretation.confidence > 0.7 ? "emerald" : "amber"}>{Math.round(res.interpretation.confidence * 100)}% conf</Pill>
                )}
              </div>
            </div>
          </div>

          {res.sql_query && res.sql_query !== "INVALID_QUERY" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Generated SQL</p>
                <CopyBtn text={res.sql_query} />
              </div>
              <pre className="bg-slate-950 rounded-xl p-4 text-indigo-300 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap border border-slate-800">{res.sql_query}</pre>
            </div>
          )}

          {res.result?.error && <Err msg={res.result.error} />}
          {res.result?.data && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Results</p>
                <Pill variant="indigo">{res.result.row_count?.toLocaleString()} rows</Pill>
                </div>
                <GhostBtn onClick={exportCsv} className="border-indigo-800 text-indigo-300">
                  {icons.download}
                  <span>Export CSV</span>
                </GhostBtn>
              </div>
              <Table cols={res.result.columns || []} rows={res.result.data} />
            </div>
          )}

          {res.narrative && (
            <div className="border-l-2 border-indigo-600 bg-slate-900 rounded-r-xl pl-5 pr-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                {icons.spark}
                <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">AI Insight</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed italic">{res.narrative}</p>
            </div>
          )}

          {res.result_chart && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">Result Visualization</p>
              <Chart data={res.result_chart} />
            </div>
          )}
        </div>
      )}

      {hist.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">Recent Queries</p>
          {hist.map((h, i) => (
            <button key={i} onClick={() => setQ(h)} className="w-full flex items-center gap-3 py-2 px-2 hover:bg-slate-800 rounded-lg transition-colors text-left group">
              <span className="text-slate-700 group-hover:text-indigo-500 transition-colors">{icons.arrow}</span>
              <span className="text-slate-500 group-hover:text-slate-300 text-xs font-mono truncate transition-colors">{h}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Visualize = ({ dsId, isBackendOnline }) => {
  const [charts, setCharts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");

  const run = async () => {
    if (!isBackendOnline) {
      setErr("Backend is offline. Please retry when API is reachable.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.visualize(dsId);
      if (r.error || !r.success) {
        throw new Error(r.error || "Visualization failed");
      }
      setCharts(r.charts || []);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const TYPES = ["all", "histogram", "boxplot", "heatmap", "bar", "scatter_matrix", "missing"];
  const filtered = (charts || []).filter((c) => filter === "all" || c.chart_type === filter);
  const wide = (c) => ["scatter_matrix", "heatmap", "boxplot"].includes(c.chart_type);

  return (
    <div className="animate-fade-in">
      <SectionHead
        title="Visualizations"
        sub="Interactive Plotly charts with AI-generated business insights"
        action={<PrimaryBtn onClick={run} disabled={!isBackendOnline} loading={busy} icon={icons.bar}>Generate Charts</PrimaryBtn>}
      />
      {err && <div className="mb-4"><Err msg={err} /></div>}
      {busy && <Loader text="Visualization agents are building your charts..." />}

      {charts && !busy && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {TYPES.filter((t) => t === "all" || charts.some((c) => c.chart_type === t)).map((t) => (
              <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-all ${filter === t ? "bg-indigo-600 text-white" : "bg-slate-900 border border-slate-800 text-slate-400 hover:border-indigo-800"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filtered.map((c, i) => (
              <div key={i} className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover-glow transition-all hover:border-slate-700 ${wide(c) ? "xl:col-span-2" : ""}`}>
                <div className="px-5 pt-5 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-slate-200 text-sm font-bold">{c.title}</h3>
                      {c.insight && <p className="text-slate-500 text-xs mt-1 leading-relaxed">{c.insight}</p>}
                    </div>
                    {c.key_finding && (
                      <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/60 border border-indigo-900/50 rounded-lg">
                        {icons.zap}
                        <span className="text-indigo-300 text-xs font-mono">{c.key_finding.slice(0, 55)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-3 pb-4">
                  <Chart data={c.plotly_json} height={wide(c) ? 380 : 320} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!charts && !busy && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl">
          <Empty icon={<BarChart3 className="h-12 w-12 text-indigo-300" />} title="No charts yet" body="Click Generate Charts to build smart interactive visualizations with AI insights" cta={<PrimaryBtn onClick={run} disabled={!isBackendOnline} icon={icons.bar}>Generate Charts</PrimaryBtn>} />
        </div>
      )}
    </div>
  );
};

const Detective = ({ dsId, isBackendOnline }) => {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async () => {
    if (!isBackendOnline) {
      setErr("Backend is offline. Please retry when API is reachable.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.detective(dsId);
      if (r.error || !r.success) {
        throw new Error(r.error || "Detective mode failed");
      }
      setRes(r);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-rose-900/30 bg-gradient-to-br from-rose-950/20 via-slate-900 to-indigo-950/20 p-6">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative flex items-center gap-5 justify-between flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-800/40 flex items-center justify-center shrink-0">
              <Search className="h-7 w-7 text-rose-300" />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-slate-100">Detective Mode</h2>
              <p className="text-slate-400 text-sm mt-0.5 max-w-lg">
                An autonomous AI agent investigates your dataset for anomalies, suspicious patterns, and hidden signals, then delivers a forensic case file.
              </p>
            </div>
          </div>
          <button onClick={run} disabled={busy || !isBackendOnline} className="shrink-0 flex items-center gap-2.5 px-5 py-2.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all glow-rose">
            {busy ? <><Spin /><span>Investigating...</span></> : <>{icons.search}<span>Investigate</span></>}
          </button>
        </div>
      </div>

      {err && <Err msg={err} />}
      {busy && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl">
          <Loader text="Detective Agent is hunting for anomalies..." />
        </div>
      )}

      {res && !busy && (
        <div className="space-y-5 animate-slide-up">
          <div className="bg-slate-900 border border-rose-900/30 rounded-2xl p-7 content-shell">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-rose-400 font-mono text-xs uppercase tracking-widest">Case File</span>
              <div className="h-px flex-1 bg-rose-900/30" />
              <span className="text-slate-700 text-xs font-mono">{new Date().toLocaleDateString()}</span>
            </div>
            <MarkdownBlock content={res.case_file || ""} />
          </div>

          {res.forensic_charts?.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-300 mb-3">Forensic Visualizations</p>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {res.forensic_charts.map((c, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-5 pt-4 pb-1"><h3 className="text-sm font-bold text-slate-300">{c.title}</h3></div>
                    <div className="px-3 pb-4"><Chart data={c.plotly_json} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {res.forensics && (
            <details className="bg-slate-900 border border-slate-800 rounded-xl group">
              <summary className="cursor-pointer px-5 py-4 text-xs font-mono text-slate-600 uppercase tracking-widest list-none">Raw Forensic Statistics</summary>
              <div className="px-5 pb-5">
                <pre className="bg-slate-950 rounded-xl p-4 text-slate-500 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap border border-slate-800">
                  {JSON.stringify(res.forensics, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}

      {!res && !busy && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl">
          <Empty icon={<Search className="h-12 w-12 text-rose-300" />} title="Detective is waiting" body="Launch an autonomous investigation to uncover hidden anomalies, outliers, and data quality issues" cta={<button onClick={run} disabled={!isBackendOnline} className="flex items-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all">{icons.search} Investigate</button>} />
        </div>
      )}
    </div>
  );
};

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: icons.grid, sub: "Quality metrics and schema" },
  { id: "analysis", label: "Analysis", icon: icons.brain, sub: "AI EDA report" },
  { id: "query", label: "Query", icon: icons.chat, sub: "NL to SQL to Insight" },
  { id: "visualize", label: "Visualize", icon: icons.bar, sub: "Smart interactive charts" },
  { id: "detective", label: "Detective", icon: icons.search, sub: "Anomaly investigation", badge: "NEW" },
];

const App = () => {
  const [view, setView] = useState("upload");
  const [dsId, setDsId] = useState(null);
  const [prof, setProf] = useState(null);
  const [fname, setFname] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [backendLatency, setBackendLatency] = useState(null);

  const pingBackend = useCallback(async () => {
    const startedAt = performance.now();
    try {
      await api.health();
      const duration = Math.round(performance.now() - startedAt);
      setBackendLatency(duration);
      setBackendStatus("online");
    } catch {
      setBackendStatus("offline");
      setBackendLatency(null);
    }
  }, []);

  useEffect(() => {
    pingBackend();
    const interval = setInterval(pingBackend, 30000);
    return () => clearInterval(interval);
  }, [pingBackend]);

  useEffect(() => {
    if (!dsId || !prof) {
      localStorage.removeItem("nlptosql_active_dataset");
      return;
    }
    localStorage.setItem(
      "nlptosql_active_dataset",
      JSON.stringify({
        dsId,
        prof,
        fname,
        tab,
      }),
    );
  }, [dsId, prof, fname, tab]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nlptosql_active_dataset");
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.dsId && parsed?.prof) {
        setDsId(parsed.dsId);
        setProf(parsed.prof);
        setFname(parsed.fname || "dataset.csv");
        setTab(parsed.tab || "dashboard");
        setView("app");
      }
    } catch {
      localStorage.removeItem("nlptosql_active_dataset");
    }
  }, []);

  const backendBadge = useMemo(() => {
    if (backendStatus === "online") {
      return {
        icon: icons.wifi,
        label: backendLatency != null ? `API online · ${backendLatency}ms` : "API online",
        className: "text-emerald-300 border-emerald-900/60 bg-emerald-950/30",
      };
    }
    if (backendStatus === "offline") {
      return {
        icon: icons.wifiOff,
        label: "API offline",
        className: "text-rose-300 border-rose-900/60 bg-rose-950/30",
      };
    }
    return {
      icon: icons.spin,
      label: "Checking API",
      className: "text-amber-300 border-amber-900/60 bg-amber-950/30",
    };
  }, [backendStatus, backendLatency]);

  const onUpload = (id, p, name) => {
    setDsId(id);
    setProf(p);
    setFname(name);
    setView("app");
    setTab("dashboard");
  };

  const reset = () => {
    const shouldReset = window.confirm("Start a new dataset session? This clears current analysis context.");
    if (!shouldReset) {
      return;
    }
    if (dsId) {
      api.cleanup(dsId).catch(() => {});
    }
    setDsId(null);
    setProf(null);
    setFname(null);
    setView("upload");
    setTab("dashboard");
    localStorage.removeItem("nlptosql_active_dataset");
  };

  if (view === "upload") {
    return <Upload onDone={onUpload} isBackendOnline={backendStatus === "online"} />;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen bg-slate-950 lg:overflow-hidden">
      <aside className="hidden lg:flex w-[220px] shrink-0 bg-slate-900/80 border-r border-slate-800 flex-col backdrop-blur-sm">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-sm select-none">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-display font-black text-slate-100 text-base tracking-tight">Data<span className="text-indigo-400">Detective</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            <span className="text-slate-600 text-xs font-mono">DeepSeek V3 - OpenRouter</span>
          </div>
        </div>

        <div className="mx-3 mt-3 mb-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
          <p className="text-slate-700 text-xs font-mono mb-1 uppercase tracking-wider">Dataset</p>
          <p className="text-slate-300 text-xs font-medium truncate" title={fname}>{fname}</p>
          <p className="text-slate-600 text-xs font-mono mt-1">{prof?.shape?.rows?.toLocaleString()}r x {prof?.shape?.columns}c</p>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover-glow group ${tab === t.id ? "bg-indigo-600/15 text-indigo-300 border border-indigo-800/50" : "text-slate-500 hover:text-slate-200 hover:bg-slate-800 border border-transparent"}`}>
              <span className={`shrink-0 transition-colors ${tab === t.id ? "text-indigo-400" : "text-slate-600 group-hover:text-slate-400"}`}>{t.icon}</span>
              <span className="truncate">{t.label}</span>
              {t.badge && <span className="ml-auto px-1.5 py-0.5 bg-rose-600 text-white text-xs font-mono rounded-md shrink-0">{t.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button onClick={reset} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-950/20 text-xs font-mono transition-all border border-transparent hover:border-rose-900/40">
            {icons.trash}<span>New Dataset</span>
          </button>
          <p className="text-slate-800 text-xs font-mono text-center mt-2">v2.0 - OpenRouter</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
        <header className="shrink-0 bg-slate-900/60 border-b border-slate-800 backdrop-blur-sm px-4 sm:px-7 py-3.5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-slate-200 font-display font-bold text-base">{TABS.find((t) => t.id === tab)?.label}</h1>
            <p className="text-slate-600 text-xs font-mono mt-0.5">{TABS.find((t) => t.id === tab)?.sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-slate-600 text-xs font-mono truncate max-w-xs">{fname}</span>
              <span className="text-slate-700 text-xs font-mono mx-1">/</span>
              <span className="text-indigo-400 text-xs font-mono">{TABS.find((t) => t.id === tab)?.label}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg ${backendBadge.className}`}>
              {backendBadge.icon}
              <span className="text-xs font-mono">{backendBadge.label}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              <span className="text-slate-500 text-xs font-mono">deepseek-v3</span>
            </div>
          </div>
        </header>

        <div className="lg:hidden border-b border-slate-800 bg-slate-900/70 px-3 py-3">
          <div className="mb-2 px-1">
            <p className="text-slate-400 text-xs font-mono truncate">{fname}</p>
            <p className="text-slate-600 text-xs font-mono">{prof?.shape?.rows?.toLocaleString()}r x {prof?.shape?.columns}c</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${tab === t.id ? "bg-indigo-600/20 border-indigo-700 text-indigo-300" : "bg-slate-900 border-slate-800 text-slate-400"}`}
              >
                <span className="shrink-0">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
            <button
              onClick={reset}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium border bg-slate-900 border-slate-800 text-rose-400"
            >
              New Dataset
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-7 max-w-screen-xl mx-auto w-full min-w-0">
            <section className={tab === "dashboard" ? "block" : "hidden"} aria-hidden={tab !== "dashboard"}>
              <Dashboard profile={prof} />
            </section>
            <section className={tab === "analysis" ? "block" : "hidden"} aria-hidden={tab !== "analysis"}>
              <Analysis dsId={dsId} isBackendOnline={backendStatus === "online"} />
            </section>
            <section className={tab === "query" ? "block" : "hidden"} aria-hidden={tab !== "query"}>
              <Query dsId={dsId} isBackendOnline={backendStatus === "online"} />
            </section>
            <section className={tab === "visualize" ? "block" : "hidden"} aria-hidden={tab !== "visualize"}>
              <Visualize dsId={dsId} isBackendOnline={backendStatus === "online"} />
            </section>
            <section className={tab === "detective" ? "block" : "hidden"} aria-hidden={tab !== "detective"}>
              <Detective dsId={dsId} isBackendOnline={backendStatus === "online"} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
