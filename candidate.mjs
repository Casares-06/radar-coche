import { parseListingText } from "./core.mjs?v=20261027-1";

const MAKES = [
  "Alfa Romeo", "Aston Martin", "Land Rover", "Mercedes-Benz", "Volkswagen", "Citroën",
  "Peugeot", "Renault", "Toyota", "Hyundai", "Skoda", "Škoda", "Nissan", "Mazda", "Honda",
  "Ford", "Fiat", "Opel", "Seat", "Cupra", "Audi", "BMW", "Kia", "Mini", "Volvo", "Dacia",
  "Suzuki", "Lexus", "Jeep", "Tesla", "Porsche", "Jaguar", "Mitsubishi", "Subaru", "Smart",
];

function numeric(value, max) {
  if (value == null || value === "") return null;
  if (typeof value === "object") return numeric(value.value ?? value.amount, max);
  const text = String(value).trim().replace(/[€\s]/g, "");
  let parsed;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) parsed = Number(text.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)) parsed = Number(text.replace(/,/g, ""));
  else parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max ? Math.round(parsed) : null;
}

function nameFromHeading(heading) {
  const text = String(heading || "").replace(/[|·–—]/g, " ").trim();
  const lower = text.toLocaleLowerCase("es-ES");
  const make = MAKES.find(value => new RegExp(`(^|[^\\p{L}])${value.toLocaleLowerCase("es-ES").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}])`, "u").test(lower));
  if (!make) return {};
  const after = text.slice(lower.indexOf(make.toLocaleLowerCase("es-ES")) + make.length).trim();
  const words = after.match(/^[\p{L}\d-]+(?:\s+[\p{L}\d-]+)?/u)?.[0]?.split(/\s+/) || [];
  const model = words[0] === "Clase" || words[0] === "Serie" ? words.slice(0, 2).join(" ") : words[0];
  return { make, ...(model && !/^\d{4}$/.test(model) ? { model } : {}) };
}

export function candidateFromCapture(raw) {
  const capture = raw && typeof raw === "object" ? raw : {};
  const fields = {};
  const origins = {};
  const put = (key, value, origin, overwrite = true) => {
    if (value === undefined || value === null || value === "" || (!overwrite && fields[key] != null)) return;
    fields[key] = value;
    origins[key] = origin;
  };
  for (const [source, origin] of [
    [capture.pageText, "texto visible; revisa"],
    [capture.description, "descripción; revisa"],
    [capture.selectedText, "texto seleccionado; revisa"],
  ]) {
    for (const [key, value] of Object.entries(parseListingText(source))) put(key, value, origin);
  }
  const structured = capture.structured || {};
  const heading = nameFromHeading(capture.heading || capture.title);
  put("make", heading.make, "título; revisa");
  put("model", heading.model, "título; revisa");
  put("make", String(structured.make || "").trim(), "metadatos; revisa");
  put("model", String(structured.model || "").trim(), "metadatos; revisa");
  const year = String(structured.year || "").match(/\b(?:19[89]|20[0-3])\d\b/)?.[0];
  if (year) put("year", Number(year), "metadatos; revisa");
  put("km", numeric(structured.km, 2_000_000), "metadatos; revisa");
  const fuel = parseListingText(String(structured.fuel || "").replace(/([a-z])([A-Z])/g, "$1 $2")).fuel;
  const gearbox = parseListingText(String(structured.gearbox || "").replace(/([a-z])([A-Z])/g, "$1 $2")).gearbox;
  put("fuel", fuel, "metadatos; revisa");
  put("gearbox", gearbox, "metadatos; revisa");
  put("seats", numeric(structured.seats, 20), "metadatos; revisa");
  put("location", String(structured.location || "").trim(), "metadatos; revisa");
  const publishedPrice = numeric(structured.price, 1_000_000);
  if (publishedPrice !== fields.priceFinanced) put("priceCash", publishedPrice, "precio publicado; confirma condiciones", false);
  const version = String(structured.version || "").trim();
  if (version && version.toLocaleLowerCase("es-ES") !== `${fields.make || ""} ${fields.model || ""}`.trim().toLocaleLowerCase("es-ES")) {
    put("version", version.slice(0, 160), "metadatos; revisa");
  }
  const signalText = `${capture.heading || ""}\n${capture.pageText || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const vehicleSignal = capture.hasVehicleSchema === true || /\b(?:kilometraje|combustible|matriculacion|plazas|cambio|\d[. ]?\d{3}\s*km)\b/.test(signalText);
  const count = ["make", "model", "year", "km", "priceCash", "fuel", "gearbox", "seats"].filter(key => fields[key] != null && fields[key] !== "").length;
  const canAdd = vehicleSignal && count >= 2 && (fields.km != null || (fields.make && fields.model) || capture.hasVehicleSchema === true);
  return {
    canAdd: !!canAdd,
    fields, origins,
    url: String(capture.url || ""),
    pageTitle: String(capture.heading || capture.title || "Anuncio abierto").slice(0, 160),
    sourceText: String(capture.selectedText || structured.description || capture.description || capture.pageText || "").slice(0, 8000),
    fieldCount: count,
  };
}
