import { DEFAULT_PROFILE, EVIDENCE, FUELS, GEARBOXES, LABELS, STATUSES, normalizeUrl } from "./core.mjs?v=20261027-1";

const KEY = "radar-coche-public-v1";
export const inExtension = typeof chrome !== "undefined" && !!chrome.runtime?.id && !!chrome.storage?.local;

export function emptyState() {
  return { schema: 1, profile: { ...DEFAULT_PROFILE }, cars: [], updatedAt: new Date().toISOString() };
}

export function checkState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.cars) || !value.profile || typeof value.profile !== "object") {
    throw new Error("El archivo no tiene el formato de Radar Coche.");
  }
  if (value.cars.length > 2000) throw new Error("El archivo contiene demasiados anuncios.");
  const str = (input, max = 200) => typeof input === "string" ? input.slice(0, max) : "";
  const number = (input, max) => {
    const n = Number(input);
    return input === "" || input == null || !Number.isFinite(n) ? null : Math.max(0, Math.min(max, n));
  };
  const list = (input, allowed) => Array.isArray(input) ? input.filter(x => allowed.includes(x)) : [];
  const date = input => typeof input === "string" && Number.isFinite(Date.parse(input)) ? input : new Date().toISOString();
  const profile = {
    name: str(value.profile.name, 100) || DEFAULT_PROFILE.name,
    province: str(value.profile.province, 100),
    brands: str(value.profile.brands, 500),
    notes: str(value.profile.notes, 2000),
    fuels: list(value.profile.fuels, FUELS),
    gearboxes: list(value.profile.gearboxes, GEARBOXES),
    minLabel: LABELS.includes(value.profile.minLabel) ? value.profile.minLabel : "",
  };
  for (const key of ["maxDistanceKm", "maxPrice", "minYear", "maxKm", "minSeats", "annualKm"]) {
    profile[key] = number(value.profile[key], key === "minYear" ? 2100 : 10_000_000) ?? DEFAULT_PROFILE[key];
  }
  const cars = value.cars.filter(car => car && typeof car === "object" && typeof car.id === "string")
    .map(car => {
      let url = "";
      try { url = normalizeUrl(car.url); } catch { /* Invalid imported links are discarded. */ }
      const answers = {};
      if (car.answers && typeof car.answers === "object" && !Array.isArray(car.answers)) {
        for (const [key, answer] of Object.entries(car.answers)) {
          if (key.length > 80 || !answer || typeof answer !== "object") continue;
          answers[key] = {
            status: EVIDENCE.includes(answer.status) ? answer.status : "Pendiente",
            note: str(answer.note, 800),
            updatedAt: date(answer.updatedAt),
          };
        }
      }
      const origins = {};
      if (car.origins && typeof car.origins === "object" && !Array.isArray(car.origins)) {
        for (const [key, origin] of Object.entries(car.origins)) {
          if (key.length <= 80) origins[key] = str(origin, 80);
        }
      }
      return {
        id: str(car.id, 100), demo: car.demo === true || /^demo-(?:leon|golf)$/.test(car.id),
        make: str(car.make), model: str(car.model), version: str(car.version), url,
        priceCash: number(car.priceCash, 1_000_000), priceFinanced: number(car.priceFinanced, 1_000_000),
        year: number(car.year, 2100), km: number(car.km, 2_000_000),
        fuel: FUELS.includes(car.fuel) ? car.fuel : "",
        gearbox: GEARBOXES.includes(car.gearbox) ? car.gearbox : "",
        environmentLabel: LABELS.includes(car.environmentLabel) ? car.environmentLabel : "",
        seats: number(car.seats, 20), location: str(car.location), distanceKm: number(car.distanceKm, 10_000_000),
        sellerType: ["Particular", "Profesional"].includes(car.sellerType) ? car.sellerType : "",
        status: STATUSES.includes(car.status) ? car.status : "Por revisar",
        notes: str(car.notes, 8000), sourceText: str(car.sourceText, 8000),
        advancedProfileId: str(car.advancedProfileId, 80), engineId: str(car.engineId, 80),
        answers, origins, createdAt: date(car.createdAt), updatedAt: date(car.updatedAt),
      };
    }).filter(car => car.id);
  return {
    schema: 1,
    profile,
    cars,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadState() {
  try {
    const raw = inExtension ? (await chrome.storage.local.get(KEY))[KEY] : localStorage.getItem(KEY);
    return raw ? checkState(typeof raw === "string" ? JSON.parse(raw) : raw) : emptyState();
  } catch (error) {
    console.error("No se pudieron leer los datos locales:", error);
    return emptyState();
  }
}

export async function saveState(state) {
  const data = { ...state, updatedAt: new Date().toISOString() };
  if (inExtension) await chrome.storage.local.set({ [KEY]: data });
  else localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

export async function takePendingCapture() {
  if (!inExtension) return null;
  const { pendingCapture } = await chrome.storage.local.get("pendingCapture");
  if (pendingCapture) await chrome.storage.local.remove("pendingCapture");
  return pendingCapture || null;
}
