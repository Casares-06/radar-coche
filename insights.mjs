import { activeQuestions, euro, kmText, normalizeUrl, parseListingText } from "./core.mjs";
import { advancedChecks } from "./advanced.mjs";

const comparableKey = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const important = ["priceCash", "km", "year", "gearbox", "seats", "fuel"];
const fieldNames = { priceCash: "precio al contado", km: "kilómetros", year: "año", gearbox: "cambio", seats: "plazas", fuel: "combustible" };

export function captureConflicts(capture) {
  const sources = [
    ["título", capture.heading], ["descripción", capture.description],
    ["selección", capture.selectedText], ["texto visible", capture.pageText],
  ].filter(([, text]) => text);
  const values = new Map();
  for (const [name, text] of sources) {
    const parsed = parseListingText(text);
    for (const key of important) {
      if (parsed[key] == null) continue;
      const list = values.get(key) || [];
      list.push({ source: name, value: parsed[key] });
      values.set(key, list);
    }
  }
  const structured = capture.structured || {};
  for (const [key, value] of Object.entries({ km: structured.km, year: structured.year, seats: structured.seats })) {
    const n = Number(typeof value === "object" ? value?.value : value);
    if (!Number.isFinite(n) || n <= 0) continue;
    const list = values.get(key) || [];
    list.push({ source: "metadatos", value: n }); values.set(key, list);
  }
  const warnings = [];
  for (const [key, entries] of values) {
    const distinct = [...new Set(entries.map(entry => comparableKey(entry.value)))];
    if (distinct.length < 2) continue;
    // A portal's page may contain recommendations. Only surface a disagreement with a focused source.
    if (!entries.some(entry => entry.source !== "texto visible")) continue;
    warnings.push(`${fieldNames[key]}: ${entries.map(entry => `${entry.source} ${entry.value}`).join(" · ")}`);
  }
  return warnings.slice(0, 8);
}

export function evidenceSummary(car) {
  const questions = [...activeQuestions(car).map(q => ({ ...q, priority: ["dgt", "km_trace", "maintenance", "inspection", "vin"].includes(q.key) ? 0 : 1 })),
    ...advancedChecks(car).map(check => ({ key: `advanced:${check.id}`, text: check.question, priority: check.uncertain ? 0 : 1 }))];
  const counts = { verified: 0, seller: 0, negative: 0, pending: 0 };
  for (const q of questions) {
    const status = car.answers?.[q.key]?.status;
    if (status === "Verificado") counts.verified++;
    else if (status === "Lo afirma el vendedor") counts.seller++;
    else if (status === "No cumple") counts.negative++;
    else counts.pending++;
  }
  const next = questions.filter(q => !["Verificado", "No cumple"].includes(car.answers?.[q.key]?.status))
    .sort((a, b) => a.priority - b.priority).slice(0, 3);
  return { counts, total: questions.length, next };
}

export function comparablePrices(target, cars) {
  if (!target.year || target.km == null || !target.fuel || !target.gearbox) return null;
  const matches = cars.filter(car => car.id !== target.id && car.priceCash != null && car.year && car.km != null &&
    comparableKey(car.make) === comparableKey(target.make) && comparableKey(car.model) === comparableKey(target.model) &&
    comparableKey(car.fuel) === comparableKey(target.fuel) && comparableKey(car.gearbox) === comparableKey(target.gearbox) &&
    (!target.advancedProfileId || car.advancedProfileId === target.advancedProfileId) &&
    (!target.engineId || car.engineId === target.engineId) &&
    Math.abs(car.year - target.year) <= 2 && Math.abs(car.km - target.km) <= 40000)
    .sort((a, b) => a.priceCash - b.priceCash);
  if (matches.length < 3) return { count: matches.length, enough: false };
  const prices = matches.map(car => car.priceCash);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : Math.round((prices[middle - 1] + prices[middle]) / 2);
  return { count: matches.length, enough: true, median, min: prices[0], max: prices.at(-1), difference: target.priceCash == null ? null : target.priceCash - median };
}

export function ownershipCost(car, annualKm, years = 3) {
  const c = car.costs || {};
  const annual = [c.insuranceAnnual, c.taxAnnual, c.maintenanceAnnual, c.repairReserveAnnual];
  const electric = car.fuel === "Eléctrico", phev = car.fuel === "Híbrido enchufable";
  const liquidKnown = c.fuelL100 != null && c.fuelPrice != null && annualKm > 0;
  const chargeKnown = c.energyKwh100 != null && c.energyPrice != null && annualKm > 0;
  const electricShare = phev ? (c.electricSharePercent ?? 0) / 100 : electric ? 1 : 0;
  // For a PHEV the user supplies annual km split as a percentage driven electrically.
  const energyKnown = electric ? chargeKnown : phev ? c.electricSharePercent != null &&
    (electricShare === 1 || liquidKnown) && (electricShare === 0 || chargeKnown) : liquidKnown;
  const fuelAnnual = !energyKnown ? null :
    (electric || electricShare === 1 ? 0 : annualKm * (1 - electricShare) * c.fuelL100 / 100 * c.fuelPrice) +
    (electricShare ? annualKm * electricShare * c.energyKwh100 / 100 * c.energyPrice : 0);
  const recurring = [...annual, fuelAnnual].filter(value => value != null);
  const purchase = c.financeTotal != null ? c.financeTotal : car.priceCash;
  const total = purchase == null ? null : purchase + (c.transferCost || 0) + years * recurring.reduce((a, b) => a + b, 0);
  const complete = purchase != null && annual.every(value => value != null) && energyKnown && c.transferCost != null;
  return { total, complete, fuelAnnual, years, annualKm, purchase, knownAnnual: recurring.reduce((a, b) => a + b, 0) };
}

export function nextSnapshot(previous, current, at = new Date().toISOString()) {
  const history = Array.isArray(previous?.history) ? [...previous.history] : [];
  const fields = ["priceCash", "priceFinanced", "km", "year"];
  const changes = fields.filter(key => previous && previous[key] !== current[key])
    .map(key => ({ field: key, from: previous[key] ?? null, to: current[key] ?? null, at }));
  if (!previous) for (const key of fields) if (current[key] != null) changes.push({ field: key, from: null, to: current[key], at });
  return [...history, ...changes].slice(-100);
}

export function questionText(car) {
  const items = evidenceSummary(car).next.map(q => `• ${q.text}`);
  return [`Hola, estoy valorando el ${[car.make, car.model, car.version].filter(Boolean).join(" ")}.`,
    "Antes de organizar una visita, ¿podrías ayudarme con estas comprobaciones?", ...items,
    "También me gustaría confirmar el precio final al contado y si aceptas una revisión independiente. Gracias."].join("\n");
}

export function describeHistory(entry) {
  const labels = { priceCash: "Precio al contado", priceFinanced: "Precio financiado", km: "Kilómetros", year: "Año" };
  const format = value => entry.field.startsWith("price") ? euro(value) : entry.field === "km" ? kmText(value) : value ?? "—";
  return `${labels[entry.field] || entry.field}: ${format(entry.from)} → ${format(entry.to)}`;
}

export function safeSourceLink(raw) { try { return normalizeUrl(raw); } catch { return ""; } }
