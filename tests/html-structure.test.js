const path = require("path");
const { JSDOM } = require("jsdom");
const { readFrontendFile, FRONTEND_DIR } = require("./helpers/script-loader");

function loadHtml(fileName) {
  const html = readFrontendFile(fileName);
  return new JSDOM(html, {
    url: `http://localhost/${fileName}`
  }).window.document;
}

describe("Estrutura das telas HTML", () => {
  test("Tela do operador preserva IDs e scripts criticos", () => {
    const document = loadHtml("Tela_1_operador.html");

    expect(document.querySelector("#login-modal")).not.toBeNull();
    expect(document.querySelector("#status-display")).not.toBeNull();
    expect(document.querySelector("#kpi-production")).not.toBeNull();
    expect(document.querySelector("#btn-start")).not.toBeNull();
    expect(document.querySelector("#btn-stop")).not.toBeNull();
    expect(document.querySelector("#btn-refugo")).not.toBeNull();
    expect(document.querySelector("#alarm-panel")).not.toBeNull();

    const scripts = Array.from(document.querySelectorAll("script[src]"))
      .map((s) => path.basename(s.getAttribute("src")));

    expect(scripts).toEqual(
      expect.arrayContaining(["theme-init.js", "master.js", "operador.js"])
    );
    expect(scripts.indexOf("master.js")).toBeLessThan(scripts.indexOf("operador.js"));
  });

  test("Tela do supervisor preserva controles de turno e parametros", () => {
    const document = loadHtml("Tela_3_supervisor.html");

    expect(document.querySelector("#btn-start-shift")).not.toBeNull();
    expect(document.querySelector("#active-shift-controls")).not.toBeNull();
    expect(document.querySelector("#btn-export")).not.toBeNull();
    expect(document.querySelector("#meta-input")).not.toBeNull();
    expect(document.querySelector("#ciclo-input")).not.toBeNull();
    expect(document.querySelector("#btn-save-params")).not.toBeNull();
    expect(document.querySelector("#btn-zerar-turno")).not.toBeNull();
  });

  test("Tela de historico preserva filtros, abas e tabela", () => {
    const document = loadHtml("Tela_2_historico.html");

    expect(document.querySelector("#filter-date-start")).not.toBeNull();
    expect(document.querySelector("#filter-time-start")).not.toBeNull();
    expect(document.querySelector("#filter-date-end")).not.toBeNull();
    expect(document.querySelector("#filter-time-end")).not.toBeNull();
    expect(document.querySelector("#filter-status")).not.toBeNull();
    expect(document.querySelector("#search-input")).not.toBeNull();
    expect(document.querySelector("#tab-eventos")).not.toBeNull();
    expect(document.querySelector("#tab-alarmes")).not.toBeNull();
    expect(document.querySelector("#tbody-alarmes")).not.toBeNull();
  });

  test("Arquivos HTML alvo existem no frontend", () => {
    const expectedFiles = [
      "Tela_1_operador.html",
      "Tela_2_historico.html",
      "Tela_3_supervisor.html"
    ];

    expectedFiles.forEach((name) => {
      const absolutePath = path.join(FRONTEND_DIR, name);
      expect(() => readFrontendFile(name)).not.toThrow();
      expect(absolutePath.includes("frontend")).toBe(true);
    });
  });
});
