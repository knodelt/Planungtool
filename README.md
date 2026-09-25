# Planungtool · Demo

Interaktive Instandhaltungsplanung mit ausschließlich fiktiven Beispieldaten.

## Enthalten

- Dashboard, Wochenplanung, Wartungspläne und Arbeitsaufträge
- Offene Arbeiten, Anlagenverwaltung und Teamkalender
- Ersatzteilbestand mit acht bearbeitbaren Beispielteilen
- Zeichnungsarchiv mit frei erfundenem Demoschema
- Anlagenüberwachung mit Beispielhistorien
- JSON-Import/Export und lokale Speicherung

**Demo-Passwort:** `demo` (Teamkalender und Ersatzteil-Bearbeitungsmodus).

Jeder Besucher hat einen eigenen Datenbestand in seinem Browser. Es gibt keine Server-Datenbank, keine gemeinsam genutzten Betriebsdaten und keine Synchronisierung zwischen Geräten. Termine werden beim ersten Start und beim Zurücksetzen relativ zum aktuellen Datum angelegt. „Demo zurücksetzen“ entfernt die lokalen Demoänderungen in allen Modulen.

## Cloudflare Workers

Repository mit Cloudflare verbinden. Kein Build-Schritt erforderlich. Deploy-Befehl: `npx wrangler deploy`.

Die Konfiguration ist enthalten. Es werden weder D1/R2-Bindings noch Secrets benötigt. Der Worker liefert ausschließlich die Anwendung aus. API-Anfragen werden im Browser lokal verarbeitet; serverseitige API-Pfade liefern keine Daten.

## Lokale Vorschau

Node.js 22 oder neuer: `npm start`, anschließend http://localhost:8080 öffnen.
Alternativ `npm install` und `npm run dev` für die Wrangler-Vorschau.

## Hinweise

Das Passwort ist eine sichtbare Bedienungsdemo, kein Zugriffsschutz. Nur Beispieldaten verwenden. Eigene Importe bleiben lokal und können durch Zurücksetzen entfernt werden. Excel-Funktionen laden XLSX/JSZip von jsDelivr; dafür ist eine Internetverbindung nötig. Die eingebauten Beispieldaten funktionieren ohne Excel-Datei. JSON-Backups umfassen die Planung; Zeichnungen, Ersatzteile und Überwachungen gehören nicht zu diesem Export.
