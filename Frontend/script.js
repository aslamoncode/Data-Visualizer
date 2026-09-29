const API_BASE_URL = "https://cloudvizz-backend.onrender.com";

let parsedData = [];
let chartInstance = null;
let currentRecommendations = [];
let recommendationsLimit = 5;

/* ==========================================
   CHART THEME (follows localStorage "cloudviz-theme")
   Colors mirror the light / dark tokens in styles.css:
   text-hi, text-mid, panel-border and bg-base-2.
========================================== */

const THEME_STORAGE_KEY = "cloudviz-theme";

const CHART_THEMES = {
    light: {
        textHi: "#1F2937",      // --text-hi
        textMid: "#64748B",     // --text-mid
        grid: "#E2E8F0",        // --panel-border
        surface: "#FFFFFF"      // --bg-base-2
    },
    dark: {
        textHi: "#FAF7F2",      // --text-hi
        textMid: "#A8A29E",     // --text-mid
        grid: "#44403C",        // --panel-border
        surface: "#292524"      // --bg-base-2
    }
};

let appliedTheme = null;

function normalizeTheme(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const theme = String(value)
        .replace(/^"+|"+$/g, "")
        .trim()
        .toLowerCase();

    return theme === "light" || theme === "dark" ? theme : null;
}

function getSavedTheme() {
    try {
        return normalizeTheme(
            localStorage.getItem(THEME_STORAGE_KEY)
        );
    } catch (error) {
        return null;
    }
}

function getActiveTheme() {
    return (
        getSavedTheme() ||
        normalizeTheme(
            document.documentElement.getAttribute("data-theme")
        ) ||
        (window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark")
    );
}

function getChartTheme() {
    return CHART_THEMES[getActiveTheme()];
}

// Keep <html data-theme> in step with the saved theme so the
// page styles and the charts always agree.
function syncThemeAttribute() {
    const saved = getSavedTheme();
    const root = document.documentElement;

    if (saved && root.getAttribute("data-theme") !== saved) {
        root.setAttribute("data-theme", saved);
    }
}

function setNested(root, path, value) {
    let node = root;

    for (let i = 0; i < path.length - 1; i++) {
        if (
            node[path[i]] === null ||
            node[path[i]] === undefined ||
            typeof node[path[i]] !== "object"
        ) {
            node[path[i]] = {};
        }

        node = node[path[i]];
    }

    node[path[path.length - 1]] = value;
}

// Global Chart.js defaults so any chart created later inherits the theme.
function applyChartDefaults() {
    if (typeof Chart === "undefined" || !Chart.defaults) {
        return;
    }

    const theme = getChartTheme();

    Chart.defaults.color = theme.textMid;
    Chart.defaults.borderColor = theme.grid;

    const plugins = Chart.defaults.plugins;

    if (plugins) {
        if (plugins.legend && plugins.legend.labels) {
            plugins.legend.labels.color = theme.textHi;
        }

        if (plugins.title) {
            plugins.title.color = theme.textHi;
        }

        if (plugins.tooltip) {
            plugins.tooltip.backgroundColor = theme.surface;
            plugins.tooltip.titleColor = theme.textHi;
            plugins.tooltip.bodyColor = theme.textMid;
            plugins.tooltip.footerColor = theme.textMid;
            plugins.tooltip.borderColor = theme.grid;
            plugins.tooltip.borderWidth = 1;
        }
    }
}

// Themes text, legend, axes, gridlines and tooltips on an options object.
// Works on a config's raw options and on a live chart.options.
function applyThemeToOptions(options, scaleIds) {
    const theme = getChartTheme();

    setNested(options, ["plugins", "legend", "labels", "color"], theme.textHi);
    setNested(options, ["plugins", "title", "color"], theme.textHi);

    setNested(options, ["plugins", "tooltip", "backgroundColor"], theme.surface);
    setNested(options, ["plugins", "tooltip", "titleColor"], theme.textHi);
    setNested(options, ["plugins", "tooltip", "bodyColor"], theme.textMid);
    setNested(options, ["plugins", "tooltip", "footerColor"], theme.textMid);
    setNested(options, ["plugins", "tooltip", "borderColor"], theme.grid);
    setNested(options, ["plugins", "tooltip", "borderWidth"], 1);

    (scaleIds || []).forEach((id) => {
        const scale = ["scales", id];

        setNested(options, [...scale, "ticks", "color"], theme.textMid);
        setNested(options, [...scale, "grid", "color"], theme.grid);
        setNested(options, [...scale, "title", "color"], theme.textHi);

        if (id === "r") {
            // Radar chart: spokes, axis labels and tick backdrop.
            setNested(options, [...scale, "angleLines", "color"], theme.grid);
            setNested(options, [...scale, "pointLabels", "color"], theme.textMid);
            setNested(options, [...scale, "ticks", "backdropColor"], "transparent");
        } else {
            // Axis line (Chart.js v3 and v4 option names).
            setNested(options, [...scale, "grid", "borderColor"], theme.grid);
            setNested(options, [...scale, "border", "color"], theme.grid);
        }
    });
}

// Pie / doughnut slices get a theme-colored separator instead of white.
function applyThemeToDatasets(type, data) {
    if (
        (type === "pie" || type === "doughnut") &&
        data &&
        Array.isArray(data.datasets)
    ) {
        const theme = getChartTheme();

        data.datasets.forEach((dataset) => {
            dataset.borderColor = theme.surface;
        });
    }
}

// Every chart in this file is created through here.
function createThemedChart(ctx, config) {
    applyChartDefaults();

    config.options = config.options || {};

    applyThemeToOptions(
        config.options,
        Object.keys(config.options.scales || {})
    );

    applyThemeToDatasets(config.type, config.data);

    appliedTheme = getActiveTheme();

    return new Chart(ctx, config);
}

// Re-theme an existing chart in place (data and colors are untouched).
function applyThemeToChart(chart) {
    if (!chart || !chart.options) {
        return;
    }

    applyThemeToOptions(
        chart.options,
        Object.keys(chart.scales || {})
    );

    applyThemeToDatasets(
        chart.config && chart.config.type,
        chart.data
    );

    chart.update("none");
}

function getAllCharts() {
    if (typeof Chart !== "undefined" && Chart.instances) {
        return Object.values(Chart.instances);
    }

    return chartInstance ? [chartInstance] : [];
}

function syncChartTheme(force) {
    syncThemeAttribute();

    const theme = getActiveTheme();

    if (!force && theme === appliedTheme) {
        return;
    }

    appliedTheme = theme;

    applyChartDefaults();
    getAllCharts().forEach(applyThemeToChart);
}

function initChartThemeSync() {
    syncChartTheme(true);

    // Theme saved from another tab / page.
    window.addEventListener("storage", (event) => {
        if (
            event.key === null ||
            event.key === THEME_STORAGE_KEY
        ) {
            syncChartTheme();
        }
    });

    // Theme attribute changed on this page.
    new MutationObserver(() => syncChartTheme()).observe(
        document.documentElement,
        { attributes: true, attributeFilter: ["data-theme"] }
    );

    // Returning to the page (back/forward cache, tab switch).
    window.addEventListener("pageshow", () => syncChartTheme());

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            syncChartTheme();
        }
    });
}

/* ==========================================
   FETCH MONGODB DATASET
========================================== */

async function fetchData(datasetName) {
    if (!datasetName) {
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/get_data?dataset=${encodeURIComponent(datasetName)}`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Failed to load dataset."
            );
        }

        handleData(result.data);

        // Fetch recommendations for this MongoDB dataset.
        await fetchRecommendations(datasetName);

    } catch (error) {
        console.error("Dataset error:", error);
        alert("Failed to fetch dataset.");
    }
}

/* ==========================================
   CSV FILE UPLOAD
========================================== */

function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
        alert("Please upload a CSV file.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
        const csvText = event.target.result;

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,

            complete: async function (result) {
                if (
                    !result.data ||
                    result.data.length === 0
                ) {
                    alert("No valid data found in the CSV.");
                    return;
                }

                handleData(result.data);

                // Generate recommendations for the uploaded CSV.
                await fetchUploadedRecommendations(result.data);
            },

            error: function (error) {
                console.error("CSV parsing error:", error);
                alert("Unable to read the CSV file.");
            }
        });
    };

    reader.readAsText(file);
}
function updateDataProfile(data) {
    const rows = data.length;
    const columns = Object.keys(data[0] || {});

    const numericColumns = columns.filter((column) =>
        data.some(
            (row) =>
                row[column] !== null &&
                row[column] !== "" &&
                Number.isFinite(Number(row[column]))
        )
    );

    const categoricalColumns = columns.filter(
        (column) => !numericColumns.includes(column)
    );

    let totalMissing = 0;

    const tableBody = document.getElementById("profileTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    columns.forEach((column) => {
        const values = data.map((row) => row[column]);

        const missing = values.filter(
            (value) =>
                value === null ||
                value === undefined ||
                (typeof value === "string" && value.trim() === "")
        ).length;

        totalMissing += missing;

        const uniqueValues = new Set(
            values
                .filter(
                    (value) =>
                        value !== null &&
                        value !== undefined &&
                        value !== ""
                )
                .map((value) => String(value))
        ).size;

        const dataType = numericColumns.includes(column)
            ? "Numeric"
            : "Categorical";

        const row = document.createElement("tr");

        [column, dataType, missing, uniqueValues].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });

    document.getElementById("profileRows").textContent =
        rows.toLocaleString();

    document.getElementById("profileColumns").textContent =
        columns.length.toLocaleString();

    document.getElementById("profileMissing").textContent =
        totalMissing.toLocaleString();

    document.getElementById("profileNumeric").textContent =
        numericColumns.length.toLocaleString();

    document.getElementById("profileCategorical").textContent =
        categoricalColumns.length.toLocaleString();
}
/* ==========================================
   HANDLE DATA
========================================== */

function handleData(data) {
    if (!Array.isArray(data) || data.length === 0) {
        alert("No data available.");
        return;
    }

    parsedData = data;

    const columns = Object.keys(parsedData[0]);

    populateAxisSelectors(columns);
    updateMarquee(columns);

    // Update the Data Profile dashboard.
    updateDataProfile(parsedData);
    updateNumericStatistics(parsedData);
    // Reset the existing chart.
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}
/* ==========================================
   AXIS SELECTORS
========================================== */

function populateAxisSelectors(columns) {
    const xSelect = document.getElementById("xAxisSelect");
    const ySelect = document.getElementById("yAxisSelect");

    if (!xSelect || !ySelect) {
        return;
    }

    xSelect.innerHTML = "";
    ySelect.innerHTML = "";

    columns.forEach((column) => {
        const xOption = document.createElement("option");
        xOption.value = column;
        xOption.textContent = column;
        xSelect.appendChild(xOption);

        const yOption = document.createElement("option");
        yOption.value = column;
        yOption.textContent = column;
        ySelect.appendChild(yOption);
    });

    if (columns.length > 1) {
        ySelect.selectedIndex = 1;
    }
}

/* ==========================================
   GRAPH GENERATION
========================================== */

function updateGraph() {
    if (!parsedData.length) {
        alert("Please select a dataset or upload a CSV first.");
        return;
    }

    const xColumn =
        document.getElementById("xAxisSelect").value;

    const yColumn =
        document.getElementById("yAxisSelect").value;

    const chartType =
        document.getElementById("graphTypeSelect").value;

    if (!xColumn || !yColumn) {
        alert("Please select both X and Y axes.");
        return;
    }

    generateGraph(xColumn, yColumn, chartType);
}

/* ==========================================
   CREATE GRAPH
========================================== */

function generateGraph(xColumn, yColumn, chartType) {
    if (!parsedData.length) {
        return;
    }

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    const canvas = document.getElementById("myChart");

    if (!canvas) {
        console.error("Chart canvas not found.");
        return;
    }

    const ctx = canvas.getContext("2d");

    const labels = parsedData.map(row => row[xColumn]);
    const values = parsedData.map(row => row[yColumn]);

    if (chartType === "scatterTrendline") {
        createScatterPlotWithTrendline(xColumn, yColumn);
        return;
    }

    if (chartType === "radar") {
        createRadarChart(xColumn, yColumn);
        return;
    }

    const colors = generateColors(
        Math.max(values.length, 1)
    );

    let chartData;

    const options = {
        responsive: true,
        maintainAspectRatio: false
    };

    if (
        chartType === "pie" ||
        chartType === "doughnut"
    ) {
        chartData = {
            labels: labels,
            datasets: [
                {
                    label: `${yColumn} by ${xColumn}`,
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 1
                }
            ]
        };
    } else {
        chartData = {
            labels: labels,
            datasets: [
                {
                    label: `${yColumn} by ${xColumn}`,
                    data: values,
                    backgroundColor:
                        "rgba(54, 162, 235, 0.5)",
                    borderColor:
                        "rgba(54, 162, 235, 1)",
                    borderWidth: 1
                }
            ]
        };

        options.scales = {
            x: {
                beginAtZero: true
            },
            y: {
                beginAtZero: true
            }
        };
    }

    chartInstance = createThemedChart(ctx, {
        type: chartType,
        data: chartData,
        options: options
    });
}

/* ==========================================
   RADAR CHART
========================================== */

function createRadarChart(xColumn, yColumn) {
    const canvas = document.getElementById("myChart");

    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d");

    const labels = parsedData.map(row => row[xColumn]);

    const values = parsedData.map(
        row => Number(row[yColumn])
    );

    chartInstance = createThemedChart(ctx, {
        type: "radar",

        data: {
            labels: labels,

            datasets: [
                {
                    label: `${yColumn} by ${xColumn}`,
                    data: values,
                    backgroundColor:
                        "rgba(54, 162, 235, 0.2)",
                    borderColor:
                        "rgba(54, 162, 235, 1)",
                    borderWidth: 2
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                r: {
                    beginAtZero: true
                }
            }
        }
    });
}

/* ==========================================
   SCATTER PLOT + TRENDLINE
========================================== */

function createScatterPlotWithTrendline(
    xColumn,
    yColumn
) {
    const canvas = document.getElementById("myChart");

    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d");

    const points = parsedData
        .map(row => ({
            x: Number(row[xColumn]),
            y: Number(row[yColumn])
        }))
        .filter(point =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y)
        );

    if (points.length < 2) {
        alert(
            "Scatter plot requires at least two valid numeric points."
        );
        return;
    }

    const regression = calculateLinearRegression(points);

    const minX = Math.min(
        ...points.map(point => point.x)
    );

    const maxX = Math.max(
        ...points.map(point => point.x)
    );

    const trendline = [
        {
            x: minX,
            y: regression.slope * minX +
                regression.intercept
        },
        {
            x: maxX,
            y: regression.slope * maxX +
                regression.intercept
        }
    ];

    chartInstance = createThemedChart(ctx, {
        type: "scatter",

        data: {
            datasets: [
                {
                    label: `${yColumn} vs ${xColumn}`,
                    data: points,
                    backgroundColor:
                        "rgba(54, 162, 235, 0.7)"
                },

                {
                    type: "line",
                    label: "Trendline",
                    data: trendline,
                    borderColor:
                        "rgba(255, 99, 132, 1)",
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                x: {
                    type: "linear"
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

/* ==========================================
   LINEAR REGRESSION
========================================== */

function calculateLinearRegression(points) {
    const n = points.length;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    points.forEach(point => {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    });

    const denominator =
        (n * sumXX) - (sumX * sumX);

    if (denominator === 0) {
        return {
            slope: 0,
            intercept: sumY / n
        };
    }

    const slope =
        ((n * sumXY) - (sumX * sumY)) /
        denominator;

    const intercept =
        (sumY - slope * sumX) / n;

    return {
        slope,
        intercept
    };
}

/* ==========================================
   MONGODB RECOMMENDATIONS
========================================== */

async function fetchRecommendations(datasetName) {
    const list = document.getElementById(
        "recommendationsList"
    );

    if (!list || !datasetName) {
        return;
    }

    list.innerHTML = `
        <p class="recommendations-empty">
            Analyzing your dataset...
        </p>
    `;

    try {
        const response = await fetch(
            `${API_BASE_URL}/datasets/${encodeURIComponent(datasetName)}/recommendations`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Failed to get recommendations."
            );
        }

        // Backend response:
        // result.recommendations.recommendations
        const recommendations =
            Array.isArray(result.recommendations)
                ? result.recommendations
                : result.recommendations?.recommendations || [];

        currentRecommendations = recommendations;

        displayRecommendations(currentRecommendations);

    } catch (error) {
        console.error(
            "Recommendation error:",
            error
        );

        list.innerHTML = `
            <p class="recommendations-empty">
                Could not load recommendations.
            </p>
        `;
    }
}

/* ==========================================
   UPLOADED CSV RECOMMENDATIONS
========================================== */

async function fetchUploadedRecommendations(data) {
    const list = document.getElementById(
        "recommendationsList"
    );

    if (!list) {
        return;
    }

    list.innerHTML = `
        <p class="recommendations-empty">
            Analyzing your uploaded data...
        </p>
    `;

    try {
        const response = await fetch(
            `${API_BASE_URL}/recommendations`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    data: data
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Recommendation failed."
            );
        }

        // Support either an array or a nested response.
        const recommendations =
            Array.isArray(result.recommendations)
                ? result.recommendations
                : result.recommendations?.recommendations || [];

        currentRecommendations = recommendations;

        displayRecommendations(currentRecommendations);

    } catch (error) {
        console.error(
            "Uploaded data recommendation error:",
            error
        );

        list.innerHTML = `
            <p class="recommendations-empty">
                Could not generate recommendations.
            </p>
        `;
    }
}

/* ==========================================
   DISPLAY RECOMMENDATIONS
========================================== */

function displayRecommendations(recommendations) {
    const list = document.getElementById(
        "recommendationsList"
    );

    if (!list) {
        return;
    }

    if (
        !Array.isArray(recommendations) ||
        recommendations.length === 0
    ) {
        list.innerHTML = `
            <p class="recommendations-empty">
                No recommendations available.
            </p>
        `;
        return;
    }

    const visibleRecommendations = recommendations.slice(
        0,
        recommendationsLimit
    );

    list.innerHTML = `
        <div class="recommendations-grid">
            ${visibleRecommendations.map((item, index) => `
                <div class="recommendation">
                    <strong>
                        #${item.rank || index + 1}
                        ${String(
                            item.chart_type || "chart"
                        ).toUpperCase()}
                    </strong>

                    <span>
                        Score: ${item.score ?? "-"}
                    </span>

                    <p>
                        X: ${item.x || "None"}
                        |
                        Y: ${item.y || "None"}
                    </p>

                    <small>
                        ${item.reason || ""}
                    </small>

                    <button
                        type="button"
                        onclick="useRecommendation(${recommendations.indexOf(item)})"
                    >
                        Create Chart
                    </button>
                </div>
            `).join("")}
        </div>

        ${recommendations.length > 5 ? `
            <button
                type="button"
                class="recommendations-toggle"
                onclick="toggleRecommendations()"
            >
                ${recommendationsLimit === 5
                    ? "Show Top 10"
                    : "Show Top 5"}
            </button>
        ` : ""}
    `;
}
function toggleRecommendations() {
    recommendationsLimit =
        recommendationsLimit === 5 ? 10 : 5;

    displayRecommendations(currentRecommendations);
}

/* ==========================================
   USE RECOMMENDATION
========================================== */

function useRecommendation(index) {
    const recommendation =
        currentRecommendations[index];

    if (!recommendation) {
        return;
    }

    const xSelect =
        document.getElementById("xAxisSelect");

    const ySelect =
        document.getElementById("yAxisSelect");

    const typeSelect =
        document.getElementById("graphTypeSelect");

    if (xSelect && recommendation.x) {
        xSelect.value = recommendation.x;
    }

    if (ySelect && recommendation.y) {
        ySelect.value = recommendation.y;
    }

    if (typeSelect) {
        const type = String(
            recommendation.chart_type || ""
        ).toLowerCase();

        if (type === "scatter") {
            typeSelect.value = "scatterTrendline";
        } else if (type === "histogram") {
            // Chart.js does not have a built-in histogram type.
            typeSelect.value = "bar";
        } else if (
            [
                "bar",
                "line",
                "pie",
                "doughnut",
                "radar"
            ].includes(type)
        ) {
            typeSelect.value = type;
        }
    }

    updateGraph();

    const chartCard =
        document.getElementById("chartCard");

    if (chartCard) {
        chartCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

/* ==========================================
   MARQUEE
========================================== */

function updateMarquee(columns) {
    const track =
        document.getElementById("marqueeTrack");

    if (!track) {
        return;
    }

    track.innerHTML = "";

    const items = [
        "BAR",
        "LINE",
        "PIE",
        "DOUGHNUT",
        "RADAR",
        "SCATTER"
    ];

    items.forEach(type => {
        const item = document.createElement("span");

        item.textContent = type;

        track.appendChild(item);
    });
}

/* ==========================================
   CLEAR RECOMMENDATIONS
========================================== */

function clearRecommendations() {
    const list = document.getElementById(
        "recommendationsList"
    );

    currentRecommendations = [];

    if (!list) {
        return;
    }

    list.innerHTML = `
        <p class="recommendations-empty">
            Select a MongoDB dataset or upload a CSV
            to get CloudViz recommendations.
        </p>
    `;
}

/* ==========================================
   COLOR GENERATION
========================================== */

function generateColors(count) {
    return Array.from(
        { length: count },
        () => {
            const r = Math.floor(Math.random() * 255);
            const g = Math.floor(Math.random() * 255);
            const b = Math.floor(Math.random() * 255);

            return `rgba(${r}, ${g}, ${b}, 0.7)`;
        }
    );
}

window.fetchData = fetchData;
function toggleDataProfile() {
    const profileCard = document.getElementById("profilingCard");
    const toggleButton = document.getElementById("profileToggleBtn");

    if (!profileCard || !toggleButton) {
        return;
    }

    const isHidden = profileCard.hidden;

    profileCard.hidden = !isHidden;

    toggleButton.textContent = isHidden
        ? "Hide Data Profile"
        : "View Data Profile";
}
function updateNumericStatistics(data) {
    const tableBody = document.getElementById("numericStatsBody");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7">No data available.</td>
            </tr>
        `;
        return;
    }

    const columns = Object.keys(data[0]);

    const numericColumns = columns.filter((column) => {
        const values = data
            .map((row) => row[column])
            .filter((value) =>
                value !== null &&
                value !== undefined &&
                String(value).trim() !== ""
            )
            .map(Number);

        return values.length > 0 &&
            values.every(Number.isFinite);
    });

    if (numericColumns.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7">No numeric columns found.</td>
            </tr>
        `;
        return;
    }

    const formatNumber = (value) =>
        Number(value).toLocaleString(undefined, {
            maximumFractionDigits: 3
        });

    numericColumns.forEach((column) => {
        const values = data
            .map((row) => row[column])
            .filter((value) =>
                value !== null &&
                value !== undefined &&
                String(value).trim() !== ""
            )
            .map(Number)
            .filter(Number.isFinite)
            .sort((a, b) => a - b);

        const count = values.length;

        if (count === 0) return;

        const mean =
            values.reduce((sum, value) => sum + value, 0) / count;

        const middle = Math.floor(count / 2);

        const median = count % 2 === 0
            ? (values[middle - 1] + values[middle]) / 2
            : values[middle];

        const min = values[0];
        const max = values[count - 1];

        // Population standard deviation
        const variance =
            values.reduce(
                (sum, value) => sum + (value - mean) ** 2,
                0
            ) / count;

        const stdDev = Math.sqrt(variance);

        const row = document.createElement("tr");

        [
            column,
            count,
            formatNumber(mean),
            formatNumber(median),
            formatNumber(min),
            formatNumber(max),
            formatNumber(stdDev)
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });
}

/* ==========================================
   INIT CHART THEME
========================================== */

initChartThemeSync();