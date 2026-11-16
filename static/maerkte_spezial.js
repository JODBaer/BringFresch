// Spezialmärkte und Märkte mit festem Datum – von Hand gepflegt (nur Fakten, Quelle jeweils dabei).
// Datumsregeln: core.js (specialDays). Wochentag Mo = 0 … So = 6.
//   rule: { m: Monat 1–12, nth: n-ter Wochentag (-1 = der letzte), wd }   dates: ["JJJJ-MM-TT"]   ranges: [[von, bis]] + days (Wochentage)
//   pruefen: true = Datum/Zeiten nicht auf einer offiziellen Seite bestätigt → in der App «Datum prüfen»
// Koordinaten: ungefähr der Marktplatz bzw. das Zentrum des Orts.
// Neue Einträge nur von der offiziellen Seite der Stadt / des Veranstalters (jede Seite einzeln, kein Massen-Abruf).
window.BF_SPECIAL = { stand: "2026-11-16", items: [
  // Stand 16.11.2026. Quelle: Stadt Bern («immer am vierten Montag im November», 6–18 Uhr)
  { id: "zibelemaerit", n: "Zibelemärit", ort: "Bern", lat: 46.9467, lon: 7.444, rule: { m: 11, nth: 4, wd: 0 }, zeit: "6–18 Uhr", web: "https://www.bern.ch/themen/freizeit-und-sport/markte/zibelemaerit" },
  // Quelle: Verein Rüeblimärt Aarau («immer am ersten Mittwoch im November», 7:30–18 Uhr)
  { id: "rueeblimaert", n: "Rüeblimärt", ort: "Aarau", lat: 47.3917, lon: 8.0453, rule: { m: 11, nth: 1, wd: 2 }, zeit: "7:30–18 Uhr", web: "https://www.rueblimaert-aarau.ch/" },
  // Quelle: Gemeinde Richterswil (2026: Samstag 14. November, Umzug 18 Uhr, Marktstände ab 15 Uhr); weitere Jahre: Datum jeweils neu eintragen
  { id: "raebechilbi", n: "Räbechilbi", ort: "Richterswil", lat: 47.2058, lon: 8.6989, dates: ["2026-11-14"], zeit: "Marktstände ab 15 Uhr, Umzug 18 Uhr", web: "https://www.richterswil.ch/aktuellesinformationen/3003379" },
  // Quelle: Reiseportale (zuerich.com): 3.–20. Dezember 2026, Do–So; offizielle Seite nicht geprüft
  { id: "christkindlimaert", n: "Christkindlimärt", ort: "Rapperswil-Jona", lat: 47.2267, lon: 8.8184, ranges: [["2026-12-03", "2026-12-20"]], days: [3, 4, 5, 6], zeit: "Do–So, Zeiten prüfen", pruefen: true, web: "https://www.zuerich.com/de/besuchen/shopping/christkindlimaert-rapperswil-jona" },
  // Quelle: Reiseportal (swissasap.com): 19. November bis 23./24. Dezember 2026; offizielle Seite nicht gefunden
  { id: "bellevue-noel", n: "Bellevue Noël (Weihnachtsmarkt)", ort: "Zürich", lat: 47.3667, lon: 8.5453, ranges: [["2026-11-19", "2026-12-23"]], zeit: "Zeiten prüfen", pruefen: true, web: "https://www.zuerich.com/de/sightseeing-aktivitaeten/shopping/weihnachtsmaerkte" }
] };
