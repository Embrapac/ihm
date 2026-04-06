const { evalFrontendScript } = require("./helpers/script-loader");

function montarTelaHistorico() {
  document.body.innerHTML = `
    <input id="search-input" value="" />
    <select id="filter-status"><option value="all" selected>all</option><option value="FALHA">FALHA</option></select>
    <input id="filter-date-start" value="" />
    <input id="filter-time-start" value="" />
    <input id="filter-date-end" value="" />
    <input id="filter-time-end" value="" />
    <button id="tab-eventos"></button>
    <button id="tab-alarmes"></button>
    <h2 id="titulo-tabela"></h2>
    <table id="tabela-alarmes"><tbody id="tbody-alarmes"></tbody></table>
    <button id="btn-carregar-mais" style="display:none;"></button>
  `;
}

describe("Regras de historico e filtros", () => {
  beforeEach(() => {
    localStorage.clear();
    montarTelaHistorico();
    evalFrontendScript(window, "historico.js");

    const logs = [
      {
        data: "2026-04-03T10:00:00.000Z",
        evento: "FALHA CRITICA: Motor M2",
        tipo: "FALHA",
        usuario: "Sistema",
        cargo: "Automatico"
      },
      {
        data: "2026-04-03T10:05:00.000Z",
        evento: "Produção Iniciada",
        tipo: "NORMAL",
        usuario: "Sr. Agenor",
        cargo: "Operador"
      }
    ];
    localStorage.setItem("embrapac_logs", JSON.stringify(logs));
  });

  test("mudarAba('alarmes') exibe somente ciclo de falha", () => {
    window.mudarAba("alarmes");
    const linhas = document.querySelectorAll("#tbody-alarmes tr");

    expect(linhas.length).toBe(1);
    expect(document.getElementById("titulo-tabela").textContent).toContain("Histórico de Alarmes");
  });

  test("mudarAba('eventos') exibe eventos operacionais", () => {
    window.mudarAba("eventos");
    const linhas = document.querySelectorAll("#tbody-alarmes tr");

    expect(linhas.length).toBe(1);
    expect(document.getElementById("titulo-tabela").textContent).toContain("Histórico de Eventos");
  });

  test("converterDataParaNumero suporta formato ISO e legado", () => {
    const iso = window.converterDataParaNumero("2026-04-03T11:22:33.000Z");
    const legado = window.converterDataParaNumero("03/04/2026 11:22:33");

    expect(iso).toBeGreaterThan(0);
    expect(legado).toBeGreaterThan(0);
  });

  test("limparFiltros restaura campos para padrao", () => {
    document.getElementById("search-input").value = "motor";
    document.getElementById("filter-status").value = "FALHA";
    document.getElementById("filter-date-start").value = "2026-04-01";
    document.getElementById("filter-time-start").value = "07:00";

    window.limparFiltros();

    expect(document.getElementById("search-input").value).toBe("");
    expect(document.getElementById("filter-status").value).toBe("all");
    expect(document.getElementById("filter-date-start").value).toBe("");
    expect(document.getElementById("filter-time-start").value).toBe("");
  });
});