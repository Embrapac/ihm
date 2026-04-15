# EmbraPac - Sistema de Supervisão e Controle (IHM) & Edge Server

![Status](https://img.shields.io/badge/Status-v3.0%20Industrial%20Edge-success)
![Frontend](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20VanillaJS-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Socket.io-green)
![IoT](https://img.shields.io/badge/IoT-MQTT%20%7C%20Mosquitto-red)
![Database](https://img.shields.io/badge/Database-MariaDB-blueviolet)
![Security](https://img.shields.io/badge/Security-JWT-orange)

> Uma Interface Homem-Máquina (IHM) de alta fidelidade e um Edge Server robusto para controle de linhas de produção, integrando Inteligência Artificial (YOLO), hardware (ESP32) e sincronização em tempo real.

---

## Sobre o Projeto

O **EmbraPac IHM** é uma aplicação web e um servidor de borda (Edge Server) desenvolvido para modernizar o ecossistema de controle de uma linha de empacotamento industrial. O sistema foi projetado para aplicar conceitos reais de **Indústria 4.0**.

O sistema evoluiu de uma simulação local para uma arquitetura **OT (Operation Technology) Bidirecional**. Conta com um back-end dedicado em Node.js que orquestra a base de dados relacional, a segurança corporativa e a comunicação IoT com o chão de fábrica, garantindo a integridade dos dados e o cálculo de eficiência (OEE) em tempo real.

### Principais Funcionalidades

* **Integração IoT Bidirecional (MQTT):** Comunicação padronizada em JSON com microcontroladores (ESP32) e câmeras de Visão Computacional, suportando tolerância a falhas de rede.
* **Segurança Zero Trust (JWT):** Autenticação corporativa baseada em JSON Web Tokens. As rotas da API e os comandos via WebSockets estão blindados contra acessos não autorizados.
* **Persistência Industrial (MariaDB):** Registro auditável e seguro de todos os logs, alarmes e métricas de turnos em um banco de dados relacional de alto desempenho.
* **Sincronização em Tempo Real:** Comunicação instantânea entre a tela do Operador e do Supervisor via `Socket.io`.
* **Protocolo de Segurança de Falhas:** Sistema de tratamento de alarmes em **2 Etapas** (Reconhecimento seguido de Confirmação).

---

## Arquitetura Técnica

O projeto segue agora uma arquitetura **Edge Computing** completa:

1. **Front-end (Vanilla JS):** A interface consome os dados do servidor e reage às mudanças de estado, garantindo sincronia perfeita.
2. **Back-end (Node.js + Express):** O "cérebro" do sistema. Gerencia a lógica de negócio, a API REST e a validação de segurança.
3. **WebSockets (Socket.io):** O barramento central para as interfaces web, transmitindo a nova "fonte da verdade" instantaneamente.
4. **Broker MQTT (Mosquitto):** A ponte de comunicação com o mundo físico (sensores, motores, ESP32).
5. **Base de Dados (MariaDB):** Armazenamento permanente da estrutura de usuários, histórico de produção e logs.

---

## Protocolo de Comunicação IoT (Contrato JSON)

Para garantir a simetria de dados entre a equipe de Software e a de Hardware (Visão Computacional), o sistema utiliza os seguintes pacotes JSON via MQTT:

### 1. Pacote de Comando (IHM ➔ Máquina)

* **Tópico:** `embrapac/comando/esteira`
* **Descrição:** Ordens de controle da interface web para atuar nos relés da esteira.

```json
{
  "comando": "START",
  "timestamp": 1713000000000,
  "origem": "Sr. Carlos"
}
```

### 2. Pacote de Telemetria (Máquina ➔ IHM)

* **Tópico:** `embrapac/producao/sensor`
* **Descrição:** Confirmação do sensor óptico/IA informando a passagem e a classificação de uma caixa.

```json
{
  "tamanho": "G",
  "confianca_ia": 98.5,
  "timestamp": 1713000005000
}
```

### 3. Pacote de Segurança (JWT)

* **Descrição:** O "Crachá Digital" gerado pelo MariaDB + Node.js. Exigido pelo middleware para qualquer comando crítico na IHM ou na API. Contém privilégios de acesso (Nível 1, 2 ou 3) e expira a cada turno (8h).

***

## Telas do Sistema

1. Painel do Operador

Focado na execução. Interface limpa com controles grandes, feedback visual de status e barra de progresso da meta.
<img src="frontend/img/painel_de_operacoes.png" ></img>

2. Historico de Ações

Focado na segurança e rastreabilidade. Demonstração de logs recuperados diretamente do MariaDB, com pesquisa dinâmica.
<img src="frontend/img/tela_historico.png" ></img>

3. Painel do Supervisor (Dashboard)

Focado na gestão. Apresenta KPIs detalhados, exportação CSV e alteração de parâmetros de produção.
<img src="frontend/img/tela_supervisor.png" ></img>

***

## Testes Unitários

O projeto inclui uma suíte completa de testes unitários para validar e proteger as regras implementadas contra regressões.

### Como rodar os testes

```bash
# primeira vez
npm install --save-dev

# rodar suíte completa
npm test

# com detalhes
npx jest --runInBand --verbose
```
### Cobertura Atual

* 15 testes totais (100% PASS) abrangendo autenticação, lógica de máquina, estrutura HTML e filtros de histórico.

***

## Como Executar

### Pré-requisitos do Sistema

   1. Node.js (Obrigatório versão v18.0.0 ou superior)

   2. MariaDB (Rodando localmente com o banco de dados embrapac_db)

   3. Eclipse Mosquitto (Serviço MQTT rodando na porta 1883)

### Passos de Instalação

1. Clone o repositório ou baixe os arquivos.

2. Abra o terminal e navegue até a pasta do servidor:

```bash
cd backend
```

3. Instale todas as dependências do projeto automaticamente:

```bash
    npm install
```

4. Inicie o servidor Edge:
   
```bash
    npm start
```

***

### Acessar o Banco de Dados

1. Instale o MariaDB:
   
```Bash
sudo apt install mariadb-server -y
```

2. Ligue o motor do banco:

```Bash
sudo service mariadb start
```
Passo 1: Criar o ficheiro de referência

Dentro da sua pasta backend (junto com o server.js e o .env), crie um novo arquivo chamado init_db.sql (ou database.sql).

Passo 2: Colar o código

Abra esse arquivo recém-criado e cole exatamente o código abaixo. Ele já está documentado para que qualquer desenvolvedor entenda:

```SQL
-- ========================================================
-- SCRIPT DE INICIALIZAÇÃO - EMBRAPAC DB
-- Execute este script no seu MariaDB local para criar 
-- a estrutura básica antes de rodar o servidor Node.js
-- ========================================================

-- Cria o banco de dados se não existir e entra nele
CREATE DATABASE IF NOT EXISTS embrapac_db;
USE embrapac_db;

-- 1. Cria a Tabela de Utilizadores
CREATE TABLE IF NOT EXISTS Usuarios (
    id_login VARCHAR(50) PRIMARY KEY,
    senha VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cargo VARCHAR(50),
    nivel_acesso INT
);

-- 2. Insere os utilizadores padrão do sistema (Seed)
INSERT INTO Usuarios (id_login, senha, nome, cargo, nivel_acesso) 
VALUES 
('operador', 'op123', 'Sr. Agenor', 'Operador', 1),
('admin', 'admin123', 'Sr. Carlos', 'Supervisor', 2)
ON DUPLICATE KEY UPDATE senha=VALUES(senha);

-- (Opcional) 3. Cria a Tabela de Histórico de Logs para evitar erros se o Node tentar gravar antes da hora
CREATE TABLE IF NOT EXISTS Historico_Logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_hora DATETIME,
    evento VARCHAR(255),
    tipo VARCHAR(50),
    usuario_nome VARCHAR(100),
    usuario_cargo VARCHAR(50)
);

-- (Opcional) 4. Cria a Tabela de Turnos
CREATE TABLE IF NOT EXISTS Turno (
    id INT AUTO_INCREMENT PRIMARY KEY,
    maquina_id INT,
    hora_inicio DATETIME,
    hora_fim DATETIME,
    producao_ok INT,
    product_s_count INT,
    product_m_count INT,
    product_l_count INT,
    refugo INT,
    downtime_segundos INT,
    oee_percentual FLOAT,
    turno_ativo BOOLEAN
);
```
***

### Acessar o Sistema

Abra o seu navegador no endereço fornecido pelo servidor (ex: http://localhost:3000/Tela_1_operador.html).
O sistema validará o login no banco de dados gerando um Token JWT válido.

| Perfil | Senha | Nível de Acesso |
| :--- | :---: | ---: |
| Operador | op123 | Nível 1 (Operacional) |
| Supervisor | admin123 | Nível 2 (Gestão Completa) |

(Nota: As senhas acima são os padrões inseridos automaticamente na primeira execução do banco de dados. Recomenda-se alterá-las em produção).

## Histórico de Versões

 *   v3.0 - Industrial Edge Server (Atual): Migração para MariaDB, Implementação de MQTT bidirecional, payloads JSON e Segurança Zero Trust com JWT.

 *   v2.0 - Client-Server: Implementação do Node.js e WebSockets para sincronização de telas.

 *   v1.0 - Gold Master: Simulação local, unificação do protocolo de alarmes e cálculo de OEE.

<p align="center"> Desenvolvido pela Equipe Embarcados 1 - CPQD. </p>