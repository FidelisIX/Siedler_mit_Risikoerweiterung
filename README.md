# Archipel

Online-Multiplayer-Aufbauspiel für 2–6 Spieler im Browser. Server: Node.js + Express + Socket.IO,
Client: reines HTML/CSS/JavaScript mit SVG-Hexkarte. Der Server prüft alle Spielregeln.

## Spielregeln (Kurzfassung)

- **Ziel:** Nach einer festen Rundenzahl (8, 12 oder 16, wählt der Gastgeber) gewinnt, wer die meisten Punkte hat.
  Gleichstand: mehr Rohstoffe.
- **Karte:** Hex-Felder (Wald, Steinbruch, Acker, Mine, Ödland), aufgeteilt in 6 Regionen. Jede Region
  enthält jedes Gelände mindestens einmal.
- **Aufbau:** Jeder setzt in Schlangenreihenfolge zwei Start-Siedlungen auf freie Felder ohne Nachbargebäude.
  Startrohstoffe: 2 Holz, 2 Stein, 2 Nahrung, 1 Erz.
- **Würfeln:** Der aktive Spieler wirft den Regionswürfel (1–6) und den Geländewürfel
  (Wald, Steinbruch, Acker, Mine, Stern, Stern).
  - Gebäude in der gewürfelten Region produzieren.
  - Gebäude auf dem gewürfelten Gelände produzieren (überall auf der Karte).
  - Trifft beides zu: doppelt. Bei **Stern** produziert nur die gewürfelte Region, dafür doppelt.
- **Gebäude** (ein Gebäude pro Feld, neue Gebäude nur neben eigenen):

  | Gebäude  | Kosten                              | Punkte | Wirkung                          |
  |----------|-------------------------------------|--------|----------------------------------|
  | Siedlung | 1 Holz, 1 Stein, 1 Nahrung          | 1      | produziert 1                     |
  | Gutshof  | 2 Nahrung, 2 Erz (Ausbau Siedlung)  | 2      | produziert 2                     |
  | Markt    | 2 Holz, 1 Stein                     | 1      | Banktausch 2:1 statt 3:1         |
  | Monument | 1 Holz, 2 Stein, 1 Nahrung, 2 Erz   | 3      | –                                |

  Markt und Monument dürfen auch auf Ödland stehen.
- **Handel:** Mit der Bank (3:1, mit Markt 2:1) oder per Angebot an einen Mitspieler.
- **Verbindungsabbruch:** Neu laden verbindet wieder mit dem Raum. Ist der aktive Spieler getrennt,
  können Mitspieler seinen Zug überspringen.

## Lokal starten

```bash
npm install
npm start
```

Dann <http://localhost:3000> öffnen. Tests: `npm test`.

## Deployment auf Render

Das Repo enthält eine `render.yaml` (Blueprint).

1. Auf <https://dashboard.render.com> **New → Blueprint** wählen und dieses Repository verbinden.
2. Render liest `render.yaml` und legt den Web Service `archipel` an (Build: `npm ci`, Start: `npm start`).

Alternativ **New → Web Service** mit denselben Befehlen. Render setzt `PORT` automatisch.

**Hinweis:** Spielstände liegen nur im Arbeitsspeicher. Bei einem Neustart oder Redeploy – und beim
Free-Plan auch beim Einschlafen nach Inaktivität – gehen laufende Spiele verloren.

## Struktur

```
server/map.js     Kartengenerator (Hex-Koordinaten, Regionen)
server/game.js    Spiellogik und Regeln
server/index.js   HTTP- und Socket.IO-Server, Räume
public/           Browser-Client
test/             Tests der Spiellogik (node:test)
```
