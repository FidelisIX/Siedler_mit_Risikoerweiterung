'use strict';

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '';
}

const RECORDS = [
  ['bestGame', '🏆 Beste Partie', (r) => [`${r.points} Punkte`, `${r.player} · ${r.map}${r.rounds ? ` · ${r.rounds} Runden` : ''} · ${formatDate(r.date)}`]],
  ['mostWins', '🥇 Meiste Siege', (r) => [`${r.wins} Sieg${r.wins === 1 ? '' : 'e'}`, r.player]],
  ['mostGames', '🎲 Meiste Partien', (r) => [`${r.games} Partie${r.games === 1 ? '' : 'n'}`, r.player]],
  ['mostBuilt', '🏗️ Meiste Gebäude in einer Partie', (r) => [`${r.built} Gebäude`, `${r.player} · ${r.map} · ${formatDate(r.date)}`]],
  ['mostConquests', '⚔️ Meiste Eroberungen in einer Partie', (r) => [`${r.conquered} erobert`, `${r.player} · ${r.map} · ${formatDate(r.date)}`]],
  ['closestWin', '😅 Knappster Sieg', (r) => [`${r.margin} Punkt${r.margin === 1 ? '' : 'e'} Vorsprung`, `${r.player} vor ${r.runnerUp} · ${formatDate(r.date)}`]],
];

function renderRecords(records) {
  const cards = RECORDS.filter(([key]) => records[key]).map(([key, title, format]) => {
    const [value, detail] = format(records[key]);
    const card = el('div', { class: 'record' });
    card.append(el('div', { class: 'muted small-text' }, title), el('b', {}, value), el('div', { class: 'small-text' }, detail));
    return card;
  });
  $('records').replaceChildren(...(cards.length ? cards : [el('p', { class: 'muted' }, 'Noch keine Partien gespeichert.')]));
}

function renderTable(id, rows) {
  $(id).querySelector('tbody').replaceChildren(...rows.map((cells) => {
    const tr = el('tr');
    for (const cell of cells) tr.append(el('td', {}, cell));
    return tr;
  }));
}

async function load() {
  const params = new URLSearchParams();
  if ($('f-variant').value) params.set('variant', $('f-variant').value);
  if ($('f-player').value) params.set('player', $('f-player').value);
  let data;
  try {
    const res = await fetch(`/api/stats?${params}`);
    data = await res.json();
  } catch (err) {
    $('summary').textContent = 'Statistik konnte nicht geladen werden.';
    return;
  }

  const selected = $('f-player').value;
  $('f-player').replaceChildren(el('option', { value: '' }, 'Alle'), ...data.playerNames.map((n) => el('option', { value: n }, n)));
  $('f-player').value = data.playerNames.includes(selected) ? selected : '';

  $('summary').textContent = `${data.games} Partie${data.games === 1 ? '' : 'n'} ausgewertet.`;
  const note = $('storage');
  const { storage } = data;
  const warning = storage.error
    ? `Gespeicherte Partien konnten nicht geladen werden: ${storage.error}`
    : !storage.persistent ? 'Die Statistik wird nicht dauerhaft gespeichert und gilt nur bis zum nächsten Server-Neustart.' : '';
  note.textContent = warning;
  note.classList.toggle('hidden', !warning);

  renderRecords(data.records);
  renderTable('players-table', data.players.map((p) => [
    p.name, p.games, p.wins, `${p.winRate} %`, p.avgPoints, p.bestPoints,
    p.built, p.conquered, p.lost, p.attackRate === null ? '–' : `${p.attackRate} %`, p.trades,
  ]));
  renderTable('maps-table', data.maps.map((m) => [m.name, m.games, m.avgWinPoints]));
}

$('f-variant').onchange = load;
$('f-player').onchange = load;
load();
