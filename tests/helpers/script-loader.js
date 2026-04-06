const fs = require("fs");
const path = require("path");

const FRONTEND_DIR = path.resolve(__dirname, "../../frontend");

function readFrontendFile(fileName) {
  return fs.readFileSync(path.join(FRONTEND_DIR, fileName), "utf8");
}

function evalFrontendScript(window, fileName) {
  const source = readFrontendFile(fileName);
  window.eval(source);
}

function loadMasterExports(window) {
  const source = readFrontendFile("master.js");
  window.eval(
    `${source}\nwindow.__masterExports = { CONFIG, ESTADO_PADRAO, Logger, Sessao, Maquina, obterChaveTema, aplicarTemaDoUsuario, alternarTema, atualizarIconeTema };`
  );
  return window.__masterExports;
}

module.exports = {
  FRONTEND_DIR,
  readFrontendFile,
  evalFrontendScript,
  loadMasterExports
};
