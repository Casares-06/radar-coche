import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { candidateFromCapture } from "../candidate.mjs";
import { readCurrentPage } from "../extension-src/capture.mjs";
import { matchingProfiles } from "../advanced.mjs";

test("el popup aparece como acción sin panel lateral ni permisos permanentes", () => {
  const manifest = JSON.parse(readFileSync(new URL("../extension-src/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
  assert.equal(manifest.side_panel, undefined);
});

test("lee datos visibles y estructurados de la pestaña activa", () => {
  const schema = {
    "@type": "Vehicle", brand: { name: "Seat" }, model: "León", vehicleModelDate: "2020",
    mileageFromOdometer: { value: 85000 }, vehicleTransmission: "Manual",
    vehicleSeatingCapacity: 5, offers: { price: 15900 },
  };
  const capture = runInNewContext(`(${readCurrentPage.toString()})()`, {
    location: { href: "https://coches.example/anuncio/4" },
    window: { getSelection: () => "" },
    document: {
      title: "Seat León en venta", body: { innerText: "Cambio manual · 5 plazas · 85.000 km" },
      querySelector: selector => selector === "h1" ? { innerText: "Seat León 1.5 TSI" } : null,
      querySelectorAll: () => [{ textContent: JSON.stringify(schema) }],
    },
  });
  const candidate = candidateFromCapture(capture);
  assert.equal(candidate.canAdd, true);
  assert.equal(candidate.fields.make, "Seat");
  assert.equal(candidate.fields.km, 85000);
  assert.equal(candidate.fields.gearbox, "Manual");
  assert.equal(candidate.fields.seats, 5);
  assert.equal(matchingProfiles(candidate.fields)[0]?.id, "leon-iii");
});

test("detecta cambio y plazas en texto visible aunque falten metadatos", () => {
  const candidate = candidateFromCapture({
    url: "https://coches.example/seat-leon", heading: "Seat León 1.5 TSI",
    pageText: "Cambio: Manual\nPlazas: 5\nAño: 2019\nKilómetros: 89.000 km\nPrecio al contado: 15.900 €",
  });
  assert.equal(candidate.canAdd, true);
  assert.equal(candidate.fields.gearbox, "Manual");
  assert.equal(candidate.fields.seats, 5);
  assert.equal(candidate.fields.km, 89000);
});

test("una página genérica con precio no activa añadir", () => {
  const candidate = candidateFromCapture({ url: "https://example.com/tienda", heading: "Camiseta", pageText: "Precio 20 €" });
  assert.equal(candidate.canAdd, false);
});

test("un precio financiado no se confunde con precio al contado", () => {
  const candidate = candidateFromCapture({
    url: "https://coches.example/seat-leon", heading: "Seat León 1.5 TSI",
    pageText: "Cambio manual · 5 plazas · 89.000 km · Precio financiado: 14.900 €",
    structured: { price: 14900 },
  });
  assert.equal(candidate.fields.priceFinanced, 14900);
  assert.equal(candidate.fields.priceCash, undefined);
});
