"use client"

import { useState, useRef } from "react"
import { apiService } from "../services/apiService"
import ResultCard from "./ResultCard"
import LoadingSpinner from "./LoadingSpinner"

const UploadTab = ({ loading, setLoading, onDatasetLoaded }) => {
  const [uploadResult, setUploadResult] = useState("")
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileUpload = async (file) => {
    if (!file) return

    setLoading(true)
    setUploadResult("")

    try {
      const data = await apiService.uploadFile(file)

      if (data.success) {
        setUploadResult(data.result)
        onDatasetLoaded()
      } else {
        setUploadResult(`Error: ${data.error}`)
      }
    } catch (error) {
      setUploadResult(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    handleFileUpload(file)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="max-w-4xl mx-auto animate-slide-up">
      <div className="bg-white rounded-xl p-8 card-shadow mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          <i className="fas fa-upload text-primary-600 mr-3"></i>
          Upload Your Dataset
        </h2>

        <div
          className={`file-upload-area border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${
            dragActive
              ? "border-primary-500 bg-primary-50"
              : "border-gray-300 hover:border-primary-400 hover:bg-gray-50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <div className="space-y-4">
            <i
              className={`fas fa-cloud-upload-alt text-6xl transition-colors duration-300 ${
                dragActive ? "text-primary-500" : "text-gray-400"
              }`}
            ></i>

            <div>
              <p className="text-lg text-gray-600 mb-2">
                {dragActive ? "Drop your file here" : "Drag and drop your file here, or click to browse"}
              </p>
              <p className="text-sm text-gray-500">Supported formats: CSV, Excel (.xlsx, .xls), SQL</p>
              <p className="text-xs text-gray-400 mt-1">Maximum file size: 16MB</p>
            </div>

            <button
              type="button"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 font-medium"
            >
              <i className="fas fa-folder-open mr-2"></i>
              Select File
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.sql"
          onChange={handleFileSelect}
          className="hidden"
        />

        {loading && (
          <div className="flex items-center justify-center mt-6 p-4 bg-blue-50 rounded-lg">
            <LoadingSpinner />
            <span className="text-gray-600 ml-3 font-medium">Processing file...</span>
          </div>
        )}
      </div>

      {uploadResult && (
        <div className="result-card">
          <ResultCard
            title="Upload Result"
            content={uploadResult}
            icon="fas fa-info-circle"
            type={uploadResult.includes("Error") ? "error" : "success"}
          />
        </div>
      )}
    </div>
  )
}

export default UploadTab
