# EmbraPac - Sistema de Supervisão e Controle (IHM)

![Status](https://img.shields.io/badge/Status-Gold%20Master-success)
![Technology](https://img.shields.io/badge/Tech-HTML5%20%7C%20CSS3%20%7C%20VanillaJS-blue)
![Type](https://img.shields.io/badge/System-Industrial%20Simulation-orange)

> Uma simulação de Interface Homem-Máquina (IHM) de alta fidelidade para controle de linhas de produção, com sincronização em tempo real entre Operação e Supervisão.

---

## Sobre o Projeto

O **EmbraPac IHM** é uma aplicação web desenvolvida para simular o ecossistema de controle de uma linha de empacotamento industrial. O sistema foi projetado para demonstrar conceitos de **Indústria 4.0**, focando na integridade de dados, separação de responsabilidades (RBAC) e cálculo de eficiência (OEE) em tempo real.

A arquitetura utiliza o navegador como um "PLC Virtual", garantindo que a produção continue sendo calculada matematicamente baseada em tempo (Delta Time), mesmo que as interfaces visuais sejam fechadas ou recarregadas.

### Principais Funcionalidades

* **Sincronização em Tempo Real:** Comunicação instantânea entre a tela do Operador e do Supervisor via LocalStorage Events.
* **Gestão de Turnos:** Controle de início e fim de expediente com logs auditáveis contendo data e hora precisas.
* **Protocolo de Segurança de Falhas:** Sistema de tratativa de alarmes em **2 Etapas** (Reconhecimento seguido de Confirmação), obrigatório tanto para Operadores quanto Supervisores.
* **Cálculo de OEE:** Monitoramento em tempo real de Disponibilidade, Performance e Qualidade.
* **Histórico e Rastreabilidade:** Logs detalhados de todos os eventos operacionais, com funcionalidade de exportação para CSV.
* **Resiliência:** O sistema recupera o estado exato da máquina após atualizações de página, mantendo a persistência da sessão.

---

## Telas do Sistema

### 1. Painel do Operador
Focado na execução. Interface limpa com controles grandes, feedback visual de status e barra   de progresso da meta.
<img src="img/Captura de tela de 2026-03-02 20-25-55.png" ></img>

### 2. Historico de Ações
Focado na segurança. Demonstração de logs, eventos e alarmes do sistema, pesquisa direta das ações por filtro de buscas por data e hora.
<img src="img/Captura de tela de 2026-03-03 09-46-24.png" ></img>

### 3. Painel do Supervisor (Dashboard)
Focado na gestão. Apresenta KPIs detalhados, controle de turnos, alteração de parâmetros (Meta/Ciclo) e ferramentas de teste.
<img src="img/Captura de tela de 2026-03-02 20-27-26.png" ></img>

---

## Arquitetura Técnica

O projeto segue uma arquitetura **Client-Side State Management**:

1.  **master.js (Core):** Atua responsável pela regra de negócio crítica: cálculo de produção baseado em timestamp (`Date.now()`), garantindo precisão matemática independente da renderização visual.
2.  **supervisor.js & operador.js (Views):** Controlam a interface do usuário e a lógica específica de permissão de cada perfil.
3.  **Persistência:** Utiliza `localStorage` como barramento de dados, permitindo que múltiplas abas do navegador compartilhem o mesmo "estado de máquina" instantaneamente.

> **⚠️ Arquitetura e Evolução (Roadmap):** Atualmente, esta aplicação opera com o Front-End consolidado, utilizando `LocalStorage` como barramento para simulação e persistência de estado em tempo real. A próxima fase do projeto (em desenvolvimento) contempla a implementação de um **Back-End dedicado e Banco de Dados**. Essa evolução transferirá a validação de segurança, autenticação e cálculos de OEE para a camada do servidor, além de permitir a comunicação remota real com os sensores e atuadores da linha de produção.

### Estrutura de Arquivos
```bash
/
├── Tela_1_operador.html   # Interface Operador
├── Tela_2_historico.html  # Logs e Exportação CSV
├── Tela_3_supervisor.html # Dashboard de Gestão
├── style.css              # Estilização Responsiva
├── master.js              # Núcleo Lógico (PLC Virtual)
├── operador.js            # Lógica da UI Operador
├── supervisor.js          # Lógica da UI Supervisor
└── historico.js           # Utilitários Globais (Sanitização/Filtros/Paginação)
```

---

## Como Executar

O sistema é estático e não requer instalação de dependências ou servidores backend.

1.  Clone o repositório ou baixe os arquivos.

2.  Abra o arquivo Tela_1_operador.html em uma aba do navegador (Visão Operador).

3.  Abra o arquivo Tela_3_supervisor.html em outra aba (Visão Supervisor).

4.  Utilize as credenciais abaixo para acessar:

| *Perfil* |*Senha* |    *Nível de Acesso*    |
|----------|--------|-------------------------|
| Operador |operador|  Nível 1 (Operacional)  |
|Supervisor| admin  |Nível 2 (Gestão Completa)|


    Nota de Teste: Recomenda-se posicionar as janelas lado a lado. Inicie a produção no Operador e observe os indicadores reagirem no Supervisor. Simule uma falha no Supervisor e verifique o bloqueio imediato na tela do Operador.

## Histórico de Versões


    v1.0 - Gold Master:

        - Implementação do relógio de turno dinâmico com data e hora.

        - Unificação do protocolo de segurança de falhas (2 etapas).

        - Isolamento das ferramentas de desenvolvimento (Simulação).

        - Sanitização automática de banco de dados no carregamento.

<p align="center"> Desenvolvido pela Equipe Embarcados 1 - CPQD. </p>
