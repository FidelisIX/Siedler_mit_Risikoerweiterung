'use strict';

// Gemeinsame Hex-Geometrie und Gelände-Darstellung für Spiel und Karteneditor.
window.Hex = (() => {
  const SIZE = 40;
  const TERRAIN = {
    wald: { color: '#2b8a3e', icon: '🌲', label: 'Wald' },
    steinbruch: { color: '#a8a29e', icon: '🪨', label: 'Steinbruch' },
    acker: { color: '#e9c46a', icon: '🌾', label: 'Acker' },
    mine: { color: '#7c5c45', icon: '⛏️', label: 'Mine' },
    oedland: { color: '#d8cba8', icon: '', label: 'Ödland' },
    wasser: { color: '#2b6a99', icon: '', label: 'Wasser' },
    land: { color: '#8fb46a', icon: '❔', label: 'Land (zufällig)' },
  };

  function center(tile, size = SIZE) {
    return { x: size * Math.sqrt(3) * (tile.q + tile.r / 2), y: size * 1.5 * tile.r };
  }

  function corners(cx, cy, size = SIZE) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      pts.push(`${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function fitViewBox(svgEl, tiles, size = SIZE) {
    if (!tiles.length) return;
    const centers = tiles.map((t) => center(t, size));
    const xs = centers.map((c) => c.x);
    const ys = centers.map((c) => c.y);
    const pad = size * 1.2;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    svgEl.setAttribute('viewBox', `${minX} ${minY} ${Math.max(...xs) - minX + pad} ${Math.max(...ys) - minY + pad}`);
  }

  // Einfache Kartenvorschau ohne Interaktion.
  function drawPreview(svgEl, tiles) {
    fitViewBox(svgEl, tiles);
    svgEl.replaceChildren(...tiles.map((t) => {
      const { x, y } = center(t);
      return svg('polygon', { points: corners(x, y), fill: TERRAIN[t.terrain].color, stroke: '#0b2236', 'stroke-width': 2 });
    }));
  }

  return { SIZE, TERRAIN, center, corners, svg, fitViewBox, drawPreview };
})();
