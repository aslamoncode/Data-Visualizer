# ==========================================
# CloudViz Chart Recommendation Engine
# ==========================================


def recommend_charts(profile):
    """
    Generate and rank visualization recommendations
    from a CloudViz dataset profile.
    """

    numeric_columns = profile.get("numeric_columns", [])
    categorical_columns = profile.get(
        "categorical_columns", []
    )
    column_info = profile.get("column_info", [])

    recommendations = []

    # ------------------------------------------
    # Helper function
    # ------------------------------------------

    def add_recommendation(
        chart_type,
        x,
        y,
        score,
        reason
    ):
        recommendations.append({
            "chart_type": chart_type,
            "x": x,
            "y": y,
            "score": score,
            "reason": reason
        })

    # ------------------------------------------
    # 1. Categorical + Numeric → Bar Chart
    # ------------------------------------------

    for category in categorical_columns:

        for numeric in numeric_columns:

            score = 90

            add_recommendation(
                chart_type="bar",
                x=category,
                y=numeric,
                score=score,
                reason=(
                    f"Compare {numeric} across "
                    f"different {category} values."
                )
            )

    # ------------------------------------------
    # 2. Numeric + Numeric → Scatter Plot
    # ------------------------------------------

    for i in range(len(numeric_columns)):

        for j in range(i + 1, len(numeric_columns)):

            x_column = numeric_columns[i]
            y_column = numeric_columns[j]

            score = 85

            add_recommendation(
                chart_type="scatter",
                x=x_column,
                y=y_column,
                score=score,
                reason=(
                    f"Explore the relationship between "
                    f"{x_column} and {y_column}."
                )
            )

    # ------------------------------------------
    # 3. Numeric → Histogram
    # ------------------------------------------

    for numeric in numeric_columns:

        score = 75

        add_recommendation(
            chart_type="histogram",
            x=numeric,
            y=None,
            score=score,
            reason=(
                f"Understand the distribution of "
                f"{numeric}."
            )
        )

    # ------------------------------------------
    # 4. Categorical → Frequency Bar Chart
    # ------------------------------------------

    for category in categorical_columns:

        score = 65

        add_recommendation(
            chart_type="bar",
            x=category,
            y=None,
            score=score,
            reason=(
                f"Explore the frequency of "
                f"{category} values."
            )
        )

    # ------------------------------------------
    # 5. Detect possible time columns
    # ------------------------------------------

    time_columns = []

    for column in column_info:

        name = column.get("name", "").lower()

        if any(keyword in name for keyword in [
            "year",
            "date",
            "time",
            "month",
            "day"
        ]):

            time_columns.append(
                column.get("name")
            )

    # ------------------------------------------
    # 6. Time + Numeric → Line Chart
    # ------------------------------------------

    for time_column in time_columns:

        for numeric in numeric_columns:

            if time_column == numeric:
                continue

            score = 95

            add_recommendation(
                chart_type="line",
                x=time_column,
                y=numeric,
                score=score,
                reason=(
                    f"Analyze how {numeric} changes "
                    f"over {time_column}."
                )
            )

    # ------------------------------------------
    # 7. Sort recommendations by score
    # ------------------------------------------

    recommendations.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    # ------------------------------------------
    # 8. Assign ranking
    # ------------------------------------------

    for index, recommendation in enumerate(
        recommendations,
        start=1
    ):

        recommendation["rank"] = index

    # ------------------------------------------
    # Return ranked recommendations
    # ------------------------------------------

    return {
        "recommendations": recommendations,
        "count": len(recommendations)
    }