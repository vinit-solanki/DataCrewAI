import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import sqlite3
from dotenv import load_dotenv
from crewai import Agent, Task, Crew
import litellm
import uuid
import io
import os

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

# Load environment variables
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

# Initialize LLM
llm = LitellmLLM(model="gemini/gemini-1.5-flash", api_key=api_key, temperature=0.5)

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

# Function to load dataset based on file type
def load_dataset(file_path):
    try:
        file_extension = file_path.split('.')[-1].lower()
        if file_extension == 'csv':
            df = pd.read_csv(file_path)
        elif file_extension == 'tsv':
            df = pd.read_csv(file_path, sep='\t')
        elif file_extension == 'xlsx':
            df = pd.read_excel(file_path)
        elif file_extension == 'sql':
            with open(file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            conn = sqlite3.connect(':memory:')
            cursor = conn.cursor()
            cursor.executescript(sql_content)
            conn.commit()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            table_name = cursor.fetchall()[0][0]
            df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            conn.close()
        else:
            raise ValueError("Unsupported file format")
        return df
    except Exception as e:
        return f"Error loading dataset: {str(e)}"

# Function to save visualizations
def save_visualization(fig, filename):
    buf = io.BytesIO()
    fig.savefig(buf, format='png')
    buf.seek(0)
    with open(filename, 'wb') as f:
        f.write(buf.read())
    buf.close()
    return filename

# Function to analyze dataset
def analyze_dataset(file_path):
    df = load_dataset(file_path)
    if isinstance(df, str):  # Error message
        return df, None

    temp_csv = f"temp_dataset_{uuid.uuid4()}.csv"
    df.to_csv(temp_csv, index=False)

    analysis_task = Task(
        description=f"""
        Analyze the dataset in {temp_csv}. Provide a summary in natural language of:
        1. Column names and their data types.
        2. Basic statistics (mean, median, min, max for numeric columns).
        3. Missing values (number and percentage per column).
        4. Key patterns or insights (e.g., correlations, outliers, distributions).
        Return the summary in markdown format, suitable for a non-technical user.
        """,
        agent=data_analyst,
        expected_output="A markdown-formatted summary of the dataset's structure and insights."
    )

    crew = Crew(agents=[data_analyst], tasks=[analysis_task], verbose=True)
    try:
        result = crew.kickoff()
        os.remove(temp_csv)
        return result.tasks_output[0].raw, df
    except Exception as e:
        os.remove(temp_csv)
        return f"Error in dataset analysis: {str(e)}", None

# Function to process query
def process_query(file_path, query):
    df = load_dataset(file_path)
    if isinstance(df, str):  # Error message
        return df, None, None

    temp_csv = f"temp_dataset_{uuid.uuid4()}.csv"
    df.to_csv(temp_csv, index=False)

    # Create temporary SQLite database
    conn = sqlite3.connect(':memory:')
    df.to_sql('data_table', conn, index=False, if_exists='replace')

    validation_task = Task(
        description=f"""
        Validate the user query: '{query}'.
        1. Check if the query is relevant to the dataset columns: {', '.join(df.columns)}.
        2. Identify the required columns and analysis type (e.g., aggregation, filtering).
        3. If valid, provide a clear interpretation of the query.
        If invalid or ambiguous, suggest a corrected query.
        Return the validation report in natural language.
        """,
        agent=query_validator,
        expected_output="A natural language validation report."
    )

    sql_task = Task(
        description=f"""
        Based on the validated query, generate a SQL query for the dataset in {temp_csv} with columns: {', '.join(df.columns)}.
        The dataset is loaded into a SQLite table named 'data_table'.
        Return only the SQL query as a string, ensuring it is valid SQLite syntax.
        Example: SELECT column_name FROM data_table GROUP BY column_name ORDER BY COUNT(*) DESC LIMIT 5;
        """,
        agent=sql_generator,
        expected_output="A valid SQLite query string."
    )

    crew = Crew(agents=[query_validator, sql_generator], tasks=[validation_task, sql_task], verbose=True)
    try:
        result = crew.kickoff()
        sql_query = result.tasks_output[1].raw
        result_df = pd.read_sql_query(sql_query, conn)
        conn.close()

        # Convert result to natural language
        if not result_df.empty:
            result_summary = f"The query '{query}' returned the following results:\n\n"
            if len(result_df) <= 5:
                for _, row in result_df.iterrows():
                    result_summary += f"- {', '.join([f'{col}: {val}' for col, val in row.items()])}\n"
            else:
                result_summary += f"Showing top 5 of {len(result_df)} results:\n"
                for _, row in result_df.head().iterrows():
                    result_summary += f"- {', '.join([f'{col}: {val}' for col, val in row.items()])}\n"
        else:
            result_summary = "No results found for the query."

        os.remove(temp_csv)
        return result.tasks_output[0].raw, sql_query, result_summary
    except Exception as e:
        conn.close()
        os.remove(temp_csv)
        return f"Error in query processing: {str(e)}", None, None

# Function to generate visualizations
def generate_visualizations(file_path):
    df = load_dataset(file_path)
    if isinstance(df, str):  # Error message
        return df, []

    temp_csv = f"temp_dataset_{uuid.uuid4()}.csv"
    df.to_csv(temp_csv, index=False)

    numeric_cols = df.select_dtypes(include=['number']).columns
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    viz_descriptions = []
    viz_files = []

    # Visualization 1: Histogram of a Numeric Column
    if len(numeric_cols) > 0:
        plt.figure(figsize=(8, 6))
        sns.histplot(df[numeric_cols[0]], kde=True)
        plt.title(f'Distribution of {numeric_cols[0]}')
        plt.xlabel(numeric_cols[0])
        plt.ylabel('Frequency')
        viz_file = f"viz_histogram_{uuid.uuid4()}.png"
        save_visualization(plt.gcf(), viz_file)
        plt.close()
        viz_descriptions.append(
            f"- **Distribution of {numeric_cols[0]}**\n  - File: {viz_file}\n  - Description: This chart shows how the values of {numeric_cols[0]} are distributed across the dataset, with a curve indicating the density of values."
        )
        viz_files.append(viz_file)

    # Visualization 2: Bar Plot of a Categorical Column
    if len(categorical_cols) > 0:
        plt.figure(figsize=(10, 6))
        sns.countplot(x=categorical_cols[0], data=df)
        plt.title(f'Count of Each Category in {categorical_cols[0]}')
        plt.xlabel(categorical_cols[0])
        plt.ylabel('Count')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        viz_file = f"viz_barplot_{uuid.uuid4()}.png"
        save_visualization(plt.gcf(), viz_file)
        plt.close()
        viz_descriptions.append(
            f"- **Count of {categorical_cols[0]}**\n  - File: {viz_file}\n  - Description: This chart displays the number of items in each category of {categorical_cols[0]}, showing which categories are most common."
        )
        viz_files.append(viz_file)

    # Run CrewAI visualization task for additional insights
    visualization_task = Task(
        description=f"""
        Analyze the dataset in {temp_csv} with columns: {', '.join(df.columns)}.
        1. Identify numeric and categorical columns.
        2. Suggest at least two visualizations (e.g., histogram, bar plot, scatter plot).
        3. Provide a natural language description for each visualization, suitable for a non-technical user.
        Do not include Python code in the output. Return only the descriptions in markdown format.
        Example output:
        ### Visualizations
        - **Distribution of Sales**
          - Description: This chart shows how sales values are distributed, with most sales clustering around a certain range.
        - **Category Counts**
          - Description: This chart shows the number of items in each category, highlighting the most common categories.
        """,
        agent=visualization_expert,
        expected_output="Markdown-formatted descriptions of visualizations."
    )

    crew = Crew(agents=[visualization_expert], tasks=[visualization_task], verbose=True)
    try:
        result = crew.kickoff()
        os.remove(temp_csv)
        return "\n".join(viz_descriptions) + "\n\n" + result.tasks_output[0].raw, viz_files
    except Exception as e:
        os.remove(temp_csv)
        return f"Error in visualization generation: {str(e)}", []