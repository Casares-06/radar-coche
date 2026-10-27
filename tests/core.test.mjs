import test from "node:test";
import assert from "node:assert/strict";
import { activeQuestions, DEFAULT_PROFILE, evaluate, normalizeUrl, parseListingText } from "../core.mjs";
import { checkState } from "../storage.mjs";

test("el texto propone campos sin dar por verificada la información", () => {
  const parsed = parseListingText("Toyota 2020 · 62.000 km · híbrido automático · 17.500 €");
  assert.deepEqual(parsed, { priceCash: 17500, km: 62000, year: 2020, fuel: "Híbrido", gearbox: "Automático" });
});

test("reconoce cambio manual, plazas y precios condicionados", () => {
  const parsed = parseListingText("Cambio: Manual\nPlazas: 5\nEtiqueta ambiental: C\nPrecio financiado 14.900 €\nPrecio al contado 16.900 €");
  assert.equal(parsed.gearbox, "Manual");
  assert.equal(parsed.seats, 5);
  assert.equal(parsed.environmentLabel, "C");
  assert.equal(parsed.priceCash, 16900);
  assert.equal(parsed.priceFinanced, 14900);
  assert.equal(parseListingText("Precio financiado 14.900 €").priceCash, undefined);
});

test("la nota mide encaje y separa incumplimientos de pruebas negativas", () => {
  const car = {
    make: "Toyota", model: "Corolla", priceCash: 17000, year: 2020, km: 60000,
    fuel: "Híbrido", gearbox: "Automático", answers: { dgt: { status: "No cumple" } },
  };
  const result = evaluate(car, DEFAULT_PROFILE);
  assert.ok(result.score > 0 && result.score <= 100);
  assert.deepEqual(result.fails, []);
  assert.equal(result.negative.length, 1);
  assert.ok(activeQuestions(car).some(q => q.key === "automatic"));
  car.priceCash = 20000;
  assert.ok(evaluate(car, DEFAULT_PROFILE).fails.includes("Precio al contado"));
});

test("la importación elimina datos inválidos y enlaces peligrosos", () => {
  const state = checkState({
    profile: { name: "Prueba", fuels: "Gasolina", maxPrice: "bad", brands: [] },
    cars: [{ id: "uno", make: "Seat", model: "Ibiza", url: "javascript:alert(1)",
      year: "bad", answers: { dgt: { status: "Verificado", note: "Factura" } } }],
  });
  assert.deepEqual(state.profile.fuels, []);
  assert.equal(state.profile.maxPrice, DEFAULT_PROFILE.maxPrice);
  assert.equal(state.cars[0].url, "");
  assert.equal(state.cars[0].year, null);
  assert.equal(state.cars[0].answers.dgt.status, "Verificado");
});

test("los enlaces conservan el anuncio y quitan parámetros de seguimiento", () => {
  assert.equal(normalizeUrl("https://example.com/coche/?utm_source=x&id=4#fotos"), "https://example.com/coche?id=4");
});
