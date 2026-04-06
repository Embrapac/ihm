const { evalFrontendScript } = require("./helpers/script-loader");

function montarDomBasico() {
  document.body.innerHTML = `
    <div id="login-modal" style="display:flex; opacity:1;"></div>
    <div class="user-info"></div>
    <input id="operador-pass" />
    <input id="admin-pass" />
  `;
}

describe("Regras de autenticacao por perfil", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    montarDomBasico();
    global.alert = jest.fn();
  });

  test("Operador aceita login operador e admin", () => {
    global.CONFIG = {};
    global.Sessao = {
      autenticar: jest.fn(),
      atualizarHeader: jest.fn()
    };

    evalFrontendScript(window, "operador.js");

    const passInput = document.getElementById("operador-pass");

    global.Sessao.autenticar.mockReturnValue("operador");
    passInput.value = "qualquer";
    window.attemptLoginOperator();
    expect(document.getElementById("login-modal").style.opacity).toBe("0");

    document.getElementById("login-modal").style.opacity = "1";
    global.Sessao.autenticar.mockReturnValue("admin");
    window.attemptLoginOperator();
    expect(document.getElementById("login-modal").style.opacity).toBe("0");
  });

  test("Operador rejeita perfis nao autorizados", () => {
    global.CONFIG = {};
    global.Sessao = {
      autenticar: jest.fn().mockReturnValue("manutencao"),
      atualizarHeader: jest.fn()
    };

    evalFrontendScript(window, "operador.js");
    window.attemptLoginOperator();

    expect(global.alert).toHaveBeenCalledWith("Senha Incorreta!");
  });

  test("Supervisor aceita somente admin", () => {
    global.CONFIG = {};
    global.Sessao = {
      autenticar: jest.fn().mockReturnValue("admin"),
      atualizarHeader: jest.fn(),
      validar: jest.fn().mockReturnValue(null)
    };

    evalFrontendScript(window, "supervisor.js");
    window.attemptLogin();

    expect(document.getElementById("login-modal").style.display).toBe("none");
    expect(global.alert).not.toHaveBeenCalledWith("Senha Incorreta ou Acesso Negado!");
  });

  test("Supervisor bloqueia usuario que nao seja admin", () => {
    global.CONFIG = {};
    global.Sessao = {
      autenticar: jest.fn().mockReturnValue("operador"),
      atualizarHeader: jest.fn(),
      validar: jest.fn().mockReturnValue(null)
    };

    evalFrontendScript(window, "supervisor.js");
    window.attemptLogin();

    expect(global.alert).toHaveBeenCalledWith("Senha Incorreta ou Acesso Negado!");
  });
});
