import pandas as pd


def profile_dataframe(df):
    """
    Analyze a Pandas DataFrame and return
    basic information useful for CloudViz.
    """

    # Basic dimensions
    rows, columns = df.shape

    # Column information
    column_info = []

    for column in df.columns:

        series = df[column]

        column_info.append({
            "name": column,
            "data_type": str(series.dtype),
            "missing_values": int(series.isna().sum()),
            "unique_values": int(series.nunique())
        })

    # Numeric columns
    numeric_columns = df.select_dtypes(
        include="number"
    ).columns.tolist()

    # Categorical columns
    categorical_columns = df.select_dtypes(
        include=["object", "category", "bool"]
    ).columns.tolist()

    # Basic statistics
    statistics = {}

    if numeric_columns:

        stats = df[numeric_columns].describe()

        statistics = stats.to_dict()

    return {
        "rows": rows,
        "columns": columns,
        "column_info": column_info,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "total_missing_values": int(df.isna().sum().sum()),
        "statistics": statistics
    }