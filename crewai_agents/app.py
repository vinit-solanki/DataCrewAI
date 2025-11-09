from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import os
import sqlite3
from dotenv import load_dotenv
from crewai import Agent, Task, Crew
import litellm
import uuid
import io
import base64
from werkzeug.utils import secure_filename
import tempfile
import json

app = Flask(__name__)
CORS(app)

# Load environment variables
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("Missing GOOGLE_API_KEY in environment variables")
os.environ["GOOGLE_API_KEY"] = api_key   # ✅ litellm will now use it automatically

# Custom LLM class for litellm integration with CrewAI
class LitellmLLM:
    def __init__(self, model, api_key, temperature=0.5):
        self.model = model
        self.api_key = api_key
        self.temperature = temperature

    def call(self, prompt, **kwargs):
        try:
            response = litellm.completion(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                api_key=self.api_key,
                temperature=self.temperature,
                **kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error in LLM call: {str(e)}"

# Initialize custom LLM for Gemini
llm = LitellmLLM(model="gemini/gemini-2.5-flash", api_key=api_key, temperature=0.5)

# Define CrewAI Agents
data_analyst = Agent(
    role="Data Analyst",
    goal="Understand and summarize the dataset's structure and key insights",
    backstory="You are an expert data analyst skilled in exploratory data analysis, identifying patterns, and summarizing datasets.",
    llm=llm,
    allow_delegation=False
)

query_validator = Agent(
    role="Query Validator",
    goal="Validate and interpret user queries for dataset analysis",
    backstory="You are a natural language processing expert who validates and translates user queries into actionable data tasks.",
    llm=llm,
    allow_delegation=False
)

sql_generator = Agent(
    role="SQL Generator",
    goal="Generate SQL queries based on validated user queries",
    backstory="You are a database expert proficient in crafting SQL queries to extract relevant data from datasets.",
    llm=llm,
    allow_delegation=False
)

visualization_expert = Agent(
    role="Visualization Expert",
    goal="Generate insightful visualizations and describe them in natural language",
    backstory="You are a data visualization specialist skilled in creating clear and informative charts and explaining them clearly.",
    llm=llm,
    allow_delegation=False
)

def load_dataset(file_path, file_extension):
    """Load dataset based on file type"""
    try:
        if file_extension == 'csv':
            df = pd.read_csv(file_path)
        elif file_extension == 'tsv':
            df = pd.read_csv(file_path, sep='\t')
        elif file_extension == 'xlsx':
            df = pd.read_excel(file_path)
        elif file_extension == 'sql':
            conn = sqlite3.connect(':memory:')
            cursor = conn.cursor()
            with open(file_path, 'r') as f:
                cursor.executescript(f.read())
            conn.commit()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            if tables:
                table_name = tables[0][0]
                df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            else:
                raise ValueError("No tables found in SQL file")
            conn.close()
        else:
            raise ValueError("Unsupported file format")
        return df
    except Exception as e:
        raise Exception(f"Error loading dataset: {str(e)}")

def create_visualization(df, viz_type, column=None):
    """Create visualization and return base64 encoded image"""
    plt.figure(figsize=(10, 6))
    
    if viz_type == 'histogram' and column:
        sns.histplot(df[column], kde=True)
        plt.title(f'Distribution of {column}')
        plt.xlabel(column)
        plt.ylabel('Frequency')
    elif viz_type == 'countplot' and column:
        sns.countplot(x=column, data=df)
        plt.title(f'Count of Each Category in {column}')
        plt.xlabel(column)
        plt.ylabel('Count')
        plt.xticks(rotation=45, ha='right')
    elif viz_type == 'correlation':
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 1:
            sns.heatmap(df[numeric_cols].corr(), annot=True, cmap='coolwarm')
            plt.title('Correlation Matrix')
    
    plt.tight_layout()
    
    # Convert plot to base64 string
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close()
    
    return image_base64

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        file_extension = filename.split('.')[-1].lower()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as tmp_file:
            file.save(tmp_file.name)
            temp_file_path = tmp_file.name
        
        # Load dataset
        df = load_dataset(temp_file_path, file_extension)
        
        # Basic dataset info
        dataset_info = {
            'shape': df.shape,
            'columns': df.columns.tolist(),
            'dtypes': df.dtypes.astype(str).to_dict(),
            'preview': df.head().to_dict('records'),
            'missing_values': df.isnull().sum().to_dict(),
            'numeric_columns': df.select_dtypes(include=['number']).columns.tolist(),
            'categorical_columns': df.select_dtypes(include=['object', 'category']).columns.tolist()
        }
        
        # Save dataset for later use
        csv_path = f"temp_dataset_{uuid.uuid4()}.csv"
        df.to_csv(csv_path, index=False)
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        return jsonify({
            'success': True,
            'dataset_info': dataset_info,
            'dataset_id': csv_path
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze_dataset():
    try:
        data = request.json
        dataset_id = data.get('dataset_id')
        
        if not dataset_id or not os.path.exists(dataset_id):
            return jsonify({'error': 'Dataset not found'}), 400
        
        df = pd.read_csv(dataset_id)
        
        # Create analysis task
        analysis_task = Task(
            description=f"""
            Analyze the dataset with columns: {', '.join(df.columns)}.
            Provide a comprehensive summary including:
            1. Dataset overview (shape, columns, data types)
            2. Statistical summary for numeric columns
            3. Missing values analysis
            4. Key insights and patterns
            5. Data quality assessment
            
            Format the response in clear, structured markdown suitable for business users.
            """,
            agent=data_analyst,
            expected_output="A comprehensive markdown-formatted analysis report."
        )
        
        # Execute analysis
        analysis_crew = Crew(
            agents=[data_analyst],
            tasks=[analysis_task],
            verbose=False
        )
        
        result = analysis_crew.kickoff()
        analysis_report = result.tasks_output[0].raw   # ✅ only .raw works
        
        return jsonify({
            'success': True,
            'analysis': analysis_report
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/query', methods=['POST'])
def process_query():
    try:
        data = request.json
        dataset_id = data.get('dataset_id')
        user_query = data.get('query')
        
        if not dataset_id or not os.path.exists(dataset_id):
            return jsonify({'error': 'Dataset not found'}), 400
        
        df = pd.read_csv(dataset_id)
        
        # Create SQLite connection
        conn = sqlite3.connect(':memory:')
        df.to_sql('data_table', conn, index=False, if_exists='replace')
        
        # Validation task - enforce JSON output
        validation_task = Task(
            description=f"""
            Validate the user query: '{user_query}'.
            Dataset columns: {', '.join(df.columns)}
            
            Return ONLY valid JSON with these keys:
            - valid: true/false
            - explanation: string
            - suggestion: string
            """,
            agent=query_validator,
            expected_output="JSON with keys: valid, explanation, suggestion"
        )
        
        # SQL generation task
        sql_task = Task(
            description=f"""
            Generate a SQLite query for: '{user_query}'
            Table name: data_table
            Columns: {', '.join(df.columns)}
            
            Return ONLY the SQL query string, no explanations.
            Ensure proper SQLite syntax.
            """,
            agent=sql_generator,
            expected_output="A valid SQLite query string."
        )
        
        # Execute query workflow
        query_crew = Crew(
            agents=[query_validator, sql_generator],
            tasks=[validation_task, sql_task],
            verbose=False
        )
        
        result = query_crew.kickoff()
        validation_raw = result.tasks_output[0].raw
        sql_query = result.tasks_output[1].raw.strip()
        
        # Try parsing JSON validation
        try:
            validation_report = json.loads(validation_raw)
        except Exception:
            validation_report = {"valid": False, "explanation": validation_raw, "suggestion": ""}
        
        # Execute SQL if valid
        query_result = None
        if validation_report.get("valid"):
            try:
                sql_query = sql_query.replace('```sql', '').replace('```', '').strip()
                result_df = pd.read_sql_query(sql_query, conn)
                query_result = {
                    'data': result_df.to_dict('records'),
                    'columns': result_df.columns.tolist(),
                    'row_count': len(result_df)
                }
            except Exception as e:
                query_result = {'error': f'SQL execution error: {str(e)}'}
        
        conn.close()
        
        return jsonify({
            'success': True,
            'validation': validation_report,
            'sql_query': sql_query,
            'result': query_result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/visualize', methods=['POST'])
def create_visualizations():
    try:
        data = request.json
        dataset_id = data.get('dataset_id')
        
        if not dataset_id or not os.path.exists(dataset_id):
            return jsonify({'error': 'Dataset not found'}), 400
        
        df = pd.read_csv(dataset_id)
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        visualizations = []
        
        if numeric_cols:
            hist_image = create_visualization(df, 'histogram', numeric_cols[0])
            visualizations.append({
                'type': 'histogram',
                'title': f'Distribution of {numeric_cols[0]}',
                'description': f'This histogram shows the distribution of values in the {numeric_cols[0]} column.',
                'image': hist_image
            })
        
        if categorical_cols:
            count_image = create_visualization(df, 'countplot', categorical_cols[0])
            visualizations.append({
                'type': 'countplot',
                'title': f'Count by {categorical_cols[0]}',
                'description': f'This bar chart shows the frequency of each category in the {categorical_cols[0]} column.',
                'image': count_image
            })
        
        if len(numeric_cols) > 1:
            corr_image = create_visualization(df, 'correlation')
            visualizations.append({
                'type': 'correlation',
                'title': 'Correlation Matrix',
                'description': 'This heatmap shows correlations between numeric variables in the dataset.',
                'image': corr_image
            })
        
        return jsonify({
            'success': True,
            'visualizations': visualizations
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cleanup', methods=['POST'])
def cleanup_files():
    try:
        data = request.json
        dataset_id = data.get('dataset_id')
        
        if dataset_id and os.path.exists(dataset_id):
            os.unlink(dataset_id)
        
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
