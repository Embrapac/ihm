const { loadMasterExports } = require("./helpers/script-loader");

describe("Regras centrais do master.js", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="user-info"></div>`;
    localStorage.clear();
    sessionStorage.clear();
    global.alert = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("Sessao autentica usuario valido e rejeita senha invalida", () => {
    const { Sessao } = loadMasterExports(window);

    const perfil = Sessao.autenticar("admin");
    expect(perfil).toBe("admin");

    const invalido = Sessao.autenticar("senha-errada");
    expect(invalido).toBeNull();

    const sessoes = JSON.parse(localStorage.getItem("embrapac_sessions"));
    expect(sessoes.admin).toBeDefined();
  });

  test("Maquina para automaticamente quando meta e atingida", () => {
    const { Maquina } = loadMasterExports(window);

    localStorage.setItem(
      "embrapac_estado",
      JSON.stringify({
        producao: 9,
        refugo: 0,
        meta: 10,
        ciclo: 1,
        status: "OPERANDO",
        ultimoUpdate: 1000,
        turnoAtivo: false,
        horaInicioTurno: "--:--",
        horaFimTurno: "--:--",
        horaFalha: "--:--",
        downtime: 0,
        oee: 0
      })
    );

    jest.spyOn(Date, "now").mockReturnValue(3000);
    const estado = Maquina.processarCiclo();

    expect(estado.producao).toBe(10);
    expect(estado.status).toBe("PARADO");
    expect(global.alert).toHaveBeenCalledWith("META ATINGIDA! A linha parou automaticamente.");
  });

  test("Maquina ignora salto de tempo muito grande para proteger consistencia", () => {
    const { Maquina } = loadMasterExports(window);

    localStorage.setItem(
      "embrapac_estado",
      JSON.stringify({
        producao: 100,
        refugo: 0,
        meta: 200,
        ciclo: 1,
        status: "OPERANDO",
        ultimoUpdate: 1000,
        turnoAtivo: false,
        horaInicioTurno: "--:--",
        horaFimTurno: "--:--",
        horaFalha: "--:--",
        downtime: 0,
        oee: 0
      })
    );

    jest.spyOn(Date, "now").mockReturnValue(1900000);
    const estado = Maquina.processarCiclo();

    expect(estado.producao).toBe(100);
    expect(estado.ultimoUpdate).toBe(1900000);
  });
});
