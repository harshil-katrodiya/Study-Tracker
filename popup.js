const browser = window.browser || window.chrome;

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    document.getElementById('reportPeriod').addEventListener('change', loadStats);
});

function loadStats() {
    const stats = {
        'khanacademy.org': 45,
        'coursera.org': 30
    };
    displayStats(stats);
    updateChart(stats);
}

function displayStats(stats) {
    const studyStatsDiv = document.getElementById('studyStats');
    studyStatsDiv.innerHTML = Object.entries(stats)
        .map(([site, minutes]) => `<p>${site}: ${minutes} min</p>`)
        .join('');
}

function updateChart(stats) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    const labels = Object.keys(stats);
    const data = Object.values(stats);

    if (window.myChart) {
        window.myChart.destroy();
    }

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Minutes Studied',
                data: data,
                backgroundColor: '#4CAF50'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
