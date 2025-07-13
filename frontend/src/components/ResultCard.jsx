"use client"

import { useState } from "react"

const ResultCard = ({ title, content, icon, type = "info" }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          border: "border-green-200",
          bg: "bg-green-50",
          icon: "text-green-600",
          title: "text-green-800",
        }
      case "error":
        return {
          border: "border-red-200",
          bg: "bg-red-50",
          icon: "text-red-600",
          title: "text-red-800",
        }
      case "warning":
        return {
          border: "border-yellow-200",
          bg: "bg-yellow-50",
          icon: "text-yellow-600",
          title: "text-yellow-800",
        }
      default:
        return {
          border: "border-blue-200",
          bg: "bg-blue-50",
          icon: "text-blue-600",
          title: "text-blue-800",
        }
    }
  }

  const styles = getTypeStyles()
  const isLongContent = content.length > 500

  return (
    <div className={`bg-white rounded-xl p-6 card-shadow border ${styles.border}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <i className={`${icon} ${styles.icon} text-xl mr-3`}></i>
          <h3 className={`text-lg font-semibold ${styles.title}`}>{title}</h3>
        </div>

        {isLongContent && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
          >
            <i className={`fas fa-chevron-${isExpanded ? "up" : "down"} mr-1`}></i>
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>

      <div
        className={`${styles.bg} rounded-lg p-4 transition-all duration-300 ${
          isLongContent && !isExpanded ? "max-h-48 overflow-hidden" : "max-h-96 overflow-y-auto"
        }`}
      >
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">{content}</pre>

        {isLongContent && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
        )}
      </div>

      {/* Copy to clipboard button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => navigator.clipboard.writeText(content)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
        >
          <i className="fas fa-copy mr-1"></i>
          Copy to clipboard
        </button>
      </div>
    </div>
  )
}

export default ResultCard
