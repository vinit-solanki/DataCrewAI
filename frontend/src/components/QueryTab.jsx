"use client"

import { useState } from "react"
import { apiService } from "../services/apiService"
import ResultCard from "./ResultCard"
import LoadingSpinner from "./LoadingSpinner"

const QueryTab = ({ datasetLoaded, loading, setLoading }) => {
  const [query, setQuery] = useState("")
  const [queryResult, setQueryResult] = useState("")
  const [queryHistory, setQueryHistory] = useState([])

  const exampleQueries = [
    "Show me the top 10 customers by sales amount",
    "What's the average order value by month?",
    "Find all products with low inventory",
    "Calculate monthly revenue growth",
    "Show sales by region",
    "What are the top selling products?",
  ]

  const handleQuery = async () => {
    if (!query.trim()) return

    setLoading(true)
    setQueryResult("")

    try {
      const data = await apiService.processQuery(query)

      if (data.success) {
        setQueryResult(data.result)
        setQueryHistory((prev) => [
          { query, result: data.result, timestamp: new Date() },
          ...prev.slice(0, 4), // Keep only last 5 queries
        ])
      } else {
        setQueryResult(`Error: ${data.error}`)
      }
    } catch (error) {
      setQueryResult(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExampleQuery = (exampleQuery) => {
    setQuery(exampleQuery)
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleQuery()
    }
  }

  if (!datasetLoaded) {
    return (
      <div className="max-w-4xl mx-auto animate-slide-up">
        <div className="bg-white rounded-xl p-8 card-shadow text-center">
          <i className="fas fa-exclamation-triangle text-6xl text-yellow-500 mb-6"></i>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">No Dataset Loaded</h3>
          <p className="text-lg text-gray-600 mb-6">Please upload a dataset first to start querying your data.</p>
          <div className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg">
            <i className="fas fa-upload mr-2"></i>
            Go to Upload Tab
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto animate-slide-up">
      <div className="bg-white rounded-xl p-8 card-shadow mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          <i className="fas fa-search text-primary-600 mr-3"></i>
          Natural Language Query
        </h2>

        <div className="space-y-6">
          {/* Query Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ask a question about your data:</label>
            <div className="relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., Show me the top 10 customers by sales amount"
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all duration-200"
                rows="3"
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">Ctrl + Enter to execute</div>
            </div>
          </div>

          {/* Example Queries */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Try these example queries:</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {exampleQueries.map((exampleQuery, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleQuery(exampleQuery)}
                  className="text-left p-3 bg-gray-50 hover:bg-primary-50 border border-gray-200 hover:border-primary-300 rounded-lg transition-all duration-200 text-sm"
                >
                  <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>
                  {exampleQuery}
                </button>
              ))}
            </div>
          </div>

          {/* Execute Button */}
          <button
            onClick={handleQuery}
            disabled={loading || !query.trim()}
            className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Processing...</span>
              </>
            ) : (
              <>
                <i className="fas fa-play mr-2"></i>
                Execute Query
              </>
            )}
          </button>
        </div>
      </div>

      {/* Query Result */}
      {queryResult && (
        <div className="result-card mb-6">
          <ResultCard
            title="Query Result"
            content={queryResult}
            icon="fas fa-table"
            type={queryResult.includes("Error") ? "error" : "success"}
          />
        </div>
      )}

      {/* Query History */}
      {queryHistory.length > 0 && (
        <div className="bg-white rounded-xl p-6 card-shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            <i className="fas fa-history text-gray-600 mr-2"></i>
            Recent Queries
          </h3>
          <div className="space-y-3">
            {queryHistory.map((item, index) => (
              <div key={index} className="border-l-4 border-primary-500 pl-4 py-2 bg-gray-50 rounded-r-lg">
                <div className="text-sm font-medium text-gray-800 mb-1">{item.query}</div>
                <div className="text-xs text-gray-500">{item.timestamp.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default QueryTab
