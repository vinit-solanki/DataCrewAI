import React, { useState, useCallback } from "react";
import { createRoot } from "react-dom/client";

const API_BASE = "http://localhost:5000";

function App() {
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

  const handleFileUpload = useCallback(async (selectedFile) => {
    if (!selectedFile) return;
    setLoading((prev) => ({ ...prev, upload: true }));
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
        handleAnalyze(data.dataset_id);
        handleVisualize(data.dataset_id);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload error");
    } finally {
      setLoading((prev) => ({ ...prev, upload: false }));
    }
  }, []);

  const handleAnalyze = async (id = datasetId) => {
    if (!id) return;
    setLoading((prev) => ({ ...prev, analyze: true }));
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch {
      setError("Analysis error");
    } finally {
      setLoading((prev) => ({ ...prev, analyze: false }));
    }
  };

  const handleQuery = async () => {
    if (!query || !datasetId) return;
    setLoading((prev) => ({ ...prev, query: true }));
    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, query }),
      });
      const data = await res.json();
      if (data.success) {
        setQueryResult(data);
      } else {
        setError(data.error || "Query failed");
      }
    } catch {
      setError("Query error");
    } finally {
      setLoading((prev) => ({ ...prev, query: false }));
    }
  };

  const handleVisualize = async (id = datasetId) => {
    if (!id) return;
    setLoading((prev) => ({ ...prev, visualize: true }));
    try {
      const res = await fetch(`${API_BASE}/visualize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        setVisualizations(data.visualizations);
      } else {
        setError(data.error || "Visualization failed");
      }
    } catch {
      setError("Visualization error");
    } finally {
      setLoading((prev) => ({ ...prev, visualize: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-650 to-gray-700 p-6 sm:p-8">
      <h1 className="text-3xl font-extrabold text-gray-300 mb-8 text-center tracking-tight">
        DataCrew.ai
      </h1>
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 shadow-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-4 mb-8 justify-center">
        {["upload", "overview", "query", "visualize"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
              tab === t
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            } ${
              ["overview", "query", "visualize"].includes(t) && !datasetInfo
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            disabled={
              ["overview", "query", "visualize"].includes(t) && !datasetInfo
            }
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Upload Tab */}
      {tab === "upload" && (
        <div className="max-w-2xl mx-auto bg-white/20 text-white p-8 rounded-xl shadow-lg border border-gray-100">
          <input
            type="file"
            accept=".csv,.tsv,.xlsx,.sql"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                handleFileUpload(f);
              }
            }}
            className="block w-full text-sm text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
          />
          {file && (
            <p className="mt-4 text-sm text-gray-600">Uploaded: {file.name}</p>
          )}
          {loading.upload && (
            <p className="mt-4 text-blue-600 font-medium">Uploading...</p>
          )}
        </div>
      )}

      {/* Overview Tab */}
      {tab === "overview" && datasetInfo && (
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Dataset Info
              </h2>
              <p className="text-gray-700">Rows: {datasetInfo.shape[0]}</p>
              <p className="text-gray-700">Columns: {datasetInfo.shape[1]}</p>
              <p className="text-gray-700">
                Numeric Columns: {datasetInfo.numeric_columns.length}
              </p>
              <p className="text-gray-700">
                Categorical Columns: {datasetInfo.categorical_columns.length}
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                AI Analysis
              </h2>
              {loading.analyze ? (
                <p className="text-blue-600 font-medium">Analyzing...</p>
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {analysis}
                </div>
              )}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Preview (first 5 rows)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    {datasetInfo.columns.map((col) => (
                      <th
                        key={col}
                        className="border border-gray-200 px-4 py-2 text-left font-medium text-gray-900"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetInfo.preview.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {datasetInfo.columns.map((col) => (
                        <td
                          key={col}
                          className="border border-gray-200 px-4 py-2 text-gray-700"
                        >
                          {String(row[col]).substring(0, 30)}
                        </td>
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
        <div className="max-w-3xl mx-auto space-y-6">
          <textarea
            rows={4}
            className="w-full border border-gray-200 p-4 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question like: What is the average sales by category?"
          />
          <button
            onClick={handleQuery}
            disabled={loading.query}
            className={`w-full px-6 py-3 rounded-lg font-medium text-white transition-all duration-300 ${
              loading.query
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading.query ? "Processing..." : "Run Query"}
          </button>
          {queryResult && (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              {queryResult.sql_query && (
                <>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    SQL Generated
                  </h3>
                  <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
                    {queryResult.sql_query}
                  </pre>
                </>
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
                            <th
                              key={col}
                              className="border border-gray-200 px-4 py-2 text-left font-medium text-gray-900"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.result.data.slice(0, 10).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {queryResult.result.columns.map((col) => (
                              <td
                                key={col}
                                className="border border-gray-200 px-4 py-2 text-gray-700"
                              >
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
      )}

      {/* Visualize Tab */}
      {tab === "visualize" && (
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {visualizations.length > 0 ? (
            visualizations.map((viz, idx) => (
              <div
                key={idx}
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-100"
              >
                <h3 className="font-semibold text-gray-900 mb-2">
                  {viz.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4">{viz.description}</p>
                <img
                  src={`data:image/png;base64,${viz.image}`}
                  alt={viz.title}
                  className="rounded-lg w-full"
                />
              </div>
            ))
          ) : (
            <p className="text-gray-600 col-span-2 text-center text-lg">
              {loading.visualize
                ? "Generating visualizations..."
                : "No visualizations to show."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;