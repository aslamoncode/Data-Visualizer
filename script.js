let parsedData = [];
let chartInstance = null;

function handleTextInput() {
    const inputText = document.getElementById("dataInput").value.trim();

    if (!inputText) {
        alert("Please enter or upload data.");
        return;
    }

    Papa.parse(inputText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: function (result) {
            if (result.data.length === 0) {
                alert("No valid data found. Please check your input.");
                return;
            }
            parsedData = result.data;
            populateColumnSelectors(Object.keys(parsedData[0]));
            document.getElementById("columnSelection").style.display = "block";
        }
    });
}

function populateColumnSelectors(columns) {
    const xColumnSelect = document.getElementById("xColumn");
    const yColumnSelect = document.getElementById("yColumn");

    xColumnSelect.innerHTML = "";
    yColumnSelect.innerHTML = "";

    columns.forEach(column => {
        const optionX = document.createElement("option");
        optionX.value = column;
        optionX.textContent = column;
        xColumnSelect.appendChild(optionX);

        const optionY = document.createElement("option");
        optionY.value = column;
        optionY.textContent = column;
        yColumnSelect.appendChild(optionY);
    });
}

function generateChart() {
    const xColumn = document.getElementById("xColumn").value;
    const yColumn = document.getElementById("yColumn").value;
    const chartType = document.getElementById("chartType").value;

    if (!xColumn || !yColumn) {
        alert("Please select columns for X and Y axes.");
        return;
    }

    const labels = parsedData.map(row => row[xColumn]);
    const values = parsedData.map(row => row[yColumn]);

    if (values.some(isNaN)) {
        alert("Y-Axis values must be numeric.");
        return;
    }

    if (chartInstance) {
        // 🔥 Instead of destroying, update the existing chart
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = values;
        chartInstance.data.datasets[0].backgroundColor = chartType === "pie" ? generateColors(values.length) : "rgba(54, 162, 235, 0.5)";
        chartInstance.config.type = chartType; // Change chart type dynamically
        chartInstance.update(); // Refresh chart smoothly
    } else {
        // First-time chart creation
        const ctx = document.getElementById("chartCanvas").getContext("2d");
        chartInstance = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: `${yColumn} vs ${xColumn}`,
                    data: values,
                    backgroundColor: chartType === "pie" ? generateColors(values.length) : "rgba(54, 162, 235, 0.5)",
                    borderColor: "rgba(54, 162, 235, 1)",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: chartType !== "pie" ? {
                    x: { beginAtZero: true },
                    y: { beginAtZero: true }
                } : {}
            }
        });
    }

    document.getElementById("chartContainer").style.display = "block";
}

function generateColors(count) {
    return Array.from({ length: count }, () => {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        return `rgba(${r}, ${g}, ${b}, 0.7)`;
    });
}
