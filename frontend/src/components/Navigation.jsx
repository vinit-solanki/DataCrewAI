"use client"

const Navigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "upload", label: "Upload Dataset", icon: "fas fa-upload" },
    { id: "query", label: "Query Data", icon: "fas fa-search" },
    { id: "summary", label: "Dataset Summary", icon: "fas fa-chart-bar" },
  ]

  const TabButton = ({ tab, isActive, onClick }) => (
    <button
      onClick={() => onClick(tab.id)}
      className={`tab-button flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
        isActive
          ? "active bg-white text-primary-600 shadow-md transform -translate-y-1"
          : "text-white hover:bg-white hover:bg-opacity-20"
      }`}
    >
      <i className={`${tab.icon} mr-2`}></i>
      <span className="hidden sm:inline">{tab.label}</span>
    </button>
  )

  return (
    <div className="gradient-bg">
      <div className="container mx-auto px-6">
        <div className="flex flex-wrap justify-center sm:justify-start space-x-2 sm:space-x-4 pb-6">
          {tabs.map((tab) => (
            <TabButton key={tab.id} tab={tab} isActive={activeTab === tab.id} onClick={setActiveTab} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Navigation
