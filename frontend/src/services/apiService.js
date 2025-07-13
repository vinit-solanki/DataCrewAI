import axios from "axios"

const API_BASE_URL = "http://localhost:5000/api"

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
  // Health check
  healthCheck: async () => {
    const response = await api.get("/health")
    return response.data
  },

  // Get current status
  getStatus: async () => {
    const response = await api.get("/status")
    return response.data
  },

  // Upload file
  uploadFile: async (file, tableName = "main_table") => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("table_name", tableName)

    const response = await api.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  // Process query
  processQuery: async (query) => {
    const response = await api.post("/query", { query })
    return response.data
  },

  // Get dataset summary
  getDatasetSummary: async () => {
    const response = await api.get("/summary")
    return response.data
  },
}
