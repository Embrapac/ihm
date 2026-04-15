-- Cria o banco de dados se não existir e entra nele
CREATE DATABASE IF NOT EXISTS embrapac_db;
USE embrapac_db;

-- 1. Cria a Tabela de Usuários
CREATE TABLE IF NOT EXISTS Usuarios (
    id_login VARCHAR(50) PRIMARY KEY,
    senha VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cargo VARCHAR(50),
    nivel_acesso INT
);

-- 2. Insere os usuários padrão do sistema
INSERT INTO Usuarios (id_login, senha, nome, cargo, nivel_acesso) 
VALUES 
('operador', 'op123', 'Sr. Agenor', 'Operador', 1),
('admin', 'admin123', 'Sr. Carlos', 'Supervisor', 2)
ON DUPLICATE KEY UPDATE senha=VALUES(senha);

-- 3. Cria a Tabela de Histórico de Logs
CREATE TABLE IF NOT EXISTS Historico_Logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_hora DATETIME,
    evento VARCHAR(255),
    tipo VARCHAR(50),
    usuario_nome VARCHAR(100),
    usuario_cargo VARCHAR(50)
);

-- 4. Cria a Tabela de Turnos
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
