'use strict';

/**
 * Dauerhafte Ablage der Spielergebnisse.
 *
 * - GitHubStore: schreibt über die GitHub-API in einen eigenen Branch (Standard
 *   `statistik`), eine JSON-Zeile pro Partie, eine Datei pro Monat
 *   (spiele/2026-09.jsonl). Der Branch darf NICHT der Deploy-Branch sein, sonst
 *   löst jede Partie einen Neustart aus.
 * - FileStore: lokale Datei (Entwicklung, Tests).
 * - MemoryStore: nichts wird gespeichert (kein Token konfiguriert).
 *
 * Alle Stores haben dieselbe Schnittstelle: load() → Partien, append(partie).
 *
 * Außerdem sichern sie aktive Räume über einen Neustart hinweg:
 * saveRoom(code, sicherung), loadRoom(code) → sicherung | null, deleteRoom(code).
 * Auf GitHub liegen diese unter raeume/<CODE>.json im selben Datenbranch.
 */

const fs = require('fs');
const path = require('path');

function parseLines(text) {
  const games = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      games.push(JSON.parse(line));
    } catch {
      console.error('Statistik: ungültige Zeile übersprungen');
    }
  }
  return games;
}

function monthFile(game) {
  return `spiele/${game.endedAt.slice(0, 7)}.jsonl`;
}

const roomFile = (code) => `raeume/${String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')}.json`;

class MemoryStore {
  constructor() {
    this.description = 'nur im Arbeitsspeicher (STATS_GITHUB_TOKEN nicht gesetzt)';
    this.persistent = false;
    this.rooms = new Map();
  }
  async load() {
    return [];
  }
  async append() {}
  async saveRoom(code, snap) {
    this.rooms.set(roomFile(code), JSON.parse(JSON.stringify(snap)));
  }
  async loadRoom(code) {
    return this.rooms.get(roomFile(code)) || null;
  }
  async deleteRoom(code) {
    this.rooms.delete(roomFile(code));
  }
  async listRooms() {
    return [...this.rooms.values()].map((s) => s.code);
  }
}

class FileStore {
  constructor(file) {
    this.file = file;
    this.description = `Datei ${file}`;
    this.persistent = true;
  }
  async load() {
    if (!fs.existsSync(this.file)) return [];
    return parseLines(fs.readFileSync(this.file, 'utf8'));
  }
  async append(game) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, JSON.stringify(game) + '\n');
  }
  roomPath(code) {
    return path.join(path.dirname(this.file), roomFile(code));
  }
  async saveRoom(code, snap) {
    fs.mkdirSync(path.dirname(this.roomPath(code)), { recursive: true });
    fs.writeFileSync(this.roomPath(code), JSON.stringify(snap));
  }
  async loadRoom(code) {
    const file = this.roomPath(code);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  }
  async deleteRoom(code) {
    fs.rmSync(this.roomPath(code), { force: true });
  }
  async listRooms() {
    const dir = path.join(path.dirname(this.file), 'raeume');
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];
  }
}

class GitHubStore {
  /**
   * @param {object} opts
   * @param {string} opts.token   fine-grained Token mit "Contents: Read and write" für das Repo
   * @param {string} opts.repo    "owner/name"
   * @param {string} opts.branch  Datenbranch (nicht der Deploy-Branch!)
   * @param {string} [opts.apiUrl]
   */
  constructor({ token, repo, branch, apiUrl = 'https://api.github.com', fetchImpl = fetch }) {
    this.token = token;
    this.repo = repo;
    this.branch = branch;
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
    this.files = new Map(); // Pfad → { text, sha }
    this.roomShas = new Map(); // Raumdatei → sha der zuletzt bekannten Sicherung (spart einen GET pro Sicherung)
    this.queue = Promise.resolve();
    this.description = `GitHub ${repo}, Branch ${branch}`;
    this.persistent = true;
  }

  async request(method, apiPath, { body, raw = false } = {}) {
    const res = await this.fetch(`${this.apiUrl}/repos/${this.repo}/${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'archipel-server',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  }

  contentsPath(p) {
    return `contents/${p.split('/').map(encodeURIComponent).join('/')}`;
  }

  async listDir() {
    const res = await this.request('GET', `${this.contentsPath('spiele')}?ref=${encodeURIComponent(this.branch)}`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub: Verzeichnis nicht lesbar (${res.status})`);
    return (await res.json()).filter((e) => e.type === 'file' && e.name.endsWith('.jsonl'));
  }

  async fetchFile(entry) {
    const res = await this.request('GET', `${this.contentsPath(entry.path)}?ref=${encodeURIComponent(this.branch)}`, {
      raw: true,
    });
    if (!res.ok) throw new Error(`GitHub: ${entry.path} nicht lesbar (${res.status})`);
    const text = await res.text();
    this.files.set(entry.path, { text, sha: entry.sha });
    return text;
  }

  async load() {
    const entries = await this.listDir();
    const games = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      games.push(...parseLines(await this.fetchFile(entry)));
    }
    return games;
  }

  /** Schreibvorgänge nacheinander ausführen, damit sich Commits nicht überholen. */
  append(game) {
    const run = this.queue.then(() => this.write(game));
    this.queue = run.catch(() => {});
    return run;
  }

  async write(game, attempt = 1) {
    const file = monthFile(game);
    const current = this.files.get(file) || { text: '', sha: undefined };
    const text = current.text + JSON.stringify(game) + '\n';
    const res = await this.request('PUT', this.contentsPath(file), {
      body: {
        message: `Statistik: Partie ${game.room} (${game.endedAt})`,
        content: Buffer.from(text, 'utf8').toString('base64'),
        branch: this.branch,
        ...(current.sha ? { sha: current.sha } : {}),
      },
    });
    if (res.ok) {
      const data = await res.json();
      this.files.set(file, { text, sha: data.content.sha });
      return;
    }
    // 409/422: Datei wurde zwischenzeitlich geändert (sha passt nicht) → neu laden
    if ((res.status === 409 || res.status === 422) && attempt < 3) {
      const entry = (await this.listDir()).find((e) => e.path === file);
      if (entry) await this.fetchFile(entry);
      else this.files.delete(file);
      return this.write(game, attempt + 1);
    }
    throw new Error(`GitHub: Speichern fehlgeschlagen (${res.status}) ${await res.text()}`);
  }

  // ---- Raumsicherungen ------------------------------------------------------

  /** Datei samt sha lesen; null, wenn es sie nicht gibt. */
  async getJsonFile(file) {
    const res = await this.request('GET', `${this.contentsPath(file)}?ref=${encodeURIComponent(this.branch)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub: ${file} nicht lesbar (${res.status})`);
    const data = await res.json();
    return { sha: data.sha, json: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) };
  }

  async saveRoom(code, snap, attempt = 1) {
    const file = roomFile(code);
    // Eine bestehende Sicherung zu überschreiben braucht deren sha; nur nachsehen, wenn sie unbekannt ist.
    if (!this.roomShas.has(file)) {
      const existing = await this.getJsonFile(file);
      this.roomShas.set(file, existing ? existing.sha : null);
    }
    const sha = this.roomShas.get(file);
    const res = await this.request('PUT', this.contentsPath(file), {
      body: {
        message: `Raum ${code} gesichert`,
        content: Buffer.from(JSON.stringify(snap), 'utf8').toString('base64'),
        branch: this.branch,
        ...(sha ? { sha } : {}),
      },
    });
    if (res.ok) {
      this.roomShas.set(file, (await res.json()).content.sha);
      return;
    }
    // 409/422: sha passt nicht (Datei zwischenzeitlich geändert oder gelöscht) → neu nachsehen
    if ((res.status === 409 || res.status === 422) && attempt < 3) {
      this.roomShas.delete(file);
      return this.saveRoom(code, snap, attempt + 1);
    }
    throw new Error(`GitHub: Raum ${code} nicht gesichert (${res.status})`);
  }

  async loadRoom(code) {
    const file = await this.getJsonFile(roomFile(code));
    this.roomShas.set(roomFile(code), file ? file.sha : null);
    return file ? file.json : null;
  }

  async listRooms() {
    const res = await this.request('GET', `${this.contentsPath('raeume')}?ref=${encodeURIComponent(this.branch)}`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub: raeume/ nicht lesbar (${res.status})`);
    return (await res.json()).filter((e) => e.type === 'file' && e.name.endsWith('.json')).map((e) => e.name.slice(0, -5));
  }

  async deleteRoom(code) {
    const file = roomFile(code);
    const existing = await this.getJsonFile(file);
    this.roomShas.delete(file);
    if (!existing) return;
    const res = await this.request('DELETE', this.contentsPath(file), {
      body: { message: `Raumsicherung ${code} entfernt`, sha: existing.sha, branch: this.branch },
    });
    if (!res.ok && res.status !== 404) throw new Error(`GitHub: Raum ${code} nicht gelöscht (${res.status})`);
  }
}

function createStatsStore(env = process.env) {
  // Eigener Variablenname, damit ein allgemein gesetztes GITHUB_TOKEN (z. B. von
  // CI oder Entwicklerwerkzeugen) nicht versehentlich verwendet wird.
  if (env.STATS_GITHUB_TOKEN) {
    const branch = env.STATS_BRANCH || 'statistik';
    // Schreiben auf den Deploy-Branch würde nach jeder Partie einen Neustart auslösen
    if (branch === (env.DEPLOY_BRANCH || 'main')) {
      throw new Error(`STATS_BRANCH darf nicht der Deploy-Branch "${branch}" sein.`);
    }
    return new GitHubStore({
      token: env.STATS_GITHUB_TOKEN,
      repo: env.STATS_REPO || 'FidelisIX/siedler_mit_risikoerweiterung',
      branch,
      apiUrl: env.GITHUB_API_URL,
    });
  }
  if (env.STATS_FILE) return new FileStore(env.STATS_FILE);
  return new MemoryStore();
}

module.exports = { createStatsStore, GitHubStore, FileStore, MemoryStore, monthFile, roomFile };
