import {
  FUELS, GEARBOXES, LABELS, STATUSES, EVIDENCE, DEFAULT_PROFILE,
  activeQuestions, carName, demoCars, euro, evaluate, kmText,
  normalizeUrl, parseListingText, validateCar,
} from "./core.mjs";
import { checkState, inExtension, loadState, saveState, takePendingCapture } from "./storage.mjs";

const view = document.querySelector("#view");
const toast = document.querySelector("#toast");
let state = await loadState();
let draft = null;
let selectedIds = new Set();
let filterText = "";
let filterStatus = "";
let toastTimer;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const num = value => value == null ? "—" : new Intl.NumberFormat("es-ES").format(value);
const niceDate = value => value ? new Date(value).toLocaleDateString("es-ES") : "—";
const route = () => decodeURIComponent(location.hash.slice(1) || "inicio");
const carById = id => state.cars.find(car => car.id === id);
const numberFrom = value => value === "" || value == null ? null : Number(value);
const id = () => globalThis.crypto?.randomUUID?.() || `car-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const scoreText = result => result.score == null ? "—" : `${result.score}/100`;

function notify(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3800);
}
async function persist() {
  try { state = await saveState(state); updateChrome(); }
  catch (error) { notify("No se pudieron guardar los datos. Exporta una copia.", true); throw error; }
}
function updateChrome() {
  document.querySelector("#profile-name").textContent = state.profile.name || "Mi búsqueda";
  document.querySelector("#nav-count").textContent = state.cars.length;
  const current = route().split("/")[0];
  document.querySelectorAll("[data-route]").forEach(link => {
    if (link.dataset.route === current || (["nuevo", "editar", "coche"].includes(current) && link.dataset.route === "coches")) {
      link.setAttribute("aria-current", "page");
    } else link.removeAttribute("aria-current");
  });
}
function head(title, subtitle = "", actions = "") {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>${actions ? `<div class="head-actions">${actions}</div>` : ""}</header>`;
}
function button(href, label, primary = false) {
  return `<a class="btn ${primary ? "btn-primary" : ""}" href="${esc(href)}">${esc(label)}</a>`;
}
function selectOptions(values, current, blank = "No indicado") {
  return `<option value="">${esc(blank)}</option>${values.map(value =>
    `<option value="${esc(value)}" ${current === value ? "selected" : ""}>${esc(value)}</option>`).join("")}`;
}
function field(name, label, value = "", type = "text", extra = "", origin = "") {
  const originLabel = origin ? ` <em class="field-origin">· ${esc(origin === "anuncio" ? "Leído del anuncio; revisa" : origin)}</em>` : "";
  return `<div class="field"><label for="${name}">${esc(label)}${originLabel}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value ?? "")}" ${extra}></div>`;
}

function renderOverview() {
  const assessments = state.cars.map(car => ({ car, result: evaluate(car, state.profile) }));
  const viable = assessments.filter(({ car, result }) => !result.fails.length && !result.negative.length && car.status !== "Descartado")
    .sort((a, b) => (b.result.score ?? -1) - (a.result.score ?? -1));
  const waiting = assessments.filter(({ result }) => result.verified < result.questionCount);
  const chosen = viable[0];
  const next = chosen ? activeQuestions(chosen.car).filter(q => !chosen.car.answers?.[q.key] || chosen.car.answers[q.key].status === "Pendiente").slice(0, 3) : [];
  const stats = [
    ["Guardados", state.cars.length],
    ["Sin alertas conocidas", viable.length],
    ["Finalistas", state.cars.filter(car => car.status === "Finalista").length],
    ["Con pruebas pendientes", waiting.length],
  ];
  const rows = viable.slice(0, 4).map(({ car, result }) => `
    <div class="decision-row">
      <div class="identity"><h3><a class="row-link" href="#coche/${encodeURIComponent(car.id)}">${esc(carName(car))}</a></h3>
        <div class="subline">${esc(car.year || "Año pendiente")} · ${esc(kmText(car.km))} · ${esc(car.location || "Ubicación pendiente")}${car.demo ? " · Ejemplo ficticio" : ""}</div></div>
      <div class="value"><strong>${esc(euro(car.priceCash))}</strong><small>Contado</small></div>
      <div class="value"><strong class="score-value">${esc(scoreText(result))}</strong><small>Encaje</small></div>
      <div class="value"><strong>${result.verified}/${result.questionCount}</strong><small>Verificadas</small></div>
    </div>`).join("");
  return head("Tu selección", `Perfil: ${state.profile.name} · Las notas miden encaje con tus límites, no estado mecánico.`,
    button("#nuevo", "Añadir coche", true)) +
    `<section class="stats" aria-label="Resumen">${stats.map(([label, value], index) =>
      `<div class="stat"><span class="stat-label">${esc(label)}</span><strong class="${index === 1 ? "accent" : ""}">${value}</strong></div>`).join("")}</section>
    <div class="overview-grid">
      <section><div class="section-head"><h2>Primero, los que merecen revisión</h2><a class="btn btn-link btn-small" href="#coches">Ver todos</a></div>
        <div class="panel">${rows || `<div class="empty"><h3>Empieza con un anuncio</h3><p>Guarda un coche que estés valorando. Puedes introducir los datos a mano o pegar el texto del anuncio.</p>${button("#nuevo", "Añadir mi primer coche", true)} <button class="btn" data-action="demo">Cargar dos ejemplos ficticios</button></div>`}</div></section>
      <section><div class="section-head"><h2>Próxima comprobación</h2></div>
        <div class="panel">${chosen ? `<strong>${esc(carName(chosen.car))}</strong><p class="panel-sub">Pide pruebas antes de confiar en el anuncio.</p>
          <ul class="next-list">${next.map(q => `<li class="signal"><b aria-hidden="true"></b><span>${esc(q.text)}</span></li>`).join("") || "<li>Todas las preguntas tienen una respuesta registrada.</li>"}</ul>
          <a class="btn btn-link" href="#coche/${encodeURIComponent(chosen.car.id)}">Abrir ficha →</a>` :
          `<p class="panel-sub">Empieza por tus límites. Después guarda un anuncio y verás aquí qué conviene comprobar.</p>
          <ul class="next-list"><li>1. Define precio, año y kilómetros.</li><li>2. Añade un anuncio o prueba un ejemplo ficticio.</li><li>3. Pide pruebas antes de decidir.</li></ul>
          <a class="btn btn-link" href="#perfil">Definir mi búsqueda →</a>`}</div></section>
    </div>`;
}

function filteredCars() {
  return state.cars.filter(car => {
    const haystack = [carName(car), car.location, car.fuel, car.status].join(" ").toLocaleLowerCase("es-ES");
    return (!filterText || haystack.includes(filterText.toLocaleLowerCase("es-ES"))) && (!filterStatus || car.status === filterStatus);
  });
}
function listBody() {
  const cars = filteredCars().sort((a, b) => {
    const ar = evaluate(a, state.profile), br = evaluate(b, state.profile);
    return (br.score ?? -1) - (ar.score ?? -1);
  });
  if (!cars.length) return `<div class="empty compact"><h3>${state.cars.length ? "No hay coches con estos filtros" : "Aún no has guardado coches"}</h3>
    <p>${state.cars.length ? "Prueba otra búsqueda o estado." : "Añade un anuncio con los datos que conozcas; podrás completarlo después."}</p>
    ${state.cars.length ? "" : button("#nuevo", "Añadir coche", true)}</div>`;
  return `<div class="table-wrap desktop-list"><table class="car-table"><thead><tr><th>Coche</th><th class="num">Contado</th><th class="num">Año</th><th class="num">Km</th><th>Estado</th><th class="num">Encaje</th><th class="num">Verificadas</th></tr></thead>
    <tbody>${cars.map(car => { const r = evaluate(car, state.profile); return `<tr>
      <td><a class="row-link" href="#coche/${encodeURIComponent(car.id)}">${esc(carName(car))}</a><small>${esc(car.location || "Ubicación pendiente")}${car.demo ? " · Ejemplo ficticio" : ""}</small></td>
      <td class="num">${esc(euro(car.priceCash))}</td><td class="num">${esc(car.year ?? "—")}</td><td class="num">${esc(car.km == null ? "—" : num(car.km))}</td>
      <td><span class="status ${r.fails.length ? "negative" : ""}">${esc(r.fails.length ? "Fuera de límites" : car.status || "Por revisar")}</span></td>
      <td class="num">${esc(scoreText(r))}</td><td class="num">${r.verified}/${r.questionCount}</td></tr>`; }).join("")}</tbody></table></div>
    <div class="panel car-list-mobile">${cars.map(car => { const r = evaluate(car, state.profile); return `<div class="car-mobile">
      <div class="car-mobile-top"><a href="#coche/${encodeURIComponent(car.id)}">${esc(carName(car))}</a><span class="car-mobile-price">${esc(euro(car.priceCash))}</span></div>
      <div class="subline">${esc(car.year ?? "Año pendiente")} · ${esc(kmText(car.km))} · Encaje ${esc(scoreText(r))} · ${r.verified}/${r.questionCount} verificadas</div></div>`; }).join("")}</div>`;
}
function renderCars() {
  return head("Mis coches", `${state.cars.length} anuncios guardados en este navegador.`, button("#nuevo", "Añadir coche", true)) +
    `<div class="filters"><div class="field search"><label for="filter-search">Buscar en mis coches</label><input id="filter-search" type="search" placeholder="Marca, modelo, lugar…" value="${esc(filterText)}"></div>
      <div class="field"><label for="filter-status">Estado</label><select id="filter-status">${selectOptions(STATUSES, filterStatus, "Todos")}</select></div></div>
    <div id="car-results">${listBody()}</div>`;
}

function readForm(form) {
  const f = new FormData(form);
  const editId = route().startsWith("editar/") ? route().split("/")[1] : "";
  const base = editId ? (draft?.id === editId ? draft : {}) : (draft?.id ? {} : draft || {});
  return {
    ...base,
    url: String(f.get("url") || "").trim(),
    make: String(f.get("make") || "").trim(),
    model: String(f.get("model") || "").trim(),
    version: String(f.get("version") || "").trim(),
    priceCash: numberFrom(f.get("priceCash")),
    priceFinanced: numberFrom(f.get("priceFinanced")),
    year: numberFrom(f.get("year")),
    km: numberFrom(f.get("km")),
    fuel: String(f.get("fuel") || ""),
    gearbox: String(f.get("gearbox") || ""),
    environmentLabel: String(f.get("environmentLabel") || ""),
    seats: numberFrom(f.get("seats")),
    location: String(f.get("location") || "").trim(),
    distanceKm: numberFrom(f.get("distanceKm")),
    sellerType: String(f.get("sellerType") || ""),
    notes: String(f.get("notes") || "").trim(),
    sourceText: String(f.get("sourceText") || "").trim().slice(0, 8000),
  };
}
function renderForm(editId = "") {
  const old = editId ? (draft?.id === editId ? draft : carById(editId)) : (draft?.id ? {} : draft || {});
  if (editId && !old) return missingCar();
  const car = { status: "Por revisar", origins: {}, ...old };
  const origins = car.origins || {};
  const title = editId ? "Editar coche" : "Añadir coche";
  return head(title, "Revisa los campos antes de guardarlos. Lo leído de una página todavía no está verificado.",
    button(editId ? `#coche/${encodeURIComponent(editId)}` : "#coches", "Volver")) +
    `<form id="car-form" class="panel" novalidate>
      ${car.captureWarning ? `<div class="notice" style="margin-bottom:18px">${esc(car.captureWarning)}</div>` : ""}
      <div class="field" style="margin-bottom:18px"><label for="sourceText">Texto del anuncio (opcional)</label>
        <textarea id="sourceText" name="sourceText" placeholder="Pega aquí la descripción. Detectaremos algunas pistas y podrás corregirlas.">${esc(car.sourceText || "")}</textarea>
        <small>La detección es orientativa: un precio financiado puede confundirse con el de contado.</small>
        <button class="btn btn-small" type="button" data-action="parse-text" style="justify-self:start">Sugerir datos del texto</button></div>
      <div class="form-grid">
        ${field("url", "Enlace del anuncio", car.url, "url", 'placeholder="https://…" ', origins.url)}
        ${field("location", "Localidad", car.location, "text", 'placeholder="Pamplona"', origins.location)}
        ${field("make", "Marca *", car.make, "text", 'required autocomplete="off"', origins.make)}
        ${field("model", "Modelo *", car.model, "text", 'required autocomplete="off"', origins.model)}
        ${field("version", "Versión o motor", car.version, "text", "", origins.version)}
        ${field("year", "Año", car.year, "number", 'min="1980" max="2100"', origins.year)}
        ${field("priceCash", "Precio al contado (€)", car.priceCash, "number", 'min="0" max="1000000"', origins.priceCash)}
        ${field("priceFinanced", "Precio financiado (€)", car.priceFinanced, "number", 'min="0" max="1000000"', origins.priceFinanced)}
        ${field("km", "Kilómetros", car.km, "number", 'min="0" max="2000000"', origins.km)}
        ${field("distanceKm", "Distancia desde ti (km)", car.distanceKm, "number", 'min="0"', origins.distanceKm)}
        <div class="field"><label for="fuel">Combustible</label><select id="fuel" name="fuel">${selectOptions(FUELS, car.fuel)}</select></div>
        <div class="field"><label for="gearbox">Cambio</label><select id="gearbox" name="gearbox">${selectOptions(GEARBOXES, car.gearbox)}</select></div>
        <div class="field"><label for="environmentLabel">Etiqueta ambiental</label><select id="environmentLabel" name="environmentLabel">${selectOptions(LABELS, car.environmentLabel)}</select></div>
        ${field("seats", "Plazas", car.seats, "number", 'min="1" max="20"')}
        <div class="field"><label for="sellerType">Vendedor</label><select id="sellerType" name="sellerType">${selectOptions(["Particular", "Profesional"], car.sellerType)}</select></div>
        <div class="field wide"><label for="notes">Notas personales</label><textarea id="notes" name="notes" placeholder="Qué te interesa confirmar, condiciones, impresión inicial…">${esc(car.notes || "")}</textarea></div>
      </div>
      <div class="form-actions"><a class="btn" href="${editId ? `#coche/${encodeURIComponent(editId)}` : "#coches"}">Cancelar</a><button class="btn btn-primary" type="submit">Guardar coche</button></div>
    </form>`;
}

function riskList(car, result) {
  const items = [];
  if (result.fails.length) items.push(...result.fails.map(x => `No cumple: ${x}.`));
  if (result.negative.length) items.push(...result.negative.map(x => `Comprobación negativa: ${x}`));
  if (result.missing.length) items.push(`Faltan datos para ${result.missing.join(", ").toLocaleLowerCase("es-ES")}.`);
  if (car.priceFinanced != null) items.push("El precio financiado puede exigir intereses, comisiones o permanencia. Pide el total pagado.");
  if (result.verified === 0) items.push("Ninguna pregunta está respaldada por una comprobación registrada.");
  if (!items.length) items.push("No hay alertas por los datos anotados. Una revisión independiente sigue siendo necesaria.");
  return items;
}
function missingCar() {
  return head("No encuentro este coche", "Puede haberse eliminado o el enlace ya no es válido.", button("#coches", "Volver a mis coches"));
}
function renderDetail(carId) {
  const car = carById(carId);
  if (!car) return missingCar();
  const result = evaluate(car, state.profile);
  const qs = activeQuestions(car);
  const facts = [
    ["Año", car.year], ["Kilómetros", kmText(car.km)], ["Combustible", car.fuel || "—"],
    ["Cambio", car.gearbox || "—"], ["Etiqueta", car.environmentLabel || "—"], ["Plazas", car.seats ?? "—"],
    ["Ubicación", car.location || "—"], ["Distancia", car.distanceKm == null ? "—" : `${car.distanceKm} km`], ["Vendedor", car.sellerType || "—"],
  ];
  return head(carName(car), `${car.demo ? "Ejemplo ficticio · " : ""}Guardado el ${niceDate(car.createdAt)} · Datos del anuncio sin verificar.`,
    `${button("#coches", "Volver")}${button(`#editar/${encodeURIComponent(car.id)}`, "Editar datos")}`) +
    `<div class="detail-layout"><div class="detail-main">
      <div class="detail-kpis"><div><span>Encaje con tu búsqueda</span><strong class="score-value">${esc(scoreText(result))}</strong></div>
        <div><span>Comprobadas</span><strong>${result.verified}/${result.questionCount}</strong></div>
        <div><span>Precio al contado</span><strong>${esc(euro(car.priceCash))}</strong></div></div>
      ${result.fails.length ? `<div class="notice error">Este coche incumple ${result.fails.length} requisito(s) de tu perfil. Revisa el desglose antes de compararlo.</div>` : ""}
      <section class="panel"><div class="section-head" style="margin:0 0 10px"><h2>Datos del anuncio</h2></div>
        <div class="facts">${facts.map(([label, value]) => `<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>
        ${car.priceFinanced != null ? `<p class="fine">Precio financiado anunciado: <strong>${esc(euro(car.priceFinanced))}</strong>. Compara el coste total documentado.</p>` : ""}
        ${car.url && !car.demo ? `<a class="btn btn-link" href="${esc(car.url)}" target="_blank" rel="noopener noreferrer">Abrir anuncio original ↗</a>` : ""}
        ${car.notes ? `<p class="fine">Notas: ${esc(car.notes)}</p>` : ""}</section>
      <section class="panel"><h2>Preguntas al vendedor y pruebas</h2><p class="panel-sub">«Lo afirma el vendedor» no equivale a «Verificado». Solo marca «Verificado» si has visto la prueba.</p>
        <form id="answers-form" data-id="${esc(car.id)}">
        ${qs.map(q => {
          const answer = car.answers?.[q.key] || {};
          return `<div class="question"><div class="question-head"><strong>${esc(q.text)}</strong>
            <select name="status:${esc(q.key)}" aria-label="Estado: ${esc(q.text)}">${EVIDENCE.map(value => `<option ${answer.status === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></div>
            <p>${esc(q.tip)}</p><input name="note:${esc(q.key)}" value="${esc(answer.note || "")}" placeholder="Anota qué prueba has visto o qué falta" aria-label="Nota: ${esc(q.text)}"></div>`;
        }).join("")}
        <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar comprobaciones</button></div></form></section>
    </div><div class="detail-side">
      <section class="panel"><h2>De dónde sale el encaje</h2><p class="panel-sub">Solo usa tus límites y los campos disponibles. Datos suficientes: ${result.dataCoverage}%.</p>
        <div class="breakdown">${result.checks.map(part => `<div class="breakdown-row"><span title="${esc(part.detail)}">${esc(part.label)}</span><div class="bar"><span style="width:${Math.round((part.ratio ?? 0) * 100)}%"></span></div><strong>${part.ratio == null ? "—" : Math.round(part.ratio * 100) + "%"}</strong></div>`).join("")}</div>
        <p class="fine">La nota no evalúa estado mecánico ni precio de mercado. «—» significa que falta el dato.</p></section>
      <section class="panel"><h2>Riesgos y dudas</h2><ul class="risk-list">${riskList(car, result).map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
      <section class="panel"><h2>Seguimiento</h2><p class="panel-sub">Actualiza tu decisión al hablar con el vendedor o visitar el coche.</p>
        <div class="field" style="margin-top:16px"><label for="car-status">Estado</label><select id="car-status" data-id="${esc(car.id)}">${STATUSES.map(value => `<option ${car.status === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></div>
        <div class="data-actions"><button class="btn btn-small" data-action="dossier" data-id="${esc(car.id)}">Descargar ficha</button><button class="btn btn-small btn-danger" data-action="delete-car" data-id="${esc(car.id)}">Eliminar</button></div></section>
    </div></div>`;
}

function renderCompare() {
  const chosen = [...selectedIds].map(carById).filter(Boolean).slice(0, 4);
  const fields = [
    ["Encaje", car => scoreText(evaluate(car, state.profile))],
    ["Requisitos incumplidos", car => evaluate(car, state.profile).fails.length],
    ["Comprobadas", car => { const r = evaluate(car, state.profile); return `${r.verified}/${r.questionCount}`; }],
    ["Precio al contado", car => euro(car.priceCash)],
    ["Precio financiado", car => euro(car.priceFinanced)],
    ["Año", car => car.year ?? "—"],
    ["Kilómetros", car => kmText(car.km)],
    ["Combustible", car => car.fuel || "—"],
    ["Cambio", car => car.gearbox || "—"],
    ["Etiqueta", car => car.environmentLabel || "—"],
    ["Localidad", car => car.location || "—"],
    ["Estado", car => car.status || "Por revisar"],
  ];
  return head("Comparar", "Elige de dos a cuatro coches. Las cifras desconocidas quedan sin evaluar.", button("#coches", "Ver mis coches")) +
    (state.cars.length < 2 ? `<div class="empty"><h2>Guarda al menos dos coches</h2><p>La comparación mostrará precio, encaje, requisitos y pruebas en una sola tabla.</p>${button("#nuevo", "Añadir coche", true)}</div>` :
    `<div class="compare-choice" aria-label="Coches para comparar">${state.cars.map(car =>
      `<label class="choice"><input type="checkbox" class="compare-check" value="${esc(car.id)}" ${selectedIds.has(car.id) ? "checked" : ""}><span>${esc(carName(car))}</span></label>`).join("")}</div>
    ${chosen.length < 2 ? `<div class="notice">Selecciona dos o más coches para ver la comparación.</div>` :
    `<div class="table-wrap"><table class="compare-table"><thead><tr><th>Dato</th>${chosen.map(car => `<th><a class="row-link" href="#coche/${encodeURIComponent(car.id)}">${esc(carName(car))}</a></th>`).join("")}</tr></thead>
      <tbody>${fields.map(([label, value]) => `<tr><td>${esc(label)}</td>${chosen.map(car => `<td>${esc(value(car))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="fine">La comparación procede de tus fichas. No es una tasación del mercado ni una inspección mecánica.</p>`}`);
}

function renderProfile() {
  const p = { ...DEFAULT_PROFILE, ...state.profile };
  return head("Mi búsqueda", "Ajusta los límites que importan. Los coches ya guardados se reevalúan al guardar.") +
    `<form id="profile-form">
      <div class="settings-row"><div class="settings-copy"><h2>Qué estás buscando</h2><p>Un nombre y una zona para reconocer tu búsqueda. Las marcas se separan con comas.</p></div>
        <div class="settings-panel"><div class="form-grid">
          ${field("name", "Nombre del perfil", p.name)}
          ${field("province", "Provincia o zona", p.province)}
          ${field("brands", "Marcas aceptadas (opcional)", p.brands, "text", 'placeholder="Seat, Toyota, Volkswagen"')}
        </div></div></div>
      <div class="settings-row"><div class="settings-copy"><h2>Límites</h2><p>Deja un campo en cero si no quieres aplicar ese límite. Un dato que falte en el anuncio quedará pendiente.</p></div>
        <div class="settings-panel"><div class="form-grid">
          ${field("maxPrice", "Presupuesto máximo al contado (€)", p.maxPrice, "number", 'min="0"')}
          ${field("maxDistanceKm", "Distancia máxima (km)", p.maxDistanceKm, "number", 'min="0"')}
          ${field("minYear", "Año mínimo", p.minYear, "number", 'min="0" max="2100"')}
          ${field("maxKm", "Kilómetros máximos", p.maxKm, "number", 'min="0"')}
          ${field("minSeats", "Plazas mínimas", p.minSeats, "number", 'min="0" max="20"')}
          <div class="field"><label for="minLabel">Etiqueta ambiental mínima</label><select id="minLabel" name="minLabel">${selectOptions(LABELS, p.minLabel, "Sin requisito")}</select></div>
        </div></div></div>
      <div class="settings-row"><div class="settings-copy"><h2>Preferencias</h2><p>Estas opciones afectan al encaje. Úsalas solo si de verdad descartarías los demás tipos.</p></div>
        <div class="settings-panel"><div class="field"><span>Combustibles aceptados</span><div class="checkbox-set">${FUELS.map(x => `<label><input type="checkbox" name="fuels" value="${esc(x)}" ${p.fuels.includes(x) ? "checked" : ""}>${esc(x)}</label>`).join("")}</div></div>
          <div class="field" style="margin-top:18px"><span>Cambios aceptados</span><div class="checkbox-set">${GEARBOXES.map(x => `<label><input type="checkbox" name="gearboxes" value="${esc(x)}" ${p.gearboxes.includes(x) ? "checked" : ""}>${esc(x)}</label>`).join("")}</div></div>
          ${field("annualKm", "Kilómetros al año (para tus notas)", p.annualKm, "number", 'min="0"')}</div></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar mi búsqueda</button></div>
    </form>`;
}

function renderData() {
  return head("Datos y ayuda", "Tus fichas permanecen en este navegador. Descarga copias antes de cambiar de equipo o desinstalar la extensión.") +
    `<div class="helper-grid">
      <div class="panel"><strong>1. Define límites</strong><p>Precio al contado, año y kilometraje permiten comparar sin mezclar necesidades con suposiciones.</p></div>
      <div class="panel"><strong>2. Guarda candidatos</strong><p>Pega el texto o utiliza la extensión en una página compatible. Revisa siempre lo detectado.</p></div>
      <div class="panel"><strong>3. Pide pruebas</strong><p>La nota de encaje no describe el estado mecánico. Marca cada respuesta según su evidencia.</p></div>
    </div>
    <div class="settings-row"><div class="settings-copy"><h2>Copias de seguridad</h2><p>El archivo JSON incluye perfil, coches, notas y comprobaciones. La importación sustituye los datos actuales tras confirmación.</p></div>
      <div class="settings-panel"><p>Guardados: <strong>${state.cars.length}</strong> · Último cambio: <strong>${esc(niceDate(state.updatedAt))}</strong></p>
        <div class="data-actions"><button class="btn btn-primary" data-action="export">Descargar copia JSON</button>
          <label class="btn" for="backup-file">Importar copia JSON</label><input id="backup-file" type="file" accept=".json,application/json" hidden></div>
        <p class="fine">La web y la extensión guardan datos por separado. Puedes moverlos con este archivo.</p></div></div>
    <div class="settings-row"><div class="settings-copy"><h2>Probar sin anuncios reales</h2><p>Los ejemplos están marcados como ficticios y no representan ofertas del mercado.</p></div>
      <div class="settings-panel"><button class="btn" data-action="demo">Cargar dos ejemplos ficticios</button></div></div>
    <div class="settings-row"><div class="settings-copy"><h2>Extensión de Chrome</h2><p>Captura el anuncio abierto al pulsar el icono. Revisa los campos antes de guardarlos.</p></div>
      <div class="settings-panel">${inExtension ?
        `<p>Ya estás usando la extensión. Pulsa su icono mientras ves un anuncio compatible para abrir esta ficha con los datos detectados.</p>` :
        `<p>Descarga el ZIP, descomprímelo y entra en <code>chrome://extensions</code>. Activa «Modo desarrollador», pulsa «Cargar descomprimida» y selecciona la carpeta extraída.</p><a class="btn" href="./radar-coche-extension.zip" download>Descargar extensión ZIP</a>`}
        <p class="fine">La captura automática está desactivada en Wallapop y Milanuncios. La extensión y la web guardan datos por separado; utiliza la copia JSON para moverlos.</p></div></div>
    <div class="settings-row"><div class="settings-copy"><h2>Alcance y privacidad</h2><p>Esta versión funciona sin cuenta, servidor de datos, anuncios propios ni API de IA.</p></div>
      <div class="settings-panel"><p>Solo se guarda información que introduces o confirmas en tu navegador. No enviamos tus fichas a Radar Coche. La versión web no puede leer otras pestañas. La extensión solicita acceso temporal cuando la pulsas y no realiza búsquedas masivas.</p>
        <p class="fine">La extracción puede fallar; los campos vacíos no significan que un coche carezca de esa característica. No guardes documentos personales ni teléfonos del vendedor en las notas.</p>
        <p class="fine">Versión pública de prueba · Reglas de encaje 1.0 · ${inExtension ? "Extensión Chrome" : "Web estática"}</p></div></div>`;
}

function render() {
  const [name, arg] = route().split("/");
  updateChrome();
  const pages = {
    inicio: renderOverview,
    coches: renderCars,
    nuevo: () => renderForm(),
    editar: () => renderForm(arg),
    coche: () => renderDetail(arg),
    comparar: renderCompare,
    perfil: renderProfile,
    datos: renderData,
  };
  view.innerHTML = (pages[name] || renderOverview)();
  document.title = `${({ inicio: "Tu selección", coches: "Mis coches", nuevo: "Añadir coche", editar: "Editar coche", coche: "Ficha del coche", comparar: "Comparar", perfil: "Mi búsqueda", datos: "Datos y ayuda" })[name] || "Radar Coche"} · Radar Coche`;
  document.querySelector("#sidebar").classList.remove("open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
  document.querySelector("#menu-toggle").setAttribute("aria-label", "Abrir menú");
  document.querySelector("#menu-toggle").textContent = "Menú";
  window.scrollTo({ top: 0 });
}

function download(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dossier(car) {
  const r = evaluate(car, state.profile);
  return `# ${carName(car)}

Generado: ${new Date().toLocaleDateString("es-ES")}
Anuncio: ${car.url || "Sin URL"}

## Datos
- Precio al contado: ${euro(car.priceCash)}
- Precio financiado: ${euro(car.priceFinanced)}
- Año: ${car.year ?? "Pendiente"}
- Kilómetros: ${kmText(car.km)}
- Combustible / cambio: ${car.fuel || "Pendiente"} / ${car.gearbox || "Pendiente"}

## Evaluación
- Encaje con mi búsqueda: ${scoreText(r)} (${r.dataCoverage}% de datos evaluables)
- Comprobadas: ${r.verified}/${r.questionCount}
- Requisitos incumplidos: ${r.fails.join("; ") || "Ninguno con los datos disponibles"}
- Campos pendientes: ${r.missing.join("; ") || "Ninguno"}
- No es una inspección mecánica ni una tasación.

## Preguntas
${activeQuestions(car).map(q => `- ${q.text} — ${car.answers?.[q.key]?.status || "Pendiente"}. ${car.answers?.[q.key]?.note || ""}`).join("\n")}

## Notas
${car.notes || "Sin notas."}
`;
}

document.addEventListener("click", async event => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "demo") {
    const current = new Set(state.cars.map(car => car.id));
    state.cars.push(...demoCars().filter(car => !current.has(car.id)));
    await persist(); render(); notify("Ejemplos ficticios cargados.");
  }
  if (action === "parse-text") {
    const form = document.querySelector("#car-form");
    draft = readForm(form);
    const editId = route().startsWith("editar/") ? route().split("/")[1] : "";
    if (editId) draft = { ...carById(editId), ...draft, id: editId };
    const suggested = parseListingText(draft.sourceText);
    if (!Object.keys(suggested).length) return notify("No he detectado datos claros. Rellena el formulario manualmente.", true);
    for (const [key, value] of Object.entries(suggested)) {
      if (draft[key] == null || draft[key] === "") {
        draft[key] = value;
        draft.origins = { ...(draft.origins || {}), [key]: "texto pegado; revisa" };
      }
    }
    view.innerHTML = renderForm(editId);
    notify("Datos sugeridos. Comprueba precio y kilómetros antes de guardar.");
  }
  if (action === "export") {
    download(`radar-coche-copia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
    notify("Copia descargada.");
  }
  if (action === "dossier") {
    const car = carById(target.dataset.id);
    if (car) download(`radar-coche-${car.make.toLowerCase().replace(/\W+/g, "-")}.md`, dossier(car), "text/markdown");
  }
  if (action === "delete-car") {
    const car = carById(target.dataset.id);
    if (car && confirm(`¿Eliminar ${carName(car)} de tus coches guardados?`)) {
      state.cars = state.cars.filter(item => item.id !== car.id);
      selectedIds.delete(car.id);
      await persist(); location.hash = "coches"; render(); notify("Coche eliminado.");
    }
  }
});

document.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  if (form.id === "car-form") {
    const editId = route().startsWith("editar/") ? route().split("/")[1] : "";
    const car = readForm(form);
    const errors = validateCar(car);
    if (errors.length) {
      notify(errors.join(" "), true);
      const first = !car.make ? "make" : !car.model ? "model" : errors[0].includes("URL") ? "url" :
        errors[0].includes("año") ? "year" : errors[0].includes("precio") ? "priceCash" : "km";
      form.elements.namedItem(first)?.focus();
      return;
    }
    try { car.url = normalizeUrl(car.url); } catch (error) { return notify(error.message, true); }
    if (car.url && state.cars.some(item => item.url === car.url && item.id !== editId)) {
      return notify("Ese enlace ya está guardado. Abre la ficha existente para editarlo.", true);
    }
    const old = editId ? carById(editId) : null;
    car.id = old?.id || id();
    car.status = old?.status || "Por revisar";
    car.answers = old?.answers || {};
    car.origins = (draft && (!draft.id || draft.id === editId) ? draft.origins : null) || old?.origins || {};
    car.createdAt = old?.createdAt || new Date().toISOString();
    car.updatedAt = new Date().toISOString();
    if (old) state.cars = state.cars.map(item => item.id === old.id ? car : item);
    else state.cars.unshift(car);
    selectedIds = new Set([car.id, ...selectedIds].slice(0, 4));
    await persist(); draft = null; location.hash = `coche/${encodeURIComponent(car.id)}`; render(); notify("Coche guardado.");
  }
  if (form.id === "answers-form") {
    const car = carById(form.dataset.id);
    if (!car) return;
    const data = new FormData(form);
    const answers = { ...(car.answers || {}) };
    for (const question of activeQuestions(car)) {
      answers[question.key] = {
        status: String(data.get(`status:${question.key}`) || "Pendiente"),
        note: String(data.get(`note:${question.key}`) || "").trim().slice(0, 800),
        updatedAt: new Date().toISOString(),
      };
    }
    car.answers = answers; car.updatedAt = new Date().toISOString();
    await persist(); render(); notify("Comprobaciones guardadas.");
  }
  if (form.id === "profile-form") {
    const data = new FormData(form);
    const p = { ...state.profile };
    for (const key of ["name", "province", "brands", "minLabel"]) p[key] = String(data.get(key) || "").trim();
    for (const key of ["maxPrice", "maxDistanceKm", "minYear", "maxKm", "minSeats", "annualKm"]) p[key] = Math.max(0, Number(data.get(key) || 0));
    p.fuels = data.getAll("fuels").map(String);
    p.gearboxes = data.getAll("gearboxes").map(String);
    if (!p.name) return notify("Pon un nombre al perfil.", true);
    state.profile = p;
    await persist(); render(); notify("Búsqueda guardada. Los encajes se han recalculado.");
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "filter-search") {
    filterText = event.target.value;
    const results = document.querySelector("#car-results");
    if (results) results.innerHTML = listBody();
  }
});
document.addEventListener("change", async event => {
  const target = event.target;
  if (target.id === "filter-status") {
    filterStatus = target.value;
    document.querySelector("#car-results").innerHTML = listBody();
  }
  if (target.classList.contains("compare-check")) {
    if (target.checked && selectedIds.size >= 4) { target.checked = false; return notify("Puedes comparar hasta cuatro coches.", true); }
    if (target.checked) selectedIds.add(target.value); else selectedIds.delete(target.value);
    render();
  }
  if (target.id === "car-status") {
    const car = carById(target.dataset.id);
    if (car) { car.status = target.value; car.updatedAt = new Date().toISOString(); await persist(); notify("Estado actualizado."); }
  }
  if (target.id === "backup-file" && target.files?.[0]) {
    try {
      const file = target.files[0];
      if (file.size > 4_000_000) throw new Error("La copia supera 4 MB.");
      const imported = checkState(JSON.parse(await file.text()));
      if (!confirm(`La copia contiene ${imported.cars.length} coches. ¿Sustituir tus datos actuales?`)) return;
      state = imported; selectedIds = new Set(); await persist(); location.hash = "inicio"; render(); notify("Copia importada.");
    } catch (error) { notify(error.message || "No se pudo importar.", true); }
    target.value = "";
  }
});
document.querySelector("#menu-toggle").addEventListener("click", () => {
  const menu = document.querySelector("#sidebar");
  const open = menu.classList.toggle("open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded", String(open));
  document.querySelector("#menu-toggle").setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  document.querySelector("#menu-toggle").textContent = open ? "Cerrar" : "Menú";
});
window.addEventListener("hashchange", render);

const capture = await takePendingCapture();
if (capture) {
  if (capture.error) notify(capture.error, true);
  else {
    draft = {
      ...capture.fields,
      url: capture.url || "",
      sourceText: capture.selectedText || "",
      origins: capture.origins || {},
      captureWarning: "La extensión ha leído datos visibles o metadatos. Confirma cada campo: el anuncio puede estar incompleto o mostrar un precio condicionado.",
    };
    const suggested = parseListingText(capture.selectedText || "");
    for (const [key, value] of Object.entries(suggested)) {
      if (draft[key] == null || draft[key] === "") {
        draft[key] = value; draft.origins[key] = "texto seleccionado; revisa";
      }
    }
    location.hash = "nuevo";
  }
}
if (!selectedIds.size) selectedIds = new Set(state.cars.slice(0, 2).map(car => car.id));
render();
