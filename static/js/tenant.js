/**
 * Rezsi Figyelo - Tenant Frontend JS
 * Sparkline charts, Chart.js integrations
 */

// Draw sparklines on dashboard
async function drawSparklines() {
    const types = ['villany', 'viz'];

    for (const type of types) {
        const canvas = document.getElementById(`sparkline-${type}`);
        if (!canvas) continue;

        try {
            const resp = await fetch(`/api/chart-data?type=${type}&limit=12`);
            const data = await resp.json();

            if (data.consumption && data.consumption.length > 1) {
                drawSparkline(canvas, data.consumption);
            }
        } catch (e) {
            console.log(`Sparkline error for ${type}:`, e);
        }
    }
}

function drawSparkline(canvas, values) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padding = 2;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;

    values.forEach((val, i) => {
        const x = padding + (i / (values.length - 1)) * (w - 2 * padding);
        const y = h - padding - ((val - min) / range) * (h - 2 * padding);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();
}

// Initialize sparklines when page loads
document.addEventListener('DOMContentLoaded', drawSparklines);
