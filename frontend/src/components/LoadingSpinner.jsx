const LoadingSpinner = ({ size = "md", color = "primary" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  }

  const colorClasses = {
    primary: "border-primary-600",
    white: "border-white",
    gray: "border-gray-600",
  }

  return (
    <div
      className={`loading-spinner ${sizeClasses[size]} border-2 border-gray-200 ${colorClasses[color]} border-t-transparent rounded-full animate-spin`}
    ></div>
  )
}

export default LoadingSpinner
