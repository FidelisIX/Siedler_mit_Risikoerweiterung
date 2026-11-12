# Hinweise für Claude

## Projekt

- Offene Aufgaben: docs/OFFENE_AUFGABEN.md, Bugs: docs/BUGS.md, Feature Requests: docs/FEATURE_REQUESTS.md.
  Neue Meldungen dort eintragen und beim Erledigen nach „Erledigt“/„Behoben“/„Umgesetzt“ verschieben.
- Render deployt bei jedem Push auf `main` automatisch neu.
- Tests: `npm test`. Nach Änderungen an Spielregeln zusätzlich `npm run simulate` (Testpartien mit Computergegnern
  über alle Varianten, Karten, Siegbedingungen und Teams; prüft den Spielzustand nach jedem Schritt).
