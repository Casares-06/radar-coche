import test from "node:test";
import assert from "node:assert/strict";
import { advancedChecks, matchingProfiles, MODEL_PROFILES } from "../advanced.mjs";
import { candidateFromCapture } from "../candidate.mjs";
import { checkState } from "../storage.mjs";

test("la ficha exige marca, modelo y año compatibles", () => {
  assert.equal(MODEL_PROFILES.length, 6);
  for (const [make, model, year, expected] of [
    ["Volkswagen", "Golf", 2017, "golf-vii"],
    ["Seat", "Ibiza", 2014, "ibiza-iv"],
    ["SEAT", "León", 2019, "leon-iii"],
    ["Renault", "Clio", 2016, "clio-iv"],
    ["Ford", "Focus", 2020, "focus-iv"],
    ["Citroen", "C3", 2019, "c3-iii"],
  ]) assert.equal(matchingProfiles({ make, model, year })[0]?.id, expected);
  assert.deepEqual(matchingProfiles({ make: "Seat", model: "Ibiza", year: 2021 }), []);
  assert.deepEqual(matchingProfiles({ make: "Renault", model: "Megane", year: 2018 }), []);
});

test("una alerta de motor no se aplica al motor distinto", () => {
  const base = { make: "Citroen", model: "C3", year: 2019, advancedProfileId: "c3-iii" };
  assert.equal(advancedChecks({ ...base, engineId: "otro" }).length, 0);
  assert.equal(advancedChecks({ ...base, engineId: "puretech-12" }).length, 1);
  assert.equal(advancedChecks(base)[0].uncertain, true);
  const golf = { make: "Volkswagen", model: "Golf", year: 2017, fuel: "Gasolina", gearbox: "Manual", advancedProfileId: "golf-vii" };
  assert.ok(!advancedChecks(golf).some(check => check.id === "golf-dsg"));
});

test("el anuncio conserva pistas relevantes como notas no verificadas", () => {
  const capture = candidateFromCapture({
    heading: "Ford Focus 1.0 EcoBoost", url: "https://example.com/focus",
    pageText: "Ford Focus 2019 80.000 km\nCambio manual\nITV hasta diciembre de 2026\nDistribución cambiada con factura\nPolítica de cookies",
  });
  assert.equal(capture.canAdd, true);
  assert.ok(capture.notes.some(note => note.includes("Distribución")));
  assert.ok(capture.notes.some(note => note.includes("ITV")));
  assert.ok(!capture.notes.some(note => note.includes("cookies")));
});

test("las copias antiguas siguen importándose y las fichas nuevas persisten", () => {
  const old = checkState({ profile: {}, cars: [{ id: "a", make: "SEAT", model: "León" }] });
  assert.equal(old.cars[0].advancedProfileId, "");
  const saved = checkState({ profile: {}, cars: [{ id: "b", make: "SEAT", model: "León", advancedProfileId: "leon-iii", engineId: "otro", answers: { "advanced:leon-dsg": { status: "Verificado", note: "Prueba realizada" } } }] });
  assert.equal(saved.cars[0].advancedProfileId, "leon-iii");
  assert.equal(saved.cars[0].answers["advanced:leon-dsg"].status, "Verificado");
});
