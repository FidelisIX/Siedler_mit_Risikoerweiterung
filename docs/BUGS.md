# Bugs

Bekannte Fehler und Einschränkungen. Neue Einträge oben bei „Offen“ ergänzen.

**Vorlage für neue Einträge:**

```markdown
### B-XXX: Kurzer Titel
- **Gemeldet:** JJJJ-MM-TT, von wem
- **Wo:** Seite/Bildschirm, Gerät/Browser
- **Schritte zum Nachstellen:** 1. … 2. …
- **Erwartet:** …
- **Tatsächlich:** …
- **Screenshot/Log:** (optional)
```

---

## Offen

### B-003: Banktausch ist mit „Holz → Holz“ vorbelegt
- **Gemeldet:** 2026-10-30, Claude (beim Testen gesehen)
- **Wo:** Spiel, Seitenleiste „Handel“
- **Schritte zum Nachstellen:** 1. Würfeln. 2. Ohne Auswahl auf „Bank“ klicken.
- **Erwartet:** Sinnvolle Vorbelegung (zwei verschiedene Rohstoffe) oder deaktivierter Knopf.
- **Tatsächlich:** Beide Auswahlfelder stehen auf Holz; der Klick meldet „Ungültiger Tausch“.

### B-002: Raumsicherung greift nur bei geordnetem Herunterfahren
- **Gemeldet:** 2026-10-30, Claude (Einschränkung, wie bei Ortsraten)
- **Wo:** Server
- **Erwartet:** Laufende Partien überstehen jeden Neustart.
- **Tatsächlich:** Räume werden nur bei SIGTERM (z. B. Deploy auf Render) gesichert. Bei einem Absturz
  oder ohne `STATS_GITHUB_TOKEN` (siehe docs/OFFENE_AUFGABEN.md, A-001) gehen sie verloren.
  Sicherungen älter als 10 Minuten werden verworfen.

---

## Behoben

### B-001: Endstand erscheint nicht, Oberfläche hängt bei Spielende
- **Gemeldet:** 2026-10-30, Claude (beim Browser-Test einer ganzen Partie)
- **Wo:** Spiel, letzte Runde
- **Tatsächlich:** Nach dem letzten Zug blieb die Seite stehen; „Zug beenden“ meldete „Diese Aktion ist
  gerade nicht möglich“. Ursache: `renderActions` griff bei Spielende auf den (nicht mehr vorhandenen)
  aktiven Spieler zu und brach das Rendern ab.
- **Behoben:** 2026-10-30 (Commit „Raum-Features, Raumsicherung und Statistik …“).
