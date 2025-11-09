# DataCrew AI - Intelligent Dataset Analysis Platform

### Refer to the demo working of the project here: https://drive.google.com/file/d/14_jPRpqQGWFD4E2rwbhciZgBhhRAaFF3/view?usp=sharing

<p align="center">
    <img src="./architeture.png" alt="DataCrew AI system architecture" />
</p>

**Figure 1:** System architecture of DataCrew AI.
A modern web application that combines React.js frontend with Flask backend to provide AI-powered dataset analysis using CrewAI agents.

## Features

- **Multi-format Support**: Upload CSV, TSV, XLSX, and SQL files
- **AI-Powered Analysis**: Automated dataset understanding and insights
- **Natural Language Queries**: Ask questions about your data in plain English
- **Automatic Visualizations**: AI-generated charts and graphs
- **Modern UI**: Professional, responsive design with Tailwind CSS

## Setup Instructions

### Backend Setup

1. Install Python dependencies:
\`\`\`bash
pip install -r requirements.txt
\`\`\`

2. Set up environment variables:
\`\`\`bash
cp .env.example .env
# Edit .env and add your Google API key for Gemini
\`\`\`

3. Run the Flask server:
\`\`\`bash
cd backend
python app.py
\`\`\`

### Frontend Setup

The frontend is built with Next.js and will run automatically in the v0 environment.

## Usage

1. **Upload Dataset**: Drag and drop or select your dataset file
2. **View Overview**: See dataset statistics and AI-generated analysis
3. **Query Data**: Ask questions in natural language
4. **Explore Visualizations**: View automatically generated charts

## API Endpoints

- `POST /upload` - Upload and process dataset
- `POST /analyze` - Generate AI analysis
- `POST /query` - Process natural language queries
- `POST /visualize` - Create visualizations
- `POST /cleanup` - Clean up temporary files

## Technologies Used

- **Frontend**: React.js, Next.js, Tailwind CSS
- **Backend**: Flask, CrewAI, LiteLLM
- **AI**: Google Gemini (free tier)
- **Data Processing**: Pandas, Seaborn, Matplotlib