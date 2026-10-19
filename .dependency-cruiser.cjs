// Reguly architektury. Silnik gieldy i gospodarka to czysta logika: zero IO, zero DOM,
// zero three.js — dzieki temu chodza w Node (testy, CLI) i w Web Workerze bez zmian.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "silnik-bez-zaleznosci",
      comment: "packages/engine (arkusz zlecen) nie zalezy od niczego: ani od Node, ani od innych pakietow",
      severity: "error",
      from: { path: "^packages/engine/src", pathNot: "(\\.test\\.ts$|/src/test/)" },
      to: { path: "^(packages/(?!engine)|apps/|node_modules/)", dependencyTypes: ["core", "npm", "npm-dev", "npm-optional", "npm-peer", "npm-no-pkg", "npm-unknown", "local"] },
    },
    {
      name: "silnik-bez-modulow-node",
      severity: "error",
      from: { path: "^packages/engine/src" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "pakiety-nie-znaja-aplikacji",
      comment: "biblioteki w packages/ nie importuja z apps/",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "bez-cykli",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "produkcja-bez-testow",
      comment: "kod produkcyjny nie importuje plikow testowych ani pomocnikow testow (src/test/)",
      severity: "error",
      from: { pathNot: "(\\.test\\.ts$|/src/test/)" },
      to: { path: "(\\.test\\.ts$|/src/test/)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(dist|coverage|reports|\\.stryker-tmp)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
  },
};
