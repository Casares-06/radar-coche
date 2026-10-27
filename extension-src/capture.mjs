// Esta función se serializa y ejecuta en la pestaña elegida por el usuario.
// Mantén sus ayudas dentro de la función: executeScript no conserva cierres externos.
export function readCurrentPage() {
  const meta = key => document.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.content || "";
  const records = [];
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 4 || records.length > 100) return;
    if (Array.isArray(value)) return value.forEach(item => visit(item, depth + 1));
    records.push(value);
    for (const key of ["@graph", "mainEntity", "itemOffered", "itemListElement"]) {
      if (value[key]) visit(value[key], depth + 1);
    }
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(script.textContent)); }
    catch { /* Los metadatos inválidos no impiden leer el texto visible. */ }
  }
  const types = value => (Array.isArray(value?.["@type"]) ? value["@type"] : [value?.["@type"]])
    .filter(Boolean).map(type => String(type).toLowerCase());
  const hasVehicleType = value => types(value).some(type => /(?:vehicle|car|automobile)$/.test(type));
  const product = records.find(hasVehicleType) || records.find(value => types(value).some(type => /product$/.test(type))) || {};
  const offer = (Array.isArray(product.offers) ? product.offers[0] : product.offers)
    || records.find(value => types(value).some(type => /offer$/.test(type))) || {};
  const brand = typeof product.brand === "object" ? product.brand?.name : product.brand;
  const numberValue = value => value && typeof value === "object" ? value.value ?? value.amount : value;
  const address = product.seller?.address || offer.seller?.address || product.location?.address || {};
  const primary = document.querySelector("[itemtype*='Vehicle'], [itemtype*='Car'], main, article") || document.body;
  return {
    url: location.href,
    title: String(document.title || "").slice(0, 250),
    heading: String(document.querySelector("h1")?.innerText || "").slice(0, 250),
    description: String(product.description || meta("description") || meta("og:description") || "").slice(0, 3000),
    selectedText: String(window.getSelection?.() || "").slice(0, 8000),
    pageText: String(primary?.innerText || "").slice(0, 20000),
    hasVehicleSchema: records.some(hasVehicleType),
    structured: {
      make: brand || "",
      model: product.model || "",
      version: product.name || "",
      year: product.vehicleModelDate || product.productionDate || product.dateVehicleFirstRegistered || "",
      km: numberValue(product.mileageFromOdometer || product.mileage) || "",
      fuel: product.fuelType || product.vehicleEngine?.fuelType || "",
      gearbox: product.vehicleTransmission || product.transmission || "",
      seats: numberValue(product.vehicleSeatingCapacity || product.seatingCapacity || product.numberOfSeats) || "",
      price: numberValue(offer.price || meta("product:price:amount")) || "",
      location: address.addressLocality || "",
      description: product.description || "",
    },
  };
}
