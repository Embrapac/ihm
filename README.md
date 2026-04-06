# EmbraPac - Sistema de Supervisão e Controle (IHM)

![Status](https://img.shields.io/badge/Status-v2.0%20Client--Server-success)
![Technology](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20VanillaJS-blue)
![Technology](https://img.shields.io/badge/Backend-Node.js%20%7C%20Socket.io-green)
![Type](https://img.shields.io/badge/System-Industrial%20Simulation-orange)

> Uma Interface Homem-Máquina (IHM) de alta fidelidade para controle de linhas de produção, com sincronização em tempo real entre Operação e Supervisão utilizando WebSockets.

---

## Sobre o Projeto

O **EmbraPac IHM** é uma aplicação web desenvolvida para simular o ecossistema de controle de uma linha de empacotamento industrial. O sistema foi projetado para demonstrar conceitos de **Indústria 4.0**, focando na integridade de dados, separação de responsabilidades (RBAC) e cálculo de eficiência (OEE) em tempo real.

Na sua versão atual, o sistema evoluiu de uma simulação local para uma arquitetura **Client-Server**, contando com um Back-end dedicado em Node.js. Isso substitui o armazenamento do navegador por uma comunicação instantânea bidirecional verdadeira, preparando o terreno para a integração real com sensores e microcontroladores (IoT).

### Principais Funcionalidades

* **Sincronização em Tempo Real (IoT Like):** Comunicação instantânea entre a tela do Operador e do Supervisor via `Socket.io`, simulando o comportamento de telemetria industrial.
* **Gestão de Turnos:** Controle de início e fim de expediente com logs auditáveis contendo data e hora precisas.
* **Protocolo de Segurança de Falhas:** Sistema de tratativa de alarmes em **2 Etapas** (Reconhecimento seguido de Confirmação), obrigatório tanto para Operadores quanto Supervisores.
* **Cálculo de OEE:** Monitoramento em tempo real de Disponibilidade, Performance e Qualidade.
* **Histórico e Rastreabilidade:** Logs detalhados de todos os eventos operacionais, com funcionalidade de exportação para CSV.

---

## Telas do Sistema

### 1. Painel do Operador
Focado na execução. Interface limpa com controles grandes, feedback visual de status e barra de progresso da meta.
<img src="frontend/img/painel_de_operacoes.png" ></img>

### 2. Historico de Ações
Focado na segurança. Demonstração de logs, eventos e alarmes do sistema, pesquisa direta das ações por filtro de buscas por data e hora.
<img src="frontend/img/tela_historico.png" ></img>

### 3. Painel do Supervisor (Dashboard)
Focado na gestão. Apresenta KPIs detalhados, controle de turnos, alteração de parâmetros (Meta/Ciclo) e ferramentas de teste.
<img src="frontend/img/tela_supervisor.png" ></img>

---

## Arquitetura Técnica

O projeto segue agora uma arquitetura **Client-Server**:

1. **Back-end (Node.js + Express):** Gerencia a estrutura do servidor HTTP e provê a base para a futura API REST e conexão com o Banco de Dados.
2. **WebSockets (Socket.io):** Atua como o barramento central de eventos em tempo real. Recebe atualizações de estado de qualquer cliente e transmite (`broadcast`) a nova "fonte da verdade" instantaneamente.
3. **Front-end (Vanilla JS):** A interface consome os dados do servidor e reage às mudanças de estado, garantindo sincronia perfeita entre todas as telas abertas.

---

## 🧪 Testes Unitários

O projeto inclui uma **suíte completa de testes unitários** para validar e proteger as regras implementadas contra regressões futuras.

### O que é testado?

- ✅ **Estrutura HTML:** Elementos críticos, IDs únicos, carregamento de scripts na ordem correta
- ✅ **Autenticação:** Validação por perfil (Operador, Supervisor, Manutenção) e controle de acesso
- ✅ **Lógica de Máquina:** Parada automática ao atingir meta, proteção contra salto de relógio, cálculo de downtime
- ✅ **Histórico e Filtros:** Segregação entre abas (alarmes/eventos), sincronização de dados, exportação CSV

### Como rodar os testes

```bash
# primeira vez
npm install --save-dev

# rodar suíte completa
npm test

# modo watch (executa ao salvar arquivos)
npm run test -- --watch

# com detalhes
npx jest --runInBand --verbose
```

### Cobertura atual

| Módulo | Testes | Status |
|--------|--------|--------|
| `master.js` | 4 | ✅ PASS |
| `operador.js` | 2 | ✅ PASS |
| `supervisor.js` | 2 | ✅ PASS |
| `historico.js` | 3 | ✅ PASS |
| **HTML Structure** | 2 | ✅ PASS |
| **Total** | **15 testes** | ✅ **100% PASS** |

Para documentação detalhada sobre como estender os testes, veja [tests/README.md](./tests/README.md).

---

### Estrutura de Arquivos
```text
/
├── 📁 frontend/
│   ├── Tela_1_operador.html   # Interface Operador
│   ├── Tela_2_historico.html  # Logs e Exportação CSV
│   ├── Tela_3_supervisor.html # Dashboard de Gestão
│   ├── style.css              # Estilização Responsiva
│   ├── master.js              # Núcleo Lógico e Auth
│   ├── operador.js            # Lógica da UI Operador
│   ├── supervisor.js          # Lógica da UI Supervisor
│   └── historico.js           # Utilitários Globais
│
└── 📁 backend/
    ├── package.json           # Dependências do Node.js
    └── server.js              # Servidor Express + Socket.io
```
---

## Como Executar

O sistema agora requer a execução do servidor Node.js em background para que a sincronização via WebSockets funcione.

Clone o repositório ou baixe os arquivos, posterior:

Passo 1: Iniciar o Servidor (Backend)

   - Certifique-se de ter o Node.js instalado.

   - Abra o terminal e navegue até a pasta do servidor:

```bash
    cd backend
```
  - Instale as dependências:

```bash
    npm install express cors socket.io
```
  - Inicie o servidor:

```bash
    node server.js
```

Passo 2: Iniciar a Interface (Frontend)

1.  Clone o repositório ou baixe os arquivos.

2.  Abra o arquivo Tela_1_operador.html em uma aba do navegador (Visão Operador).

3.  Abra o arquivo Tela_3_supervisor.html em outra aba (Visão Supervisor).

4.  Utilize as credenciais abaixo para acessar:

| *Perfil* |*Senha* |    *Nível de Acesso*    |
|----------|--------|-------------------------|
| Operador |operador|  Nível 1 (Operacional)  |
|Supervisor| admin  |Nível 2 (Gestão Completa)|
|Manutenção| manu123|Nível 3 (Equipe Técnica) |


    Nota de Teste: Posicione as janelas lado a lado. Inicie a produção no Operador e observe os indicadores reagirem no Supervisor. Simule uma falha no Supervisor e verifique o bloqueio imediato na tela do Operador. Tudo acontecendo via rede!

## Histórico de Versões


    v1.0 - Gold Master:

        - Implementação do relógio de turno dinâmico com data e hora.

        - Unificação do protocolo de segurança de falhas (2 etapas).

        - Isolamento das ferramentas de desenvolvimento (Simulação).

        - Sanitização automática de banco de dados no carregamento.

<p align="center"> Desenvolvido pela Equipe Embarcados 1 - CPQD. </p>
