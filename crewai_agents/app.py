"""
DataDetective Backend — Advanced Agentic Data Analysis API
Author: AI Engineer | 2026
Stack: Flask · CrewAI · OpenRouter (DeepSeek V3) · SQLite · Pandas · Plotly

LLM Routing:
  Provider : OpenRouter  (https://openrouter.ai)
  Model    : deepseek/deepseek-chat-v3-0324
  Why      : 64K context · high RPM limits · near-zero rate-limit errors
             in agentic loops · strong instruction-following · very cheap
  Fallback : openai/gpt-4o-mini  (auto-swap if primary fails)
"""

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.io as pio
import os
import sqlite3
from dotenv import load_dotenv
from crewai import Agent, Task, Crew
from langchain_community.chat_models import ChatLiteLLM
import litellm
import uuid
import io
import base64
from werkzeug.utils import secure_filename
import tempfile
import json
import re
import time
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

ALLOWED_EXTENSIONS = {'csv', 'tsv', 'xlsx', 'sql'}
DATASET_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(DATASET_DIR, exist_ok=True)

load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise ValueError("Missing OPENROUTER_API_KEY in environment variables")

# ─────────────────────────────────────────────
# OPENROUTER CONFIG
# ─────────────────────────────────────────────
# Primary  : DeepSeek V3 — 64K ctx, high rate limits, excellent JSON/SQL output
# Fallback : GPT-4o-mini  — reliable safety net if primary quota exhausted
# OpenRouter normalises all models to the OpenAI messages format.

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
PRIMARY_MODEL       = "openrouter/deepseek/deepseek-chat-v3-0324"   # best for agentic tasks 2026
FALLBACK_MODEL      = "openrouter/openai/gpt-4o-mini"                # safety net

# CrewAI/LangChain may pass params that OpenRouter rejects on some LiteLLM versions.
litellm.drop_params = True

# Optional: identify your app in OpenRouter dashboard headers
OPENROUTER_HEADERS = {
    "HTTP-Referer": "https://datadetective.app",
    "X-Title": "DataDetective",
}


primary_llm = ChatLiteLLM(
    model=PRIMARY_MODEL,
    openrouter_api_key=OPENROUTER_API_KEY,
    api_base=OPENROUTER_BASE_URL,
    streaming=False,
    temperature=0.3,
    max_tokens=4096,
)

fallback_llm = ChatLiteLLM(
    model=FALLBACK_MODEL,
    openrouter_api_key=OPENROUTER_API_KEY,
    api_base=OPENROUTER_BASE_URL,
    streaming=False,
    temperature=0.3,
    max_tokens=4096,
)

llm = primary_llm.with_fallbacks([fallback_llm])


# ─────────────────────────────────────────────
# AGENTS — Each has a sharp, focused role
# ─────────────────────────────────────────────

data_profiler = Agent(
    role="Data Profiler",
    goal="Build a comprehensive, human-readable profile of the dataset",
    backstory=(
        "You are a senior data scientist who excels at turning raw dataset metadata "
        "into clear, executive-level insights. You explain data quality, distributions, "
        "and structure in a way that both technical and non-technical users understand."
    ),
    llm=llm,
    allow_delegation=False
)

query_interpreter = Agent(
    role="Query Interpreter",
    goal="Translate any natural language question into a precise analytical intent",
    backstory=(
        "You are an expert in semantic parsing and data querying. You bridge the gap "
        "between what users ask in plain English and what a database or analytics engine needs. "
        "You handle ambiguity, typos, and vague requests gracefully."
    ),
    llm=llm,
    allow_delegation=False
)

sql_craftsman = Agent(
    role="SQL Craftsman",
    goal="Write optimal, safe, read-only SQLite queries",
    backstory=(
        "You are a database architect with 15 years of SQL expertise. "
        "You write clean, efficient queries and never mutate data. "
        "You handle edge cases like NULLs, type casting, and aggregations perfectly."
    ),
    llm=llm,
    allow_delegation=False
)

insight_narrator = Agent(
    role="Insight Narrator",
    goal="Turn query results and data summaries into compelling, actionable narratives",
    backstory=(
        "You are a data storytelling expert — part journalist, part analyst. "
        "You take numbers and turn them into clear narratives that drive decisions. "
        "You highlight what's surprising, what's expected, and what requires action."
    ),
    llm=llm,
    allow_delegation=False
)

detective_agent = Agent(
    role="Data Detective",
    goal="Autonomously hunt for anomalies, outliers, hidden patterns, and suspicious signals in datasets",
    backstory=(
        "You are a forensic data analyst — the Sherlock Holmes of datasets. "
        "You proactively investigate data for outliers, distribution skews, suspicious correlations, "
        "data quality issues, and hidden patterns. You present findings as a detective's case file, "
        "with evidence, hypotheses, and recommendations. You never miss a clue."
    ),
    llm=llm,
    allow_delegation=False
)

viz_strategist = Agent(
    role="Visualization Strategist",
    goal="Determine the optimal chart type and configuration for a given query and dataset",
    backstory=(
        "You are a data visualization expert trained in Tufte's principles, "
        "cognitive load theory, and modern dashboard design. "
        "You choose chart types that maximize clarity and insight revelation."
    ),
    llm=llm,
    allow_delegation=False
)


# ─────────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────────

def parse_json_safe(text):
    if not text:
        return None
    cleaned = str(text).strip().replace('```json', '').replace('```', '').strip()
    try:
        return json.loads(cleaned)
    except Exception:
        for pattern in [r'\{[\s\S]*\}', r'\[[\s\S]*\]']:
            match = re.search(pattern, cleaned)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    continue
    return None


def sanitize_sql(sql_query):
    cleaned = str(sql_query or '').replace('```sql', '').replace('```', '').strip()
    return cleaned.rstrip(';')


def is_safe_query(sql):
    if not sql:
        return False
    lowered = sql.lower().strip()
    if not (lowered.startswith('select') or lowered.startswith('with')):
        return False
    forbidden = r'\b(insert|update|delete|drop|alter|truncate|attach|detach|pragma|create|replace)\b'
    return not re.search(forbidden, lowered)


def resolve_dataset(dataset_id):
    safe_name = secure_filename(os.path.basename(dataset_id or ''))
    if not safe_name.startswith('temp_dataset_') or not safe_name.endswith('.csv'):
        raise ValueError('Invalid dataset identifier')
    path = os.path.join(DATASET_DIR, safe_name)
    if not os.path.exists(path):
        raise FileNotFoundError('Dataset not found. Please re-upload.')
    return path


def safe_unlink(path, retries=5, delay=0.1):
    """Best-effort delete with small retries for Windows file locks."""
    if not path:
        return
    for attempt in range(retries):
        try:
            if os.path.exists(path):
                os.unlink(path)
            return
        except PermissionError:
            if attempt == retries - 1:
                raise
            time.sleep(delay)


def load_raw_dataset(file_path, ext):
    if ext == 'csv':
        return pd.read_csv(file_path)
    elif ext == 'tsv':
        return pd.read_csv(file_path, sep='\t')
    elif ext == 'xlsx':
        return pd.read_excel(file_path)
    elif ext == 'sql':
        conn = sqlite3.connect(':memory:')
        with open(file_path, 'r') as f:
            conn.cursor().executescript(f.read())
        conn.commit()
        tables = conn.cursor().execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
        if not tables:
            raise ValueError("No tables found in SQL file")
        df = pd.read_sql_query(f"SELECT * FROM {tables[0][0]}", conn)
        conn.close()
        return df
    raise ValueError(f"Unsupported format: {ext}")


def build_rich_profile(df: pd.DataFrame) -> dict:
    """
    Builds a comprehensive statistical profile used by all agents.
    This is the shared memory/context that powers all agentic tasks.
    """
    numeric_cols = df.select_dtypes(include='number').columns.tolist()
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    datetime_cols = df.select_dtypes(include='datetime').columns.tolist()

    missing = df.isnull().sum()
    total_rows = max(len(df), 1)

    # Outlier detection using IQR
    outlier_flags = {}
    for col in numeric_cols:
        q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        iqr = q3 - q1
        outlier_count = int(((df[col] < q1 - 1.5 * iqr) | (df[col] > q3 + 1.5 * iqr)).sum())
        outlier_flags[col] = {'count': outlier_count, 'percent': round(outlier_count / total_rows * 100, 2)}

    # Skewness and kurtosis
    distribution_stats = {}
    for col in numeric_cols:
        clean = df[col].dropna()
        if len(clean) > 3:
            distribution_stats[col] = {
                'skewness': round(float(stats.skew(clean)), 4),
                'kurtosis': round(float(stats.kurtosis(clean)), 4)
            }

    # Top correlations
    top_correlations = []
    if len(numeric_cols) > 1:
        corr_matrix = df[numeric_cols].corr()
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                val = corr_matrix.iloc[i, j]
                if abs(val) > 0.5:
                    top_correlations.append({
                        'col1': numeric_cols[i],
                        'col2': numeric_cols[j],
                        'correlation': round(float(val), 4)
                    })
        top_correlations.sort(key=lambda x: abs(x['correlation']), reverse=True)

    # Categorical value distributions
    cat_summaries = {}
    for col in categorical_cols[:5]:  # limit for token budget
        vc = df[col].value_counts()
        cat_summaries[col] = {
            'unique_count': int(df[col].nunique()),
            'top_5': vc.head(5).to_dict()
        }

    # Duplicate detection
    dup_count = int(df.duplicated().sum())

    return {
        'shape': {'rows': int(df.shape[0]), 'columns': int(df.shape[1])},
        'columns': df.columns.tolist(),
        'dtypes': {k: str(v) for k, v in df.dtypes.items()},
        'numeric_columns': numeric_cols,
        'categorical_columns': categorical_cols,
        'datetime_columns': datetime_cols,
        'missing': {
            col: {'count': int(missing[col]), 'percent': round(float(missing[col] / total_rows * 100), 2)}
            for col in df.columns
        },
        'numeric_summary': (
            df[numeric_cols].describe().round(4).to_dict() if numeric_cols else {}
        ),
        'outlier_analysis': outlier_flags,
        'distribution_stats': distribution_stats,
        'top_correlations': top_correlations[:10],
        'categorical_summaries': cat_summaries,
        'duplicate_rows': {'count': dup_count, 'percent': round(dup_count / total_rows * 100, 2)},
        'sample_rows': df.head(5).replace({pd.NA: None}).where(pd.notnull(df.head(5)), None).to_dict('records'),
    }


# ─────────────────────────────────────────────
# PLOTLY VISUALIZATION ENGINE
# Smart chart selection based on data semantics
# ─────────────────────────────────────────────

PLOTLY_THEME = {
    "template": "plotly_dark",
    "paper_bgcolor": "rgba(0,0,0,0)",
    "plot_bgcolor": "rgba(15,15,25,0.8)",
    "font_color": "#e2e8f0",
    "colorscale": "Viridis"
}


def fig_to_base64(fig) -> str:
    img_bytes = pio.to_image(fig, format='png', width=900, height=500, scale=2)
    return base64.b64encode(img_bytes).decode()


def fig_to_json(fig) -> dict:
    """Returns Plotly JSON for interactive frontend rendering."""
    return json.loads(pio.to_json(fig))


def smart_visualize(df: pd.DataFrame, query: str = None, viz_type: str = None, column: str = None) -> list:
    """
    Smart visualization engine. Returns list of chart objects with:
    - plotly_json: for interactive frontend rendering
    - image: base64 fallback
    - title, description, chart_type
    """
    numeric_cols = df.select_dtypes(include='number').columns.tolist()
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    charts = []

    template = PLOTLY_THEME["template"]

    # 1. Distribution charts for all numeric columns (top 3)
    for col in numeric_cols[:3]:
        fig = go.Figure()
        fig.add_trace(go.Histogram(
            x=df[col].dropna(),
            name=col,
            marker_color='#6366f1',
            opacity=0.85,
            nbinsx=40
        ))
        # Add KDE overlay
        kde_data = df[col].dropna()
        if len(kde_data) > 5:
            kde = stats.gaussian_kde(kde_data)
            x_range = np.linspace(kde_data.min(), kde_data.max(), 200)
            kde_vals = kde(x_range) * len(kde_data) * (kde_data.max() - kde_data.min()) / 40
            fig.add_trace(go.Scatter(
                x=x_range, y=kde_vals,
                mode='lines',
                name='Density',
                line=dict(color='#f43f5e', width=2.5)
            ))

        fig.update_layout(
            title=f'Distribution of {col}',
            template=template,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(15,15,25,0.8)',
            font=dict(color='#e2e8f0'),
            xaxis_title=col,
            yaxis_title='Frequency',
            showlegend=True,
            height=400
        )
        charts.append({
            'chart_type': 'histogram',
            'title': f'Distribution of {col}',
            'description': f'Shows value distribution and density curve for {col}',
            'plotly_json': fig_to_json(fig),
            'column': col
        })

    # 2. Box plots for outlier visualization
    if len(numeric_cols) >= 2:
        fig = go.Figure()
        for col in numeric_cols[:6]:
            fig.add_trace(go.Box(
                y=df[col].dropna(),
                name=col,
                marker_color='#8b5cf6',
                line_color='#c4b5fd',
                boxpoints='outliers',
                jitter=0.3,
                pointpos=-1.8
            ))
        fig.update_layout(
            title='Outlier Analysis — Box Plots',
            template=template,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(15,15,25,0.8)',
            font=dict(color='#e2e8f0'),
            height=420
        )
        charts.append({
            'chart_type': 'boxplot',
            'title': 'Outlier Analysis — Box Plots',
            'description': 'Reveals outliers and spread across all numeric columns',
            'plotly_json': fig_to_json(fig)
        })

    # 3. Correlation heatmap
    if len(numeric_cols) > 1:
        corr = df[numeric_cols].corr().round(2)
        fig = go.Figure(data=go.Heatmap(
            z=corr.values,
            x=corr.columns.tolist(),
            y=corr.index.tolist(),
            colorscale='RdBu',
            zmid=0,
            text=corr.values,
            texttemplate='%{text}',
            textfont=dict(size=11),
            hoverongaps=False
        ))
        fig.update_layout(
            title='Correlation Heatmap',
            template=template,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(15,15,25,0.8)',
            font=dict(color='#e2e8f0'),
            height=450
        )
        charts.append({
            'chart_type': 'heatmap',
            'title': 'Correlation Heatmap',
            'description': 'Shows linear relationships between all numeric variables. Red = negative, Blue = positive correlation.',
            'plotly_json': fig_to_json(fig)
        })

    # 4. Categorical bar charts
    for col in categorical_cols[:2]:
        vc = df[col].value_counts().head(15)
        fig = go.Figure(go.Bar(
            x=vc.values,
            y=vc.index.tolist(),
            orientation='h',
            marker=dict(
                color=vc.values,
                colorscale='Plasma',
                showscale=True
            )
        ))
        fig.update_layout(
            title=f'Top Categories in {col}',
            template=template,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(15,15,25,0.8)',
            font=dict(color='#e2e8f0'),
            xaxis_title='Count',
            yaxis_title=col,
            height=400
        )
        charts.append({
            'chart_type': 'bar',
            'title': f'Top Categories in {col}',
            'description': f'Frequency distribution of categories in {col}',
            'plotly_json': fig_to_json(fig),
            'column': col
        })

    # 5. Scatter matrix for numeric cols (top 4)
    if len(numeric_cols) >= 3:
        top_cols = numeric_cols[:4]
        color_col = categorical_cols[0] if categorical_cols else None
        fig = px.scatter_matrix(
            df[top_cols + ([color_col] if color_col else [])].dropna(),
            dimensions=top_cols,
            color=color_col,
            title='Scatter Matrix — Pairwise Relationships',
            template=template,
            height=550
        )
        fig.update_traces(diagonal_visible=False, showupperhalf=False)
        fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(15,15,25,0.8)',
            font=dict(color='#e2e8f0')
        )
        charts.append({
            'chart_type': 'scatter_matrix',
            'title': 'Scatter Matrix — Pairwise Relationships',
            'description': 'Explores relationships between every pair of numeric columns simultaneously',
            'plotly_json': fig_to_json(fig)
        })

    # 6. Missing values bar
    missing = df.isnull().sum()
    missing = missing[missing > 0].sort_values(ascending=True)
    if len(missing) > 0:
        fig = go.Figure(go.Bar(
            x=missing.values,
            y=missing.index.tolist(),
            orientation='h',
            marker_color='#f43f5e',
            text=[f'{v} ({v/len(df)*100:.1f}%)' for v in missing.values],
            textposition='outside'
        ))
        fig.update_layout(
            title='Missing Values by Column',
            template=template,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(15,15,25,0.8)',
            font=dict(color='#e2e8f0'),
            xaxis_title='Missing Count',
            height=350
        )
        charts.append({
            'chart_type': 'missing',
            'title': 'Missing Values by Column',
            'description': 'Highlights data completeness issues requiring attention',
            'plotly_json': fig_to_json(fig)
        })

    return charts


# ─────────────────────────────────────────────
# API ROUTES
# ─────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'version': '2.0.0', 'engine': 'DataDetective'})


@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Upload endpoint. Stores dataset, returns rich profile immediately.
    Profile is computed server-side — no agent needed here (fast path).
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'error': 'Empty filename'}), 400

        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({'error': f'Unsupported format: {ext}. Allowed: csv, tsv, xlsx, sql'}), 400

        # On Windows, deleting an open NamedTemporaryFile can raise WinError 32.
        fd, tmp_path = tempfile.mkstemp(suffix=f'.{ext}')
        os.close(fd)
        try:
            file.save(tmp_path)
            df = load_raw_dataset(tmp_path, ext)
        finally:
            safe_unlink(tmp_path)

        # Coerce datetime columns
        for col in df.columns:
            if 'date' in col.lower() or 'time' in col.lower():
                try:
                    df[col] = pd.to_datetime(df[col], infer_datetime_format=True)
                except Exception:
                    pass

        dataset_id = f"temp_dataset_{uuid.uuid4()}.csv"
        df.to_csv(os.path.join(DATASET_DIR, dataset_id), index=False)

        profile = build_rich_profile(df)

        return jsonify({
            'success': True,
            'dataset_id': dataset_id,
            'profile': profile
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Deep analysis via Data Profiler agent.
    Returns markdown narrative + structured insights.
    """
    try:
        data = request.json
        dataset_path = resolve_dataset(data.get('dataset_id'))
        df = pd.read_csv(dataset_path)
        profile = build_rich_profile(df)
        profile_str = json.dumps(profile, default=str)

        task = Task(
            description=f"""
            You are analyzing this dataset for a business user. 
            
            Dataset Profile (JSON):
            {profile_str}

            Write a comprehensive analysis report covering:
            
            ## 1. Executive Summary
            One paragraph: what is this dataset about, its scale, and overall quality.
            
            ## 2. Data Quality Report
            - Missing values: which columns, severity, and impact
            - Duplicate records: count and risk
            - Outlier summary: flagged columns and severity
            
            ## 3. Statistical Insights
            - Key statistics for numeric columns (highlight interesting values)
            - Distribution patterns (normal, skewed, bimodal?)
            - Top correlations and what they might mean
            
            ## 4. Key Findings
            List the 5 most interesting findings in bullet points.
            
            ## 5. Recommended Next Steps
            Top 3 actions the user should take with this data.
            
            Be specific, reference actual column names and numbers.
            Format beautifully in Markdown.
            """,
            agent=data_profiler,
            expected_output="A structured markdown analysis report."
        )

        crew = Crew(agents=[data_profiler], tasks=[task], verbose=False)
        result = crew.kickoff()

        return jsonify({
            'success': True,
            'analysis': result.tasks_output[0].raw,
            'profile': profile
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/query', methods=['POST'])
def query():
    """
    Natural language query → SQL → Results → Narrative.
    3-agent pipeline: Interpret → SQL → Narrate
    """
    try:
        data = request.json
        dataset_path = resolve_dataset(data.get('dataset_id'))
        user_query = (data.get('query') or '').strip()

        if not user_query:
            return jsonify({'error': 'Query is required'}), 400

        df = pd.read_csv(dataset_path)
        profile = build_rich_profile(df)
        profile_str = json.dumps(profile, default=str)

        conn = sqlite3.connect(':memory:')
        df.to_sql('data_table', conn, index=False, if_exists='replace')

        # Agent 1: Interpret
        interpret_task = Task(
            description=f"""
            User query: "{user_query}"
            
            Dataset profile: {profile_str}
            
            Return ONLY valid JSON:
            {{
                "valid": true/false,
                "interpreted_intent": "What the user wants to find",
                "required_columns": ["col1", "col2"],
                "analysis_type": "aggregation|filter|comparison|ranking|correlation|timeseries",
                "suggestion": "Improved version of the query if ambiguous",
                "confidence": 0.0-1.0
            }}
            """,
            agent=query_interpreter,
            expected_output="JSON with query interpretation"
        )

        # Agent 2: SQL
        sql_task = Task(
            description=f"""
            Based on the interpreted query, write a SQLite SELECT query.
            
            Table: data_table
            Columns: {', '.join(df.columns.tolist())}
            Sample data: {json.dumps(df.head(3).to_dict('records'), default=str)}
            
            Rules:
            - Output ONLY the SQL query, nothing else
            - Use SQLite syntax
            - Read-only (SELECT/WITH only)
            - Handle NULLs gracefully
            - If query is invalid, output: INVALID_QUERY
            - Limit results to 100 rows max
            """,
            agent=sql_craftsman,
            context=[interpret_task],
            expected_output="A valid SQLite SELECT query"
        )

        crew = Crew(
            agents=[query_interpreter, sql_craftsman],
            tasks=[interpret_task, sql_task],
            verbose=False
        )
        result = crew.kickoff()

        interpretation = parse_json_safe(result.tasks_output[0].raw) or {}
        sql_query = sanitize_sql(result.tasks_output[1].raw)

        query_result = None
        result_df = None
        narrative = None

        if interpretation.get('valid', True) and sql_query != 'INVALID_QUERY' and is_safe_query(sql_query):
            try:
                result_df = pd.read_sql_query(sql_query, conn)
                query_result = {
                    'data': result_df.to_dict('records'),
                    'columns': result_df.columns.tolist(),
                    'row_count': len(result_df)
                }

                # Agent 3: Narrate the results
                narrate_task = Task(
                    description=f"""
                    User asked: "{user_query}"
                    
                    Query returned {len(result_df)} rows:
                    {result_df.head(20).to_markdown(index=False) if not result_df.empty else "No results found."}
                    
                    Write a clear, concise narrative (3-5 sentences) explaining:
                    1. What the result shows
                    2. The most important number or finding
                    3. Any surprising or notable pattern
                    4. A brief recommendation or next step
                    
                    Write in plain English, no jargon.
                    """,
                    agent=insight_narrator,
                    expected_output="A natural language narrative of the query results."
                )
                narrate_crew = Crew(agents=[insight_narrator], tasks=[narrate_task], verbose=False)
                narrate_result = narrate_crew.kickoff()
                narrative = narrate_result.tasks_output[0].raw

            except Exception as e:
                query_result = {'error': f'SQL execution failed: {str(e)}'}
        else:
            query_result = {'error': 'Could not generate a valid query for this request.'}

        conn.close()

        # Generate a result visualization if applicable
        result_chart = None
        if result_df is not None and not result_df.empty and len(result_df.columns) >= 2:
            try:
                num_cols = result_df.select_dtypes(include='number').columns.tolist()
                str_cols = result_df.select_dtypes(include='object').columns.tolist()

                if str_cols and num_cols:
                    fig = px.bar(
                        result_df.head(20),
                        x=str_cols[0],
                        y=num_cols[0],
                        template='plotly_dark',
                        title=f'Result: {user_query[:60]}'
                    )
                elif len(num_cols) >= 2:
                    fig = px.scatter(
                        result_df.head(100),
                        x=num_cols[0],
                        y=num_cols[1],
                        template='plotly_dark',
                        title=f'Result: {user_query[:60]}'
                    )
                else:
                    fig = None

                if fig:
                    fig.update_layout(
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(15,15,25,0.8)',
                        font=dict(color='#e2e8f0')
                    )
                    result_chart = fig_to_json(fig)
            except Exception:
                pass

        return jsonify({
            'success': True,
            'interpretation': interpretation,
            'sql_query': sql_query,
            'result': query_result,
            'narrative': narrative,
            'result_chart': result_chart
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/visualize', methods=['POST'])
def visualize():
    """
    Smart visualization pipeline.
    Returns Plotly JSON for interactive charts + AI descriptions.
    """
    try:
        data = request.json
        dataset_path = resolve_dataset(data.get('dataset_id'))
        df = pd.read_csv(dataset_path)

        charts = smart_visualize(df)

        # Get AI descriptions for all charts
        profile = build_rich_profile(df)
        chart_meta = [{'title': c['title'], 'chart_type': c['chart_type']} for c in charts]

        desc_task = Task(
            description=f"""
            Dataset profile: {json.dumps(profile, default=str)}
            
            Charts generated: {json.dumps(chart_meta)}
            
            Return ONLY a JSON array where each item has:
            - title: exact chart title (match exactly)
            - insight: 1-2 sentence business insight from this specific chart (max 40 words)
            - key_finding: the single most important number or pattern revealed
            
            Be specific and reference actual data values.
            """,
            agent=viz_strategist,
            expected_output="JSON array of chart insights"
        )

        crew = Crew(agents=[viz_strategist], tasks=[desc_task], verbose=False)
        result = crew.kickoff()
        parsed = parse_json_safe(result.tasks_output[0].raw)

        if isinstance(parsed, list):
            insight_map = {item.get('title'): item for item in parsed if isinstance(item, dict)}
            for chart in charts:
                if chart['title'] in insight_map:
                    chart['insight'] = insight_map[chart['title']].get('insight', chart['description'])
                    chart['key_finding'] = insight_map[chart['title']].get('key_finding', '')
                else:
                    chart['insight'] = chart['description']
                    chart['key_finding'] = ''

        return jsonify({'success': True, 'charts': charts})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/detective', methods=['POST'])
def detective_mode():
    """
    🔍 DETECTIVE MODE — The crown jewel feature.
    
    Autonomously investigates the dataset for:
    - Statistical anomalies
    - Suspicious correlations
    - Data quality red flags
    - Hidden segments
    - Trend breaks
    
    Returns a structured "case file" with findings ranked by severity.
    """
    try:
        data = request.json
        dataset_path = resolve_dataset(data.get('dataset_id'))
        df = pd.read_csv(dataset_path)
        profile = build_rich_profile(df)

        # Compute additional forensic statistics
        forensics = {}

        # Z-score analysis for extreme outliers
        numeric_cols = df.select_dtypes(include='number').columns.tolist()
        extreme_outliers = {}
        for col in numeric_cols:
            clean = df[col].dropna()
            if len(clean) > 10:
                z_scores = np.abs(stats.zscore(clean))
                extreme = (z_scores > 3).sum()
                if extreme > 0:
                    extreme_outliers[col] = {
                        'count': int(extreme),
                        'percent': round(float(extreme / len(clean) * 100), 2),
                        'max_zscore': round(float(z_scores.max()), 2)
                    }
        forensics['extreme_outliers_zscore'] = extreme_outliers

        # Near-constant columns (low variance)
        low_variance = {}
        for col in numeric_cols:
            cv = df[col].std() / (df[col].mean() + 1e-9)
            if abs(cv) < 0.01 and df[col].nunique() > 1:
                low_variance[col] = round(float(cv), 6)
        forensics['near_constant_columns'] = low_variance

        # High cardinality categoricals
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        high_card = {}
        for col in categorical_cols:
            pct = df[col].nunique() / max(len(df), 1)
            if pct > 0.8:
                high_card[col] = {'unique': int(df[col].nunique()), 'pct_unique': round(pct * 100, 2)}
        forensics['high_cardinality_columns'] = high_card

        # Suspicious missing patterns (MNAR detection heuristic)
        missing_patterns = {}
        for col in df.columns:
            miss_count = int(df[col].isnull().sum())
            if miss_count > 0:
                # Check if missingness correlates with any numeric column
                miss_indicator = df[col].isnull().astype(int)
                correlating_cols = []
                for num_col in numeric_cols[:10]:
                    if num_col != col:
                        try:
                            corr = abs(miss_indicator.corr(df[num_col].fillna(0)))
                            if corr > 0.3:
                                correlating_cols.append({'col': num_col, 'corr': round(float(corr), 3)})
                        except Exception:
                            pass
                if correlating_cols:
                    missing_patterns[col] = correlating_cols
        forensics['structured_missing_patterns'] = missing_patterns

        # Duplicate deep analysis
        dup_cols = df.duplicated(subset=categorical_cols[:3] if categorical_cols else None, keep=False)
        forensics['near_duplicates'] = {
            'count': int(dup_cols.sum()),
            'columns_checked': categorical_cols[:3]
        }

        profile_str = json.dumps(profile, default=str)
        forensics_str = json.dumps(forensics, default=str)

        detective_task = Task(
            description=f"""
            You are a Data Detective investigating this dataset. Your job is to uncover hidden issues, 
            anomalies, and patterns that a non-expert would miss.
            
            Dataset Profile:
            {profile_str}
            
            Forensic Statistics:
            {forensics_str}
            
            Produce a DETECTIVE CASE FILE in this exact markdown structure:
            
            # 🔍 Detective Case File
            
            ## Case Summary
            2-3 sentences describing the overall "health" of this dataset and whether it can be trusted.
            
            ## 🚨 Critical Findings (Severity: HIGH)
            List findings that require immediate attention. Each finding must have:
            - **Finding**: [name]
            - **Evidence**: specific numbers and column names
            - **Risk**: why this matters
            - **Recommendation**: what to do
            
            ## ⚠️ Suspicious Patterns (Severity: MEDIUM)
            Interesting anomalies worth investigating. Same format.
            
            ## 💡 Hidden Insights (Severity: LOW/OPPORTUNITY)
            Patterns that are unusual but potentially valuable. Same format.
            
            ## 🧬 Data DNA
            A brief "fingerprint" of this dataset: what type of data this is, 
            what industry/domain it likely comes from, and what it could be used for.
            
            ## Verdict
            One sentence: is this dataset ready for analysis? What's the #1 thing to fix first?
            
            Be specific. Cite exact numbers. Reference actual column names.
            Write like a forensic expert presenting evidence.
            """,
            agent=detective_agent,
            expected_output="A structured detective case file in markdown"
        )

        crew = Crew(agents=[detective_agent], tasks=[detective_task], verbose=False)
        result = crew.kickoff()

        # Generate forensic visualizations
        forensic_charts = []

        # Z-score distribution for top outlier column
        if extreme_outliers:
            worst_col = max(extreme_outliers, key=lambda x: extreme_outliers[x]['count'])
            clean = df[worst_col].dropna()
            z_scores = stats.zscore(clean)
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=list(range(len(z_scores))),
                y=z_scores,
                mode='markers',
                marker=dict(
                    color=['#f43f5e' if abs(z) > 3 else '#6366f1' for z in z_scores],
                    size=[8 if abs(z) > 3 else 4 for z in z_scores],
                    opacity=0.8
                ),
                name='Z-Score'
            ))
            fig.add_hline(y=3, line_dash='dash', line_color='#f43f5e', annotation_text='Outlier Threshold (+3σ)')
            fig.add_hline(y=-3, line_dash='dash', line_color='#f43f5e', annotation_text='Outlier Threshold (-3σ)')
            fig.update_layout(
                title=f'Outlier Map — {worst_col} (Z-Score Analysis)',
                template='plotly_dark',
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(15,15,25,0.8)',
                font=dict(color='#e2e8f0'),
                xaxis_title='Row Index',
                yaxis_title='Z-Score',
                height=400
            )
            forensic_charts.append({
                'title': f'Outlier Map — {worst_col}',
                'plotly_json': fig_to_json(fig)
            })

        # Missing data pattern heatmap
        if df.isnull().any().any():
            missing_matrix = df.isnull().astype(int)
            sample = missing_matrix.head(100)
            fig = go.Figure(data=go.Heatmap(
                z=sample.values.T,
                x=[str(i) for i in sample.index],
                y=sample.columns.tolist(),
                colorscale=[[0, '#1e1e2e'], [1, '#f43f5e']],
                showscale=False,
                hoverongaps=False
            ))
            fig.update_layout(
                title='Missing Data Pattern (first 100 rows)',
                template='plotly_dark',
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(15,15,25,0.8)',
                font=dict(color='#e2e8f0'),
                xaxis_title='Row Index',
                yaxis_title='Columns',
                height=400
            )
            forensic_charts.append({
                'title': 'Missing Data Pattern',
                'plotly_json': fig_to_json(fig)
            })

        return jsonify({
            'success': True,
            'case_file': result.tasks_output[0].raw,
            'forensics': forensics,
            'forensic_charts': forensic_charts
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/cleanup', methods=['POST'])
def cleanup():
    try:
        dataset_id = (request.json or {}).get('dataset_id')
        if dataset_id:
            try:
                path = resolve_dataset(dataset_id)
                os.unlink(path)
            except Exception:
                pass
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)