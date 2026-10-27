import { candidateFromCapture } from "./candidate.mjs";
import { readCurrentPage } from "./capture.mjs";

const BLOCKED_HOSTS = ["wallapop.com", "milanuncios.com"];
const labels = {
  make: "Marca", model: "Modelo", year: "Año", km: "Kilómetros", priceCash: "Contado",
  priceFinanced: "Financiado", fuel: "Combustible", gearbox: "Cambio", seats: "Plazas",
  environmentLabel: "Etiqueta", location: "Localidad",
};
let candidate = null;

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
  } catch (error) {
    status("No se puede capturar", "error");
    element("page-title").textContent = "Añade el anuncio a mano";
    element("message").textContent = error.message || "No se pudo leer esta página.";
    element("open").textContent = "Abrir Radar Coche";
  }
}

element("add").addEventListener("click", async () => {
  if (!candidate?.canAdd) return;
  element("add").disabled = true;
  status("Preparando la ficha…");
  try {
    await chrome.storage.local.set({ pendingCapture: {
      fields: candidate.fields,
      origins: candidate.origins,
      url: candidate.url,
      sourceText: candidate.sourceText,
    } });
    await chrome.tabs.create({ url: chrome.runtime.getURL("index.html#nuevo") });
    window.close();
  } catch (error) {
    status("No se pudo abrir la ficha", "error");
    element("message").textContent = error.message || "Prueba de nuevo o añade el anuncio a mano.";
    element("add").disabled = false;
  }
});

element("open").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL(candidate?.canAdd ? "index.html#coches" : "index.html#nuevo") });
});

await inspectCurrentTab();
