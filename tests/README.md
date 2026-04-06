# Testes Unitários EmbraPac IHM

Suíte de testes para **validar e prevenir regressões estruturais** nas páginas e regras da Interface Homem-Máquina (IHM) EmbraPac.

## 📋 O que é testado

### 1. **Estrutura das Páginas HTML** (`html-structure.test.js`)
Valida que os elementos críticos das telas existem e que os scripts são carregados na ordem correta:

- ✅ Tela do Operador: Login, status, KPIs, botões e alarmes
- ✅ Tela do Supervisor: Controle de turno, parâmetros, export
- ✅ Tela de Histórico: Filtros, abas (eventos/alarmes), tabela

**Objetivo:** Prevenir quebra acidental de IDs de elementos, remoção de scripts ou carregamento fora de ordem.

---

### 2. **Regras de Autenticação** (`auth-rules.test.js`)
Valida que o sistema respeta os níveis de acesso por perfil:

- ✅ **Operador** acessa com senha "operador" ou "admin"
- ✅ **Supervisor** (admin) acessa com "admin" apenas
- ✅ Rejeição de perfis não autorizados (ex: manutencao → operador)

**Objetivo:** Cada tela só carrega para os usuários corretos. Sem brechas de segurança.

---

### 3. **Regras Centrais da Máquina** (`master-rules.test.js`)
Valida lógicas críticas de estado e produção:

- ✅ Autenticação corrreta de usuários (hash de senhas)
- ✅ **Meta automática**: Linha para automaticamente ao atingir a meta
- ✅ **Proteção de salto de tempo**: Ignora mudanças > 30 minutos (relógio descalibrado)
- ✅ Downtime é registrado corretamente em pausas

**Objetivo:** Lógica do PLC virtual não diverge entre reloads/sincronizações.

---

### 4. **Regras de Histórico e Filtros** (`historico-rules.test.js`)
Valida filtragem, abas e exportação de logs:

- ✅ Aba **Alarmes** mostra apenas ciclo de falha (FALHA, ATIVO, RECONHECIDO, RESET)
- ✅ Aba **Eventos** mostra eventos operacionais (NORMAL, INFORME, ALERTA)
- ✅ Conversão de datas (ISO e legado) funciona
- ✅ Limpeza de filtros restaura valores padrão

**Objetivo:** Histórico não se mistura; filtros funcionam sempre (mesmo após reload).

---

## 🚀 Como Executar

### Primeira vez?

```bash
cd ihm
npm install --save-dev
```

### Rodar testes

```bash
npm test
```

### Rodar com outputverboso (muito útil para debug)

```bash
npx jest --runInBand --verbose
```

### Rodar apenas um teste específico

```bash
npx jest html-structure.test.js
```

### Modo "watch" (automaticamente ao salvar arquivos)

```bash
npx jest --watch
```

---

## 📝 Estrutura de Arquivos

```
ihm/
├── tests/
│   ├── helpers/
│   │   └── script-loader.js          # Utilitários para carregar scripts
│   ├── html-structure.test.js        # Testes de elementos DOM
│   ├── auth-rules.test.js            # Testes de autenticação
│   ├── master-rules.test.js          # Testes de lógica central
│   └── historico-rules.test.js       # Testes de histórico
├── jest.config.cjs                   # Configuração do Jest
├── jest.setup.js                     # Setup global (polyfills)
├── package.json                      # Dependências (inclui Jest, jsdom)
└── frontend/
    ├── master.js                     # Núcleo (testado)
    ├── operador.js                   # Operador (testado)
    ├── supervisor.js                 # Supervisor (testado)
    └── historico.js                  # Histórico (testado)
```

---

## 🔧 Como Manter e Estender

### Adicionar novo elemento à Tela do Operador?

Edite `tests/html-structure.test.js` na seção "teste da tela do operador":

```javascript
test("Tela do operador preserva IDs e scripts criticos", () => {
  const document = loadHtml("Tela_1_operador.html");

  // Adicione sua nova validação:
  expect(document.querySelector("#novo-elemento-id")).not.toBeNull();
  // ...
});
```

Depois rode `npm test` para confirmar.

---

### Adicionar nova função de filtro?

Se adicionar filtro em `historico.js`, crie um novo teste em `historico-rules.test.js`:

```javascript
test("Novo filtro XYZ funciona", () => {
  // Setup
  document.getElementById("novo-filtro").value = "valor";
  
  // Executa
  window.filtrarTabela();
  
  // Verifica
  expect(document.querySelectorAll("#tbody-alarmes tr").length).toBeGreaterThan(0);
});
```

---

### Adicionar novo cenário de máquina?

Edite `master-rules.test.js` e adicione um novo `test()`:

```javascript
test("Maquina calcula OEE corretamente com downtime", () => {
  const { Maquina } = loadMasterExports(window);
  
  localStorage.setItem("embrapac_estado", JSON.stringify({
    // seu estado aqui
  }));
  
  const resultado = Maquina.processarCiclo();
  expect(resultado.oee).toBeCloseTo(85, 0); // 85% ±1%
});
```

---

## ⚠️ Regras que não testamos (ainda)

Essas regras deveriam ter testes **futuros** (complexidade > vale investimento adicional):

1. **Export CSV**: Precisaria mockar `URL.createObjectURL` (complexo)
2. **Sincronização WebSocket (Real)**: Requer um servidor mock (não é CI-friendly ainda)
3. **Cálculo de OEE detalhado**: Cálculos combinados com downtime (fácil de adicionar, não prioritário)
4. **Temas (Dark/Light)**: Não oferece risco ao negócio

---

## 🎯 Best Practices

### ✅ FAÇA

- ✅ Rode `npm test` antes de fazer deploy
- ✅ Atualize os testes quando mudar uma regra intencionalmente
- ✅ Use nomes descritivos nos testes (ex: `test("Operador rejeita perfis nao autorizados")`)
- ✅ Mocke (fake) apenas o necessário (`global.alert`, `Sessao`, etc)

### ❌ NÃO FAÇA

- ❌ Não ignore testes em falha (sempre corrija ou atualize)
- ❌ Não mude `master.js`, `operador.js`, etc sem rodar `npm test` depois
- ❌ Não deixe testes "travados" (comentados) por muito tempo
- ❌ Não adicione lógica no HTML que não seja estrutura (JS fica nos `.js`)

---

## 🛠️ Troubleshooting

**Testes passam localmente mas falham no CI?**
- Certifique-se que `npm install` roda antes de `npm test`
- Verifique timezone (testes de data podem falhar em zonas diferentes)

**Teste fica preso/timeout?**
- Rode com verbose: `npx jest historico-rules.test.js --verbose`
- Verifique se há `setInterval` ou `setTimeout` infinito no teste

**Elementos não encontrados?**
- Use DevTools para confirmar que o ID existe no HTML
- Verifique se não há mudança de case (ID vs id)

---

## 📞 Contactar

Se encontrar bug ou tiver dúvida sobre os testes, consulte a documentação em `./README.md` na raiz.

---

**Versão:** 1.0 | **Última atualização:** Abril 2026
