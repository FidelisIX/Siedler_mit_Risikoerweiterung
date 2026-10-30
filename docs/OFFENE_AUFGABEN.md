# Offene Aufgaben

To-dos, die nicht im Code erledigt werden können (Einstellungen, Konten, Entscheidungen).
Neue Einträge oben bei „Offen“ ergänzen.

**Vorlage für neue Einträge:**

```markdown
### A-XXX: Kurzer Titel
- **Angelegt:** JJJJ-MM-TT, von wem
- **Wer:** wer muss es erledigen
- **Fällig/Erinnerung:** (optional)
- **Was ist zu tun:** 1. … 2. …
- **Warum:** …
```

---

## Offen

### A-001: `STATS_GITHUB_TOKEN` auf Render eintragen
- **Angelegt:** 2026-10-30, Simon
- **Wer:** Simon (braucht Zugang zu GitHub und Render)
- **Fällig/Erinnerung:** Erinnerung in der Claude-Sitzung am 2026-10-31, 18:00 Uhr (Berlin)
- **Was ist zu tun:**
  1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**:
     Token nur für `FidelisIX/siedler_mit_risikoerweiterung`, Berechtigung **Contents: Read and write**, sonst nichts.
  2. Render → Service `archipel` → **Environment**: Variable `STATS_GITHUB_TOKEN` mit dem Token anlegen.
  3. Prüfen: Im Render-Log steht beim Start `Statistik: … Partien geladen (GitHub FidelisIX/siedler_mit_risikoerweiterung, Branch statistik)`,
     und die Statistikseite zeigt keinen gelben Hinweis mehr.
- **Warum:** Ohne Token gehen laufende Räume bei jedem Deploy verloren und die Statistik gilt nur bis zum
  nächsten Neustart (siehe README, „Statistik & Raumsicherung“).

---

## Erledigt

### A-000: Render-Blueprint anlegen
- **Angelegt:** 2026-10-30, Simon
- **Erledigt:** 2026-10-30 – Blueprint im Render-Dashboard angelegt, Auto-Deploy bei Push auf `main`.
