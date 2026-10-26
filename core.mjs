export const FUELS = ["Gasolina", "Diésel", "Híbrido", "Híbrido enchufable", "Eléctrico", "GLP/GNC", "Otro"];
export const GEARBOXES = ["Manual", "Automático", "Otro"];
export const LABELS = ["Sin etiqueta", "B", "C", "ECO", "0"];
export const STATUSES = ["Por revisar", "Contactado", "Visita prevista", "Visitado", "Finalista", "Descartado"];
export const EVIDENCE = ["Pendiente", "Lo afirma el vendedor", "Verificado", "No cumple"];

export const DEFAULT_PROFILE = {
  name: "Mi búsqueda",
  province: "",
  maxDistanceKm: 0,
  maxPrice: 18000,
  minYear: 2016,
  maxKm: 160000,
  brands: "",
  fuels: [],
  gearboxes: [],
  minLabel: "",
  minSeats: 0,
  annualKm: 12000,
  notes: "",
};

export const QUESTIONS = [
  ["maintenance", "¿Hay historial de mantenimiento con fechas y kilometraje?", "Pide facturas o libro con fechas y kilómetros."],
  ["km_trace", "¿Cuadran los kilómetros con ITV, facturas e historial?", "Contrasta varios registros, no solo el marcador."],
  ["dgt", "¿Se ha comprobado el informe DGT?", "Revisa titularidad, incidencias y posibles cargas."],
  ["itv", "¿Tiene ITV vigente y sin defectos pendientes?", "Solicita la ficha técnica y el último informe."],
  ["vin", "¿Coinciden matrícula y bastidor con la documentación?", "Compruébalo presencialmente."],
  ["damage", "¿Se han aclarado daños estructurales o accidentes importantes?", "Pregunta por reparaciones de chasis, airbags y partes."],
  ["inspection", "¿Permite una revisión mecánica independiente?", "Acuerda la inspección antes de reservar o pagar."],
  ["test_drive", "¿Se ha hecho una prueba de conducción suficiente?", "Comprueba arranque, frenos, ruidos y cambios."],
  ["ownership", "¿Puede acreditar titularidad y ausencia de cargas?", "Comprueba quién firma la venta."],
  ["timing", "¿Se conoce el mantenimiento de distribución de este motor?", "Confirma el sistema, intervalo aplicable y factura."],
  ["automatic", "¿Consta el mantenimiento de la caja automática?", "Consulta el intervalo del fabricante y pide prueba."],
  ["diesel_system", "¿Se han revisado EGR, filtro de partículas y AdBlue si equipa?", "Pregunta por testigos, uso urbano y reparaciones; no presupone avería."],
  ["ev_battery", "¿Hay prueba de salud de batería y garantía restante?", "Pide estado de salud medido y condiciones de garantía."],
  ["ev_charge", "¿Funcionan la carga, el cable y el puerto?", "Prueba la carga y confirma qué cables se entregan."],
  ["phev_battery", "¿Hay informe de batería y prueba del sistema híbrido?", "Solicita diagnóstico y comprueba la carga."],
  ["dealer_terms", "¿Constan garantía, factura y condiciones por escrito?", "Aclara cobertura y gastos excluidos."],
  ["finance_total", "¿Se conoce el coste total de la financiación?", "Pide TAE, comisiones, permanencia y total de cuotas."],
];

const cleanNumber = (value) => {
  const n = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const clamp = (value) => Math.max(0, Math.min(1, value));
export const euro = (n) => n == null ? "—" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(n) + " €";
export const kmText = (n) => n == null ? "—" : new Intl.NumberFormat("es-ES").format(n) + " km";
export const carName = (car) => [car.make, car.model, car.version].filter(Boolean).join(" ") || "Coche sin nombre";

export function normalizeUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  let url;
  try { url = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text); }
  catch { throw new Error("Introduce una URL válida."); }
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Solo se admiten enlaces HTTP o HTTPS.");
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\?$/, "");
}

export function parseListingText(raw) {
  const text = String(raw || "").replace(/\u00a0/g, " ");
  const out = {};
  const price = text.match(/(?<!\d)(\d{1,3}(?:[. ]\d{3})+|\d{4,6})\s*(?:€|euros?)/i)
    || text.match(/(?<!\d)(\d{1,3}(?:[. ]\d{3})+|\d{4,6})\s*€/i);
  if (price) out.priceCash = cleanNumber(price[1]);
  const kms = text.match(/(?<!\d)(\d{1,3}(?:[. ]\d{3})+|\d{4,6})\s*(?:km|kilómetros?)\b/i);
  if (kms) out.km = cleanNumber(kms[1]);
  const year = text.match(/\b(?:19[89]\d|20[0-3]\d)\b/);
  if (year && Number(year[0]) <= new Date().getFullYear() + 1) out.year = Number(year[0]);
  const lower = text.toLocaleLowerCase("es-ES");
  for (const [fuel, terms] of [
    ["Eléctrico", ["eléctrico", "electric"]],
    ["Híbrido enchufable", ["híbrido enchufable", "phev"]],
    ["Híbrido", ["híbrido", "hybrid"]],
    ["Diésel", ["diésel", "diesel", "gasoil"]],
    ["Gasolina", ["gasolina"]],
  ]) {
    if (terms.some((term) => lower.includes(term))) { out.fuel = fuel; break; }
  }
  if (/\b(automático|automática|dsg|cvt)\b/i.test(text)) out.gearbox = "Automático";
  else if (/\bmanual\b/i.test(text)) out.gearbox = "Manual";
  return out;
}

export function activeQuestions(car) {
  const keys = new Set(["maintenance", "km_trace", "dgt", "itv", "vin", "damage", "inspection", "test_drive", "ownership"]);
  if (car.fuel !== "Eléctrico" && ((car.year && new Date().getFullYear() - car.year >= 5) || (car.km || 0) >= 80000)) keys.add("timing");
  if (car.gearbox === "Automático") keys.add("automatic");
  if (car.fuel === "Diésel") keys.add("diesel_system");
  if (car.fuel === "Eléctrico") { keys.add("ev_battery"); keys.add("ev_charge"); }
  if (car.fuel === "Híbrido enchufable") { keys.add("phev_battery"); keys.add("ev_charge"); }
  if (car.sellerType === "Profesional") keys.add("dealer_terms");
  if (car.priceFinanced) keys.add("finance_total");
  return QUESTIONS.filter(([key]) => keys.has(key)).map(([key, text, tip]) => ({ key, text, tip }));
}

export function evaluate(car, profile) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const checks = [];
  const fails = [];
  const missing = [];
  const add = (label, weight, active, actual, test, detail) => {
    if (!active) return;
    const known = actual !== null && actual !== "" && actual !== undefined;
    const ratio = known ? clamp(test(actual)) : null;
    checks.push({ label, weight, ratio, detail });
    if (!known) missing.push(label);
    else if (ratio === 0) fails.push(label);
  };
  add("Precio al contado", 25, p.maxPrice > 0, car.priceCash,
    n => n > p.maxPrice ? 0 : 0.55 + 0.45 * (p.maxPrice - n) / p.maxPrice,
    `Límite: ${euro(p.maxPrice)}`);
  add("Año", 17, p.minYear > 0, car.year,
    n => n < p.minYear ? 0 : 0.55 + 0.45 * (n - p.minYear) / Math.max(1, new Date().getFullYear() - p.minYear),
    `Desde ${p.minYear}`);
  add("Kilómetros", 20, p.maxKm > 0, car.km,
    n => n > p.maxKm ? 0 : 0.55 + 0.45 * (p.maxKm - n) / p.maxKm,
    `Hasta ${kmText(p.maxKm)}`);
  add("Distancia", 8, p.maxDistanceKm > 0, car.distanceKm,
    n => n > p.maxDistanceKm ? 0 : 0.55 + 0.45 * (p.maxDistanceKm - n) / p.maxDistanceKm,
    `Hasta ${p.maxDistanceKm} km`);
  add("Combustible", 10, p.fuels.length > 0, car.fuel, n => p.fuels.includes(n) ? 1 : 0, p.fuels.join(", "));
  add("Cambio", 5, p.gearboxes.length > 0, car.gearbox, n => p.gearboxes.includes(n) ? 1 : 0, p.gearboxes.join(", "));
  add("Plazas", 5, p.minSeats > 0, car.seats, n => n >= p.minSeats ? 1 : 0, `Mínimo ${p.minSeats}`);
  add("Etiqueta", 10, !!p.minLabel, car.environmentLabel,
    n => LABELS.indexOf(n) >= LABELS.indexOf(p.minLabel) ? 1 : 0, `Mínimo ${p.minLabel}`);
  const brands = p.brands.split(",").map(x => x.trim().toLocaleLowerCase("es-ES")).filter(Boolean);
  if (brands.length && car.make && !brands.includes(car.make.toLocaleLowerCase("es-ES"))) fails.push("Marca");
  const knownWeight = checks.filter(x => x.ratio != null).reduce((sum, x) => sum + x.weight, 0);
  const totalWeight = checks.reduce((sum, x) => sum + x.weight, 0);
  const points = checks.reduce((sum, x) => sum + x.weight * (x.ratio ?? 0), 0);
  const score = knownWeight >= Math.min(40, totalWeight) && totalWeight > 0 ? Math.round(100 * points / knownWeight) : null;
  const questions = activeQuestions(car);
  const verified = questions.filter(q => car.answers?.[q.key]?.status === "Verificado").length;
  const negative = questions.filter(q => car.answers?.[q.key]?.status === "No cumple").map(q => q.text);
  return {
    score,
    dataCoverage: totalWeight ? Math.round(100 * knownWeight / totalWeight) : 0,
    verified,
    questionCount: questions.length,
    fails,
    negative,
    missing,
    checks,
    provisional: knownWeight < totalWeight || verified < questions.length,
  };
}

export function validateCar(car) {
  const errors = [];
  if (!String(car.make || "").trim()) errors.push("Indica la marca.");
  if (!String(car.model || "").trim()) errors.push("Indica el modelo.");
  if (car.url) {
    try { normalizeUrl(car.url); } catch (error) { errors.push(error.message); }
  }
  if (car.year && (car.year < 1980 || car.year > new Date().getFullYear() + 1)) errors.push("Revisa el año.");
  if (car.priceCash != null && (car.priceCash < 0 || car.priceCash > 1000000)) errors.push("Revisa el precio.");
  if (car.km != null && (car.km < 0 || car.km > 2000000)) errors.push("Revisa los kilómetros.");
  return errors;
}

export function demoCars() {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-leon", demo: true, make: "Seat", model: "León", version: "1.5 TSI · EJEMPLO FICTICIO",
      url: "https://example.com/radar-seat-leon", priceCash: 15900, priceFinanced: 14900,
      year: 2019, km: 89000, fuel: "Gasolina", gearbox: "Automático", environmentLabel: "C",
      seats: 5, location: "Pamplona", distanceKm: 15, sellerType: "Profesional", status: "Por revisar",
      notes: "Datos inventados para probar la interfaz. No existe este anuncio.",
      answers: {}, origins: {}, createdAt: now, updatedAt: now,
    },
    {
      id: "demo-golf", demo: true, make: "Volkswagen", model: "Golf", version: "1.4 TSI · EJEMPLO FICTICIO",
      url: "https://example.com/radar-vw-golf", priceCash: 13900, priceFinanced: null,
      year: 2017, km: 128000, fuel: "Gasolina", gearbox: "Manual", environmentLabel: "C",
      seats: 5, location: "Estella", distanceKm: 45, sellerType: "Particular", status: "Por revisar",
      notes: "Datos inventados para probar la interfaz. No existe este anuncio.",
      answers: {}, origins: {}, createdAt: now, updatedAt: now,
    },
  ];
}
