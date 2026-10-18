
const csvFile = document.getElementById("csvFile");
const sampleBtn = document.getElementById("sampleBtn");
const fileName = document.getElementById("fileName");
const errorMessage = document.getElementById("errorMessage");
const columnSelect = document.getElementById("columnSelect");
const dataTable = document.getElementById("dataTable");
const summary = document.getElementById("summary");

let headers = [];
let rows = [];
let chart = null;

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length || !lines[0].trim()) {
    throw new Error("The CSV file is empty.");
  }

  function parseLine(line) {
    const result = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        result.push(value.trim());
        value = "";
      } else {
        value += char;
      }
    }

    result.push(value.trim());
    return result;
  }

  const parsed = lines.map(parseLine);
  const columns = parsed[0].map((h, i) => h || `Column ${i + 1}`);

  if (parsed.length < 2) {
    throw new Error("Add at least one row of data to your CSV.");
  }

  const data = parsed.slice(1)
    .filter(row => row.some(cell => cell !== ""))
    .map(row => columns.map((_, i) => row[i] ?? ""));

  if (!data.length) {
    throw new Error("No data rows were found.");
  }

  return { headers: columns, rows: data };
}

function loadDataset(text, name) {
  try {
    const dataset = parseCSV(text);
    headers = dataset.headers;
    rows = dataset.rows;

    errorMessage.textContent = "";
    fileName.textContent = `Loaded: ${name}`;
    updateDashboard();
  } catch (error) {
    errorMessage.textContent = error.message || "Could not read this CSV file.";
  }
}

csvFile.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    errorMessage.textContent = "Please choose a CSV file smaller than 5 MB.";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => loadDataset(reader.result, file.name);
  reader.onerror = () => {
    errorMessage.textContent = "The file could not be read. Please try again.";
  };

  reader.readAsText(file);
});

sampleBtn.addEventListener("click", () => {
  const sample = `Product,Category,Sales,Rating
Notebook,Stationery,120,4.5
Headphones,Electronics,450,4.2
Water Bottle,Accessories,280,4.7
Backpack,Accessories,390,4.4
Pen Set,Stationery,90,4.1
Keyboard,Electronics,520,4.6
Desk Lamp,Home,310,4.3
Planner,Stationery,160,4.8
Mouse,Electronics,230,4.0
Lunch Box,Accessories,190,4.5`;

  loadDataset(sample, "sample-sales.csv");
});

function numericColumns() {
  return headers.filter((header, index) => {
    const values = rows
      .map(row => row[index])
      .filter(value => value !== "");

    return values.length > 0 &&
      values.every(value => Number.isFinite(Number(value)));
  });
}

function updateDashboard() {
  document.getElementById("rowCount").textContent = rows.length;
  document.getElementById("columnCount").textContent = headers.length;

  const numeric = numericColumns();
  document.getElementById("numericCount").textContent = numeric.length;

  const missing = rows.reduce((total, row) =>
    total + row.filter(value => value === "").length, 0);

  document.getElementById("missingCount").textContent = missing;

  renderTable();
  updateColumnOptions(numeric);
}

function renderTable() {
  dataTable.replaceChildren();

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  headers.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  dataTable.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.slice(0, 10).forEach(row => {
    const tr = document.createElement("tr");

    row.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value || "—";
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  dataTable.appendChild(tbody);

  document.getElementById("previewLabel").textContent =
    `Showing ${Math.min(rows.length, 10)} of ${rows.length} rows`;
}

function updateColumnOptions(numeric) {
  columnSelect.replaceChildren();

  if (!numeric.length) {
    columnSelect.add(new Option("No numeric columns", ""));
    columnSelect.disabled = true;
    summary.textContent = "This dataset has no numeric columns to analyze.";
    if (chart) {
      chart.destroy();
      chart = null;
    }
    return;
  }

  columnSelect.disabled = false;

  numeric.forEach(header => {
    columnSelect.add(new Option(header, header));
  });

  renderChart();
}

columnSelect.addEventListener("change", renderChart);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function renderChart() {
  const selected = columnSelect.value;
  if (!selected) return;

  const index = headers.indexOf(selected);
  const values = rows
    .map(row => row[index])
    .filter(value => value !== "")
    .map(Number);

  if (!values.length) return;

  const total = values.reduce((sum, value) => sum + value, 0);
  const average = total / values.length;
  const sorted = [...values].sort((a, b) => a - b);

  summary.textContent =
    `Average: ${average.toFixed(2)}  |  Median: ${median(values).toFixed(2)}  |  Minimum: ${sorted[0]}  |  Maximum: ${sorted[sorted.length - 1]}`;

  const canvas = document.getElementById("dataChart");

  if (chart) chart.destroy();

  chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map((row, i) => row[0] || `Row ${i + 1}`),
      datasets: [{
        label: selected,
        data: rows.map(row =>
          row[index] === "" ? null : Number(row[index])
        ),
        backgroundColor: "rgba(139, 156, 255, 0.75)",
        borderColor: "#8b9cff",
        borderWidth: 1,
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#edf2ff" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#95a3bd" },
          grid: { color: "#26334c" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#95a3bd" },
          grid: { color: "#26334c" }
        }
      }
    }
  });
}
