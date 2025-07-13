const Header = ({ datasetLoaded }) => {
  return (
    <div className="gradient-bg text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            <i className="fas fa-robot mr-3 text-yellow-300"></i>
            CrewAI SQL Agent
          </h1>
          <p className="text-xl md:text-2xl opacity-90 mb-6">
            Intelligent Data Analysis with Natural Language Processing
          </p>

          <div className="flex items-center justify-center space-x-4">
            <div
              className={`flex items-center px-4 py-2 rounded-full transition-all duration-300 ${
                datasetLoaded ? "bg-green-500 shadow-lg" : "bg-red-500 shadow-lg"
              }`}
            >
              <i className={`fas ${datasetLoaded ? "fa-check-circle" : "fa-exclamation-circle"} mr-2`}></i>
              <span className="font-medium">{datasetLoaded ? "Dataset Loaded" : "No Dataset"}</span>
            </div>

            <div className="flex items-center px-4 py-2 bg-white bg-opacity-20 rounded-full">
              <i className="fas fa-brain mr-2"></i>
              <span className="font-medium">AI Powered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Header
