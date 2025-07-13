const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-8 mt-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              <i className="fas fa-robot mr-2"></i>
              CrewAI SQL Agent
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Intelligent data analysis platform powered by CrewAI agents, LangChain, and Google Gemini AI for natural
              language SQL querying.
            </p>
          </div>

          {/* Features Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              <i className="fas fa-star mr-2"></i>
              Features
            </h3>
            <ul className="text-gray-400 text-sm space-y-2">
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                Multi-Agent AI System
              </li>
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                Natural Language Queries
              </li>
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                Multiple File Formats
              </li>
              <li className="flex items-center">
                <i className="fas fa-check text-green-500 mr-2"></i>
                Real-time Processing
              </li>
            </ul>
          </div>

          {/* Tech Stack Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              <i className="fas fa-code mr-2"></i>
              Powered By
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full">CrewAI</span>
              <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full">LangChain</span>
              <span className="px-3 py-1 bg-purple-600 text-white text-xs rounded-full">Google AI</span>
              <span className="px-3 py-1 bg-red-600 text-white text-xs rounded-full">Flask</span>
              <span className="px-3 py-1 bg-blue-500 text-white text-xs rounded-full">React</span>
              <span className="px-3 py-1 bg-teal-600 text-white text-xs rounded-full">Tailwind</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-6 text-center">
          <p className="text-gray-400 text-sm">© 2024 CrewAI SQL Agent. Built with ❤️ for intelligent data analysis.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
