"use client"

import { useState } from "react"
import { apiService } from "../services/apiService"
import ResultCard from "./ResultCard"
import LoadingSpinner from "./LoadingSpinner"

const SummaryTab = ({ datasetLoaded, loading, setLoading }) => {
  const [summaryResult, setSummaryResult] = useState("")

  const handleSummary = async () => {
    setLoading(true)
    setSummaryResult("")

    try {
      const data = await apiService.getDatasetSummary()

      if (data.success) {
        setSummaryResult(data.summary)
      } else {
        setSummaryResult(`Error: ${data.error}`)
      }
    } catch (error) {
      setSummaryResult(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!datasetLoaded) {
    return (
      <div className="max-w-4xl mx-auto animate-slide-up">
        <div className="bg-white rounded-xl p-8 card-shadow text-center">
          <i className="fas fa-exclamation-triangle text-6xl text-yellow-500 mb-6"></i>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">No Dataset Loaded</h3>
          <p className="text-lg text-gray-600 mb-6">Please upload a dataset first to view the summary.</p>
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
          <i className="fas fa-chart-bar text-primary-600 mr-3"></i>
          Dataset Summary
        </h2>

        <div className="space-y-6">
          <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-6 border border-primary-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              <i className="fas fa-info-circle text-primary-600 mr-2"></i>
              What you'll get:
            </h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                Comprehensive dataset structure analysis
              </li>
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                Column types and data statistics
              </li>
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                Sample records and data quality insights
              </li>
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                AI-powered recommendations for analysis
              </li>
            </ul>
          </div>

          <button
            onClick={handleSummary}
            disabled={loading}
            className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Generating Summary...</span>
              </>
            ) : (
              <>
                <i className="fas fa-analytics mr-2"></i>
                Generate Summary
              </>
            )}
          </button>
        </div>
      </div>

      {summaryResult && (
        <div className="result-card">
          <ResultCard
            title="Dataset Summary"
            content={summaryResult}
            icon="fas fa-chart-line"
            type={summaryResult.includes("Error") ? "error" : "success"}
          />
        </div>
      )}
    </div>
  )
}

export default SummaryTab
