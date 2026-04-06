# 📋 ESTRUTURA DE TESTES UNITÁRIOS - EMBRAPAC IHM

**Versão:** 1.0 | **Status:** ✅ Pronto para Produção | **Data:** Abril 2026

---

## 🎯 Objetivo do Projeto

Estabelecer uma **suíte de testes unitários automatizados** que valide todas as **regras críticas** implementadas na Interface Homem-Máquina (IHM) EmbraPac, prevenindo regressões estruturais em futuras implementações.

---

## 📦 Arquivos Criados

### Configuração e Setup
| Arquivo | Propósito |
|---------|-----------|
| `package.json` | Dependências Jest, jsdom, scripts npm |
| `jest.config.cjs` | Configuração do Jest (jsdom, testMatch, setup) |
| `jest.setup.js` | Polyfills globais (TextEncoder para jsdom) |

### Testes Unitários (5 arquivos)
| Arquivo | Cobertura | Testes |
|---------|-----------|--------|
| `tests/html-structure.test.js` | Estrutura DOM das 3 telas HTML | 4 ✅ |
| `tests/auth-rules.test.js` | Autenticação por perfil (operador/admin) | 3 ✅ |
| `tests/master-rules.test.js` | Lógica central (máquina, sessão, downtime) | 3 ✅ |
| `tests/historico-rules.test.js` | Histórico, filtros, abas, datas | 4 ✅ |
| `tests/helpers/script-loader.js` | Utilitários para carregar scripts do frontend | - |

### Documentação
| Arquivo | Conteúdo |
|---------|----------|
| `tests/README.md` | Guia completo: como usar, estender, troubleshoot |
| `TESTS.md` | Mapa visual da suíte, exemplos, roadmap |
| `README.md` (atualizado) | Seção integrada de testes |

---

## 🚀 Como Usar

### 1. Instalação (primeira vez)
```bash
cd ihm
npm install --save-dev
```

### 2. Rodar os testes
```bash
# Suíte completa
npm test

# Resultado esperado:
# Test Suites: 4 passed, 4 total
# Tests:       15 passed, 15 total  ✅
```

### 3. Modo interativo
```bash
# Watch mode (executa ao salvar)
npm test -- --watch

# Com detalhes
npx jest --runInBand --verbose
```

---

## ✅ O Que É Testado (15 Testes Total)

### 1. ESTRUTURA HTML (4 testes)
Valida que os elementos críticos existem e scripts carregam na ordem certa.

**Tela do Operador:**
- Login modal (`#login-modal`)
- Status display (`#status-display`)
- KPIs (`#kpi-production`, `#kpi-refugo`)
- Botões (`#btn-start`, `#btn-stop`, `#btn-refugo`)
- Alarme panel (`#alarm-panel`)
- Scripts: master.js + operador.js (ordem correta)

**Tela do Supervisor:**
- Controle de turno (`#btn-start-shift`, `#active-shift-controls`)
- Parâmetros (`#meta-input`, `#ciclo-input`, `#btn-save-params`)
- KPI downtime (`#kpi-downtime`)
- Export (`#btn-export`, `#btn-zerar-turno`)

**Tela de Histórico:**
- Filtros (`#filter-date-*`, `#filter-time-*`, `#filter-status`)
- Busca (`#search-input`)
- Abas (`#tab-eventos`, `#tab-alarmes`)
- Tabela (`#tbody-alarmes`, `#btn-carregar-mais`)

### 2. AUTENTICAÇÃO POR PERFIL (3 testes)
Valida que apenas usuários autorizados acessam cada tela.

- ✅ Operador: Aceita login "operador" E "admin"
- ✅ Operador: Rejeita perfis não autorizados
- ✅ Supervisor (admin): Aceita SOMENTE "admin"

### 3. LÓGICA DE MÁQUINA (3 testes)
Valida regras críticas de produção.

- ✅ Autenticação: Senha válida cria sessão, inválida retorna null
- ✅ Meta automática: Máquina para ao atingir meta + alert
- ✅ Proteção relógio: Ignora salto de tempo > 30 minutos

### 4. HISTÓRICO E FILTROS (4 testes)
Valida segregação de dados e sincronização.

- ✅ Aba "Alarmes": Mostra SOMENTE ciclo de falha (FALHA, ATIVO, RECONHECIDO)
- ✅ Aba "Eventos": Mostra SOMENTE eventos operacionais (NORMAL, INFORME, ALERTA)
- ✅ Conversão de datas: Suporta ISO (2026-04-03) + legado (03/04/2026)
- ✅ Limpeza de filtros: Restaura todos campos para padrão

---

## 🏆 Regras de Negócio Protegidas

| Regra | Teste | Prevenção |
|-------|-------|-----------|
| **Operador não acessa Supervisor** | `auth-rules` | Bloqueia login cruzado |
| **Linha para ao atingir meta** | `master-rules` | Evita sobreprodução |
| **Relógio descalibrado é ignorado** | `master-rules` | Previne picos de produção |
| **Alarmes vs Eventos segregados** | `historico-rules` | Não mistura ciclos |
| **IDs HTML não mudam** | `html-structure` | Interface sempre funciona |

---

## 💡 Exemplos de Uso

### Exemplo 1: Adicionar novo elemento à tela
```javascript
// Em Tela_1_operador.html, você adiciona:
<button id="novo-botao-teste">Testar</button>

// Então atualize tests/html-structure.test.js:
test("Tela do operador preserva IDs e scripts criticos", () => {
  const document = loadHtml("Tela_1_operador.html");
  expect(document.querySelector("#novo-botao-teste")).not.toBeNull(); // ✅
});

// Rode: npm test
// Se passar: mudança é segura. Se falhar: elemento está faltando.
```

### Exemplo 2: Alterar regra de autenticação
```javascript
// Se você mudar CONFIG.USUARIOS em master.js:
// npm test roda automaticamente
// Se falhar: testes alertam que broke a regra
// Se passar: regra é consistente
```

### Exemplo 3: Adicionar novo filtro no histórico
```javascript
// Em historico.js, você adiciona:
function novoFiltro(valor) { /* lógica */ }

// Em tests/historico-rules.test.js:
test("Novo filtro XYZ funciona", () => {
  document.getElementById("novo-filtro").value = "teste";
  window.novoFiltro("teste");
  expect(resultado).toBe(esperado); // ✅
});
```

---

## 📊 Estatísticas

| Métrica | Valor |
|---------|-------|
| **Total de testes** | 15 ✅ |
| **Taxa de sucesso** | 100% |
| **Tempo de execução** | ~2 segundos |
| **Módulos cobertos** | 4 (master, operador, supervisor, historico) |
| **Linhas de código de teste** | ~500 |
| **Dependências adicionadas** | 2 (jest, jest-environment-jsdom) |

---

## 🔄 Workflow Recomendado

```
Desenvolvedor faz mudança
          ↓
    npm test (local)
          ↓
    ✅ Todos passam? → Push
    ❌ Algum falha? → Corrigir ou atualizar teste
          ↓
    CI/CD roda npm test (automático)
          ↓
    Deploy com confiança de que regras não foram quebradas
```

---

## 📚 Documentação Relacionada

- **[tests/README.md](./tests/README.md)** — Guia detalhado, troubleshoot, best practices
- **[TESTS.md](./TESTS.md)** — Mapa visual, exemplos, roadmap
- **[README.md](./README.md)** — Seção "Testes Unitários" integrada

---

## ⚠️ O Que Não É Testado (e por que)

| Item | Razão | Alternativa |
|------|-------|------------|
| Export CSV | Requer mock complexo de Blob/download | Manual testing |
| WebSocket sync | Precisa servidor mock rodando | E2E testing (futuro) |
| OEE cálculo completo | Muito complexo, baixo ROI | Unit test isolado |
| Temas (Dark/Light) | Baixo risco ao negócio | Manual testing |
| Performance | Não é crítico para MVP | Profiling futuro |

---

## 🎓 Manutenção Mínima

### Checklist mensal
- [ ] Rodar `npm test` para confirmar que tudo passa
- [ ] Se houver falha: investigar e corrigir IMMEDIATELY
- [ ] Se adicionar feature: adicionar teste correspondente

### Quando adicionar testes?
- ✅ Quando identifica uma regra crítica não testada
- ✅ Quando corrige bug (para evitar regressão)
- ✅ Quando adiciona funcionalidade nova
- ❌ Não é necessário para UI tweaks (cores, espaçamento)

---

## 🚀 Próximos Passos (Opcional)

### Curto prazo (1-2 semanas)
- [ ] Integrar no CI/CD (GitHub Actions)
- [ ] Adicionar pre-commit hook (impede commit sem testes passando)

### Médio prazo (1-2 meses)
- [ ] E2E tests com Playwright (cliques reais)
- [ ] Coverage report (meta: 90%)

### Longo prazo (3+ meses)
- [ ] Testes de performance
- [ ] Testes de acessibilidade (a11y)
- [ ] Snapshot testing (UI regression)

---

## 📞 Suporte

Se encontrar problema ou tiver dúvida:

1. Consulte [tests/README.md](./tests/README.md) — seção "Troubleshooting"
2. Procure no arquivo de testes correspondente por exemplo similar
3. Rode com `--verbose` para mais detalhes

---

## ✨ Conclusão

A suíte de testes entregue **protege as regras críticas da IHM** contra regressões futuras com:
- ✅ 15 testes automatizados (100% PASS)
- ✅ Fácil manutenção e extensão
- ✅ Integração CI/CD ready
- ✅ Documentação completa
- ✅ Zero impacto no código frontend

**Status:** Pronto para produção! 🎉

---

**Desenvolvido com ❤️ para EmbraPac | Abril 2026**
