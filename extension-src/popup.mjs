import { candidateFromCapture } from "./candidate.mjs";
import { readCurrentPage } from "./capture.mjs";
import { advancedChecks, matchingProfiles } from "./advanced.mjs";

const BLOCKED_HOSTS = ["wallapop.com", "milanuncios.com"];
const labels = {
  make: "Marca", model: "Modelo", year: "Año", km: "Kilómetros", priceCash: "Contado",
  priceFinanced: "Financiado", fuel: "Combustible", gearbox: "Cambio", seats: "Plazas",
  environmentLabel: "Etiqueta", location: "Localidad",
};
let candidate = null;
let advancedProfile = null;

const element = id => document.getElementById(id);
function status(text, kind = "") {
  element("status-text").textContent = text;
  element("status-dot").parentElement.className = `status ${kind}`;
}
function showFields(fields) {
  const list = element("fields");
  list.replaceChildren();
  const entries = Object.entries(labels).filter(([key]) => fields[key] !== undefined && fields[key] !== null && fields[key] !== "");
  for (const [key, label] of entries) {
    const box = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = key === "priceCash" || key === "priceFinanced" ? `${Number(fields[key]).toLocaleString("es-ES")} €` :
      key === "km" ? `${Number(fields[key]).toLocaleString("es-ES")} km` : String(fields[key]);
    box.append(dt, dd);
    list.append(box);
  }
  element("field-count").textContent = `${entries.length} campos`;
  element("detected").hidden = entries.length === 0;
}

async function inspectCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error("Abre un anuncio web y vuelve a pulsar Radar Coche.");
    const url = new URL(tab.url);
    element("page-host").textContent = url.hostname;
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Esta pestaña no es una página web. Abre un anuncio para capturarlo.");
    if (BLOCKED_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      throw new Error("La captura automática está desactivada en este portal. Puedes añadir el anuncio a mano.");
    }
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readCurrentPage });
    candidate = candidateFromCapture(results?.[0]?.result);
    element("page-title").textContent = candidate.pageTitle;
    showFields(candidate.fields);
    if (!candidate.canAdd) {
      status("No hay datos suficientes", "error");
      element("message").textContent = "No parece un anuncio de coche con datos suficientes. Puedes añadirlo a mano desde Radar Coche.";
      element("open").textContent = "Añadir a mano";
      return;
    }
    status("Anuncio listo para revisar", "ready");
    element("message").textContent = "Los datos detectados son sugerencias. Comprueba especialmente precio, cambio y kilómetros.";
    element("add").disabled = false;
    const profiles = candidate.fields.year ? matchingProfiles(candidate.fields) : [];
    if (profiles.length) {
      advancedProfile = profiles[0];
      const checks = advancedChecks({ ...candidate.fields, advancedProfileId: advancedProfile.id });
      element("tabs").hidden = false;
      element("advanced-name").textContent = `${advancedProfile.make} ${advancedProfile.model} · ${advancedProfile.generation}`;
      element("advanced-description").textContent = checks.length ? `${checks.length} ${checks.length === 1 ? "comprobación" : "comprobaciones"} para preguntar y documentar.` : "Confirma motor y versión para ver qué preguntas corresponden a esta unidad.";
      element("advanced-checks").replaceChildren(...checks.slice(0, 3).map(check => {
        const row = document.createElement("div"); row.textContent = check.title; return row;
      }));
      element("add-advanced").disabled = false;
    }
  } catch (error) {
    status("No se puede capturar", "error");
    element("page-title").textContent = "Añade el anuncio a mano";
    element("message").textContent = error.message || "No se pudo leer esta página.";
    element("open").textContent = "Abrir Radar Coche";
  }
}

async function addCandidate(advanced = false) {
  if (!candidate?.canAdd) return;
  const button = element(advanced ? "add-advanced" : "add");
  button.disabled = true;
  status("Preparando la ficha…");
  try {
    await chrome.storage.local.set({ pendingCapture: {
      fields: candidate.fields,
      origins: candidate.origins,
      url: candidate.url,
      sourceText: candidate.sourceText,
      notes: candidate.notes,
      advancedRequested: advanced,
      advancedProfileId: advanced ? advancedProfile?.id : "",
    } });
    await chrome.tabs.create({ url: chrome.runtime.getURL("index.html#nuevo") });
    window.close();
  } catch (error) {
    status("No se pudo abrir la ficha", "error");
    element("message").textContent = error.message || "Prueba de nuevo o añade el anuncio a mano.";
    button.disabled = false;
  }
}
element("add").addEventListener("click", () => addCandidate(false));
element("add-advanced").addEventListener("click", () => addCandidate(true));

for (const tabName of ["basic", "advanced"]) element(`tab-${tabName}`).addEventListener("click", () => {
  for (const name of ["basic", "advanced"]) {
    element(`tab-${name}`).setAttribute("aria-selected", String(name === tabName));
    element(`${name}-panel`).hidden = name !== tabName;
  }
});

element("open").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL(candidate?.canAdd ? "index.html#coches" : "index.html#nuevo") });
});

await inspectCurrentTab();
