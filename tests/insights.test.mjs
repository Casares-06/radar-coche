import test from "node:test";
import assert from "node:assert/strict";
import { candidateFromCapture } from "../candidate.mjs";
import { checkState } from "../storage.mjs";
import { comparablePrices, evidenceSummary, nextSnapshot, ownershipCost } from "../insights.mjs";

test("advierte cuando los kilómetros estructurados contradicen la descripción", () => {
  const result = candidateFromCapture({
    url: "https://example.com/anuncio/1", heading: "Ford Focus 1.0 EcoBoost",
    description: "Vendo Ford Focus con 92.000 km y cambio manual.",
    pageText: "Ford Focus 2019 · 130.000 km · Cambio manual · 12.500 €",
    structured: { km: 130000, year: 2019 },
  });
  assert.equal(result.canAdd, true);
  assert.ok(result.warnings.some(warning => warning.includes("kilómetros") && warning.includes("92000") && warning.includes("130000")));
});

test("la comparación exige tres coches parecidos y excluye otros motores o años", () => {
  const target = { id: "t", make: "Seat", model: "León", year: 2019, km: 80000, fuel: "Gasolina", gearbox: "Manual", priceCash: 15000 };
  const saved = [13000, 14000, 16000].map((priceCash, i) => ({ ...target, id: String(i), priceCash }));
  assert.equal(comparablePrices(target, saved.slice(0, 2)).enough, false);
  assert.equal(comparablePrices(target, [...saved, { ...target, id: "wrong", year: 2010, priceCash: 5000 }]).median, 14000);
  const exact = { ...target, advancedProfileId: "leon-iii", engineId: "motor-a" };
  assert.equal(comparablePrices(exact, [...saved, { ...target, id: "same", advancedProfileId: "leon-iii", engineId: "motor-a", priceCash: 15500 }]).count, 1);
});

test("el coste eléctrico y el de gasolina solo son completos con todos los supuestos", () => {
  const base = { priceCash: 10000, costs: { insuranceAnnual: 500, taxAnnual: 100, maintenanceAnnual: 300, repairReserveAnnual: 400, transferCost: 500 } };
  const petrol = ownershipCost({ ...base, fuel: "Gasolina", costs: { ...base.costs, fuelL100: 6, fuelPrice: 2 } }, 10000);
  assert.equal(petrol.complete, true);
  assert.equal(petrol.total, 10000 + 500 + 3 * (500 + 100 + 300 + 400 + 1200));
  const electric = ownershipCost({ ...base, fuel: "Eléctrico", costs: { ...base.costs, energyKwh100: 18, energyPrice: .25 } }, 10000);
  assert.equal(electric.complete, true);
  assert.equal(electric.fuelAnnual, 450);
  assert.equal(ownershipCost({ ...base, fuel: "Eléctrico" }, 10000).complete, false);
});

test("el historial y las pruebas nuevas sobreviven a una copia JSON antigua", () => {
  const before = { priceCash: 12000, km: 90000, history: [] };
  const history = nextSnapshot(before, { priceCash: 11500, km: 90000 });
  assert.deepEqual(history.map(x => x.field), ["priceCash"]);
  const state = checkState({ profile: {}, cars: [{ id: "a", make: "Ford", model: "Focus", history, activity: [{ kind: "Contacto", note: "Enviará facturas" }], costs: { fuelPrice: 1.62 }, warnings: ["km distinto"] }] });
  assert.equal(state.cars[0].history.length, 1);
  assert.equal(state.cars[0].activity[0].kind, "Contacto");
  assert.equal(state.cars[0].costs.fuelPrice, 1.62);
  assert.equal(state.cars[0].warnings[0], "km distinto");
  assert.equal(evidenceSummary(state.cars[0]).counts.pending > 0, true);
});
