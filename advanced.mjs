// Editorial checklists, not diagnoses. Applicability is deliberately conservative.
export const CATALOG_REVIEWED = "2026-10-27";

export const MODEL_PROFILES = [
  {
    id: "golf-vii", make: "Volkswagen", model: "Golf", years: [2012, 2020],
    generation: "VII (2012–2020)", engines: [],
    checks: [
      { id: "golf-dsg", title: "Salida y maniobras con DSG", scope: "Solo cambio automático DSG", gearbox: "Automático", question: "¿Hay tirones al salir, aparcar o circular despacio? ¿Consta el mantenimiento de la caja según esta versión?", proof: "Prueba en frío y caliente; historial de la caja y diagnóstico si aparece un síntoma.", source: "ADAC", url: "https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0259-vw-golf-vii-2012-2020-benziner-bericht.pdf" },
      { id: "golf-chassis", title: "Frenos y suspensión", scope: "Golf VII gasolina", fuel: "Gasolina", question: "¿Se han revisado discos, pastillas, amortiguadores y holguras en la última inspección?", proof: "Informe ITV y revisión de un taller independiente.", source: "ADAC", url: "https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0259-vw-golf-vii-2012-2020-benziner-bericht.pdf" },
    ],
  },
  {
    id: "ibiza-iv", make: "SEAT", model: "Ibiza", years: [2008, 2017],
    generation: "IV (2008–2017)", engines: [{ id: "tsi-ea111", label: "1.2/1.4 TSI EA111" }, { id: "otro", label: "Otro motor / por confirmar" }],
    checks: [
      { id: "ibiza-chain", title: "Distribución del TSI anterior", scope: "1.2/1.4 TSI EA111; confirma código de motor", engine: "tsi-ea111", question: "¿Cuál es el código de motor y hay facturas de revisión o reparación de la distribución?", proof: "Código de motor, facturas y comprobación en frío por taller.", source: "ADAC", url: "https://assets.adac.de/Autodatenbank/GWInfo/gw0197-seat-ibiza-2008-2017-benziner-bericht.pdf" },
    ],
  },
  {
    id: "leon-iii", make: "SEAT", model: "León", years: [2012, 2020],
    generation: "III (2012–2020)", engines: [],
    checks: [
      { id: "leon-dsg", title: "Funcionamiento de DSG", scope: "Solo cambio automático DSG", gearbox: "Automático", question: "¿El cambio sale suave desde parado y en maniobras? ¿Hay historial de mantenimiento aplicable a esta caja?", proof: "Prueba en frío y caliente; facturas y diagnóstico si hay síntomas.", source: "ADAC", url: "https://assets.adac.de/Autodatenbank/GWInfo/gw0268-seat-leon-2012---2020-benziner-bericht.pdf" },
      { id: "leon-suspension", title: "Suspensión y dirección", scope: "León III gasolina", fuel: "Gasolina", question: "¿Aparecen ruidos o holguras al pasar irregularidades o girar?", proof: "Informe ITV y elevador en una inspección independiente.", source: "ADAC", url: "https://assets.adac.de/Autodatenbank/GWInfo/gw0268-seat-leon-2012---2020-benziner-bericht.pdf" },
    ],
  },
  {
    id: "clio-iv", make: "Renault", model: "Clio", years: [2012, 2020],
    generation: "IV (2012–2020)", engines: [],
    checks: [
      { id: "clio-wear", title: "Desgaste en tren rodante y frenos", scope: "Clio IV", question: "¿Confirman la ITV y una inspección que suspensión, dirección y frenos no tienen defectos pendientes?", proof: "Últimos informes ITV y revisión con elevador.", source: "ADAC", url: "https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0280-renault-clio-2012-2020-bericht.pdf" },
    ],
  },
  {
    id: "focus-iv", make: "Ford", model: "Focus", years: [2018, 2026],
    generation: "IV (desde 2018)", engines: [{ id: "ecoboost-1", label: "1.0 EcoBoost" }, { id: "otro", label: "Otro motor / por confirmar" }],
    checks: [
      { id: "focus-belt", title: "Correa de distribución en aceite", scope: "Solo 1.0 EcoBoost cuando equipa esta distribución; verifica código de motor", engine: "ecoboost-1", question: "¿Se acreditan el motor exacto, el aceite correcto, los intervalos y la revisión de la distribución?", proof: "Código de motor, facturas con especificación de aceite y revisión especializada.", source: "ADAC", url: "https://assets.adac.de/Autodatenbank/GWInfo/gw0526-ford-focus-seit-2018-bericht.pdf" },
    ],
  },
  {
    id: "c3-iii", make: "Citroën", model: "C3", years: [2016, 2024],
    generation: "III (2016–2024)", engines: [{ id: "puretech-12", label: "1.2 PureTech" }, { id: "otro", label: "Otro motor / por confirmar" }],
    checks: [
      { id: "c3-puretech", title: "Correa y consumo de aceite", scope: "Generaciones anteriores del 1.2 PureTech; confirmar versión y fecha de fabricación", engine: "puretech-12", question: "¿Hay historial de aceite correcto, revisiones de la correa y consumo de aceite? ¿Se ha consultado la posible cobertura del fabricante con el bastidor?", proof: "Código de motor, facturas y consulta oficial por bastidor; la cobertura no es automática.", source: "Citroën España", url: "https://www.citroen.es/posventa/garantia-extendida-motores-puretech.html" },
    ],
  },
];

const fold = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]/g, "");
export const profileById = id => MODEL_PROFILES.find(profile => profile.id === id) || null;

export function matchingProfiles(car) {
  const make = fold(car?.make), model = fold(car?.model), year = Number(car?.year);
  return MODEL_PROFILES.filter(profile => fold(profile.make) === make && fold(profile.model) === model &&
    (!Number.isFinite(year) || !year || year >= profile.years[0] && year <= profile.years[1]));
}

export function advancedChecks(car) {
  const profile = profileById(car?.advancedProfileId);
  if (!profile || !matchingProfiles(car).some(match => match.id === profile.id)) return [];
  return profile.checks.map(check => {
    const relevant = check.engine && car.engineId && car.engineId !== check.engine ? false :
      check.gearbox && car.gearbox && car.gearbox !== check.gearbox ? false :
      check.fuel && car.fuel && car.fuel !== check.fuel ? false : true;
    const uncertain = relevant && !!((check.engine && !car.engineId) || (check.gearbox && !car.gearbox) || (check.fuel && !car.fuel));
    return { ...check, applicable: relevant, uncertain };
  }).filter(check => check.applicable);
}
