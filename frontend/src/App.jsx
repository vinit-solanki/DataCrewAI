import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/**
 * DataCrew.ai — Enhanced React Frontend (single-file)
 * - Drag & drop + click-to-upload for CSV/TSV/XLSX/SQL
 * - Clean loading states & toasts
 * - Auto-runs Analyze + Visualize after upload
 * - Query workspace with history, copy-SQL, and result table
 * - Safer rendering of AI analysis (monospace block)
 * - Dataset cleanup endpoint trigger
 * - Works with your Flask backend from the prompt
 */

const API_BASE = (window && window.__API_BASE__) || "http://localhost:5000";

export default function App() {
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState("upload");
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [datasetId, setDatasetId] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [visualizations, setVisualizations] = useState([]);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);

  // --- Helpers ---
  const setBusy = (key, v) => setLoading((prev) => ({ ...prev, [key]: v }));
  const canNavigateTab = useMemo(
    () => Boolean(datasetInfo),
    [datasetInfo]
  );

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg, type = "info") => setToast({ msg, type });

  // --- Upload ---
  const uploadFile = async (selectedFile) => {
    if (!selectedFile) return;
    setBusy("upload", true);
    setError("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setDatasetInfo(data.dataset_info);
        setDatasetId(data.dataset_id);
        setTab("overview");
        showToast("Upload successful. Analyzing…");
        // Kick off in parallel
        void handleAnalyze(data.dataset_id);
        void handleVisualize(data.dataset_id);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (e) {
      setError("Upload error");
    } finally {
      setBusy("upload", false);
    }
  };

  const onFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      uploadFile(f);
    }
  };

  // Drag & drop handlers
  const dropRef = useRef(null);
  useEffect(() => {
    const node = dropRef.current;
    if (!node) return;
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrop = (e) => {
      prevent(e);
      const f = e.dataTransfer.files?.[0];
      if (f) {
        setFile(f);
        uploadFile(f);
      }
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
      node.addEventListener(ev, prevent)
    );
    node.addEventListener("drop", onDrop);
    return () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
        node.removeEventListener(ev, prevent)
      );
      node.removeEventListener("drop", onDrop);
    };
  }, []);

  // --- Analyze ---
  const handleAnalyze = async (id = datasetId) => {
    if (!id) return;
    setBusy("analyze", true);
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.analysis || "");
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (e) {
      setError("Analysis error");
    } finally {
      setBusy("analyze", false);
    }
  };

  // --- Query ---
  const handleQuery = async () => {
    if (!query || !datasetId) return;
    setBusy("query", true);
    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, query }),
      });
      const data = await res.json();
      if (data.success) {
        setQueryResult(data);
        setQueryHistory((prev) => [
          { q: query, sql: data.sql_query, ts: Date.now(), ok: !!data?.result?.data && !data?.result?.error },
          ...prev,
        ].slice(0, 8));
      } else {
        setError(data.error || "Query failed");
      }
    } catch (e) {
      setError("Query error");
    } finally {
      setBusy("query", false);
    }
  };

  // --- Visualize ---
  const handleVisualize = async (id = datasetId) => {
    if (!id) return;
    setBusy("visualize", true);
    try {
      const res = await fetch(`${API_BASE}/visualize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        setVisualizations(data.visualizations || []);
      } else {
        setError(data.error || "Visualization failed");
      }
    } catch (e) {
      setError("Visualization error");
    } finally {
      setBusy("visualize", false);
    }
  };

  // --- Cleanup on demand ---
  const cleanupDataset = async () => {
    if (!datasetId) return;
    setBusy("cleanup", true);
    try {
      await fetch(`${API_BASE}/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId }),
      });
      setDatasetId("");
      setDatasetInfo(null);
      setAnalysis("");
      setQuery("");
      setQueryResult(null);
      setVisualizations([]);
      setTab("upload");
      setFile(null);
      showToast("Dataset removed.", "success");
    } catch (e) {
      setError("Cleanup error");
    } finally {
      setBusy("cleanup", false);
    }
  };

  // --- UI Pieces ---
  const TabButton = ({ id, children }) => (
    <button
      onClick={() => setTab(id)}
      disabled={["overview", "query", "visualize"].includes(id) && !canNavigateTab}
      className={`px-5 py-2 rounded-xl font-medium text-sm transition-all duration-200 border ${
        tab === id
          ? "bg-blue-600 text-white border-blue-700 shadow"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
      } ${["overview", "query", "visualize"].includes(id) && !canNavigateTab ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );

  const CopyButton = ({ text, label = "Copy" }) => (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text || "");
          showToast("Copied!", "success");
        } catch {
          showToast("Copy failed", "error");
        }
      }}
      className="ml-2 inline-flex items-center rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-10">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">DataCrew.ai</h1>
        <p className="text-slate-300 mt-2">
          Agentic CrewAI app for automated dataset analysis, natural-language querying, and dynamic interpretation
          — powered by <span className="font-semibold">CrewAI</span> + <span className="font-semibold">Google Gemini</span>.
        </p>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto bg-red-50 text-red-800 p-4 rounded-xl mb-6 border border-red-200">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-6xl mx-auto flex flex-wrap gap-3 mb-8">
        <TabButton id="upload">UPLOAD</TabButton>
        <TabButton id="overview">OVERVIEW</TabButton>
        <TabButton id="query">QUERY</TabButton>
        <TabButton id="visualize">VISUALIZE</TabButton>
        {datasetId && (
          <button
            onClick={cleanupDataset}
            className={`ml-auto px-4 py-2 rounded-xl text-sm font-medium border ${
              loading.cleanup
                ? "bg-slate-600 text-white border-slate-700 cursor-not-allowed"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
            disabled={loading.cleanup}
          >
            {loading.cleanup ? "Cleaning…" : "Remove Dataset"}
          </button>
        )}
      </div>

      {/* Upload Tab */}
      {tab === "upload" && (
        <div
          ref={dropRef}
          className="max-w-3xl mx-auto border-2 border-dashed border-slate-600 rounded-2xl p-10 text-center bg-slate-800/40"
        >
          <p className="text-slate-200 text-lg font-medium">Drag & drop your file here</p>
          <p className="text-slate-400 text-sm mt-1">Accepted: CSV, TSV, XLSX, SQL</p>

          <div className="mt-6">
            <label className="inline-block">
              <span className="sr-only">Choose file</span>
              <input
                type="file"
                accept=".csv,.tsv,.xlsx,.sql"
                onChange={onFileInput}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 cursor-pointer">
                {loading.upload ? "Uploading…" : "Browse files"}
              </span>
            </label>
          </div>
          {file && (
            <p className="mt-4 text-slate-300 text-sm">Selected: {file.name}</p>
          )}
        </div>
      )}

      {/* Overview Tab */}
      {tab === "overview" && datasetInfo && (
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Dataset Info</h2>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                <div>Rows: <span className="font-medium">{datasetInfo.shape[0]}</span></div>
                <div>Columns: <span className="font-medium">{datasetInfo.shape[1]}</span></div>
                <div>Numeric Columns: <span className="font-medium">{datasetInfo.numeric_columns.length}</span></div>
                <div>Categorical Columns: <span className="font-medium">{datasetInfo.categorical_columns.length}</span></div>
              </div>
              <div className="mt-4 text-xs text-gray-500">
                <p className="font-semibold">Columns</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {datasetInfo.columns.map((c) => (
                    <span key={c} className="px-2 py-1 rounded-full bg-gray-100 border text-gray-700">{c}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">AI Analysis</h2>
                <button
                  onClick={() => handleAnalyze()}
                  className={`text-sm px-3 py-1.5 rounded-lg border ${
                    loading.analyze ? "bg-gray-100 text-gray-400" : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  disabled={loading.analyze}
                >
                  {loading.analyze ? "Analyzing…" : "Re-run"}
                </button>
              </div>
              <pre className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg overflow-auto max-h-72 whitespace-pre-wrap">{analysis || "No analysis yet."}</pre>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Preview (first 5 rows)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    {datasetInfo.columns.map((col) => (
                      <th key={col} className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-900">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetInfo.preview.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {datasetInfo.columns.map((col) => (
                        <td key={col} className="border border-gray-200 px-3 py-2 text-gray-700">{String(row[col])?.substring(0, 60)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Query Tab */}
      {tab === "query" && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <textarea
              rows={4}
              className="w-full border border-gray-200 p-4 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask: What is the average sales by category?"
            />
            <button
              onClick={handleQuery}
              disabled={loading.query}
              className={`w-full px-6 py-3 rounded-xl font-medium text-white transition-all duration-200 ${
                loading.query ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading.query ? "Processing…" : "Run Query"}
            </button>

            {queryResult && (
              <div className="bg-white p-6 rounded-2xl shadow border border-gray-100">
                {queryResult.sql_query && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">SQL Generated</h3>
                      <CopyButton text={queryResult.sql_query} />
                    </div>
                    <pre className="bg-gray-50 p-3 rounded-lg text-sm text-gray-800 overflow-x-auto">{queryResult.sql_query}</pre>
                  </div>
                )}

                {/* Validation report (raw text) */}
                {queryResult.validation && (
                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm text-gray-700">Validation</summary>
                    <pre className="bg-gray-50 p-3 rounded-lg text-xs text-gray-800 whitespace-pre-wrap">{queryResult.validation}</pre>
                  </details>
                )}

                {queryResult.result?.data && (
                  <>
                    <h3 className="font-semibold text-gray-900 mt-4">
                      Results ({queryResult.result.row_count} rows)
                    </h3>
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-sm border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            {queryResult.result.columns.map((col) => (
                              <th key={col} className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-900">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.result.data.slice(0, 200).map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {queryResult.result.columns.map((col) => (
                                <td key={col} className="border border-gray-200 px-3 py-2 text-gray-700">
                                  {String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {queryResult.result?.error && (
                  <p className="text-red-600 mt-4">{queryResult.result.error}</p>
                )}
              </div>
            )}
          </div>

          {/* History */}
          <aside className="space-y-3">
            <div className="bg-white p-5 rounded-2xl shadow border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">Query History</h3>
              {queryHistory.length === 0 ? (
                <p className="text-sm text-gray-600">No queries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {queryHistory.map((h, idx) => (
                    <li key={idx} className="text-sm text-gray-800">
                      <button
                        className="text-left w-full hover:bg-gray-50 p-2 rounded-lg border border-gray-100"
                        onClick={() => {
                          setQuery(h.q);
                          showToast("Recalled query");
                        }}
                        title={new Date(h.ts).toLocaleString()}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="line-clamp-2">{h.q}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${h.ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {h.ok ? "OK" : "WARN"}
                          </span>
                        </div>
                        {h.sql && (
                          <div className="mt-1 text-xs text-gray-500 line-clamp-1">{h.sql}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Visualize Tab */}
      {tab === "visualize" && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {visualizations.length > 0 ? (
            visualizations.map((viz, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl shadow border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-2">{viz.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{viz.description}</p>
                <img
                  src={`data:image/png;base64,${viz.image}`}
                  alt={viz.title}
                  className="rounded-lg w-full"
                />
              </div>
            ))
          ) : (
            <p className="text-gray-300 col-span-2 text-center text-lg">
              {loading.visualize ? "Generating visualizations…" : "No visualizations to show."}
            </p>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2 rounded-xl shadow-lg text-sm ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-slate-700 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-12 text-slate-400 text-xs">
        <p>
          Built with <span className="text-slate-200 font-semibold">CrewAI</span>,
          <span className="text-slate-200 font-semibold"> Google Gemini</span>, Pandas, Seaborn, Matplotlib.
        </p>
      </footer>
    </div>
  );
}
