const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function gradientDefs() {
  const defs = svgElement('defs');
  const gradient = svgElement('linearGradient', {
    id: 'bar-gradient',
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
  });
  gradient.append(svgElement('stop', { offset: '0%', 'stop-color': '#7c86f7' }));
  gradient.append(svgElement('stop', { offset: '100%', 'stop-color': '#5865f2' }));
  defs.append(gradient);
  return defs;
}

/**
 * Chart cột tự vẽ: không cần thư viện ngoài nên dashboard chạy offline được.
 * series: [{ day: '2026-08-25', joins: 3 }]
 */
export function barChart(series, options = {}) {
  const width = options.width ?? 960;
  const height = options.height ?? 190;
  const padding = { top: 14, right: 6, bottom: 24, left: 34 };

  const svg = svgElement('svg', {
    class: 'chart',
    viewBox: `0 0 ${width} ${height}`,
    height,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': options.label ?? 'Biểu đồ cột',
  });
  svg.append(gradientDefs());

  const total = series.reduce((sum, point) => sum + point.joins, 0);
  const max = Math.max(1, ...series.map((point) => point.joins));
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const step = plotWidth / Math.max(series.length, 1);
  const barWidth = Math.max(3, step * 0.62);
  const today = new Date().toISOString().slice(0, 10);

  for (const ratio of [0, 0.5, 1]) {
    const y = padding.top + plotHeight * (1 - ratio);
    svg.append(
      svgElement('line', {
        class: `grid-line${ratio === 0 ? '' : ' dashed'}`,
        x1: padding.left,
        x2: width - padding.right,
        y1: y,
        y2: y,
      }),
    );
    const label = svgElement('text', { class: 'axis-label', x: padding.left - 8, y: y + 3.5, 'text-anchor': 'end' });
    label.textContent = String(Math.round(max * ratio));
    svg.append(label);
  }

  if (total === 0) {
    const note = svgElement('text', {
      class: 'empty-note',
      x: width / 2,
      y: padding.top + plotHeight / 2,
      'text-anchor': 'middle',
    });
    note.textContent = 'Chưa có join nào trong khoảng thời gian này';
    svg.append(note);
    return svg;
  }

  const labelEvery = Math.max(1, Math.ceil(series.length / 12));

  series.forEach((point, index) => {
    const barHeight = point.joins > 0 ? Math.max((point.joins / max) * plotHeight, 3) : 0;
    const x = padding.left + index * step + (step - barWidth) / 2;
    const y = padding.top + plotHeight - barHeight;

    if (barHeight > 0) {
      const bar = svgElement('rect', {
        class: `bar${point.day === today ? ' today' : ''}`,
        x,
        y,
        width: barWidth,
        height: barHeight,
        rx: Math.min(3, barWidth / 2),
      });
      const title = svgElement('title');
      title.textContent = `${point.day}: ${point.joins} join`;
      bar.append(title);
      svg.append(bar);
    }

    if (index % labelEvery === 0 || index === series.length - 1) {
      const dayLabel = svgElement('text', {
        class: 'axis-label',
        x: x + barWidth / 2,
        y: height - 7,
        'text-anchor': 'middle',
      });
      dayLabel.textContent = point.day.slice(5).replace('-', '/');
      svg.append(dayLabel);
    }
  });

  return svg;
}
