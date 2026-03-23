import axios from "axios"

const API_BASE_URL = "http://localhost:5000"

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method.toUpperCase()} request to ${config.url}`)
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error("API Error:", error.response?.data || error.message)
    return Promise.reject(error)
  },
)

export const apiService = {
  // Upload file
  uploadFile: async (file) => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await api.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  // Process query
  processQuery: async (datasetId, query) => {
    const response = await api.post("/query", { dataset_id: datasetId, query })
    return response.data
  },

  // Analyze dataset
  analyzeDataset: async (datasetId) => {
    const response = await api.post("/analyze", { dataset_id: datasetId })
    return response.data
  },

  // Generate executive dashboard intelligence
  getDashboardIntelligence: async (datasetId) => {
    const response = await api.post("/dashboard", { dataset_id: datasetId })
    return response.data
  },

  // Generate visualizations
  createVisualizations: async (datasetId) => {
    const response = await api.post("/visualize", { dataset_id: datasetId })
    return response.data
  },

  // Cleanup dataset files
  cleanupDataset: async (datasetId) => {
    const response = await api.post("/cleanup", { dataset_id: datasetId })
    return response.data
  },
}
