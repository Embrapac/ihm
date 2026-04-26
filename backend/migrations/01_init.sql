-- Criação da tabela de utilizadores para o login 
CREATE TABLE IF NOT EXISTS worker (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    login VARCHAR(50),
    passwd VARCHAR(50),
    role VARCHAR(50),
    access_level INT
);

-- Inserção dos utilizadores padrão definidos no master.js
INSERT INTO worker (name, login, passwd, role, access_level) VALUES
('Sr. Agenor', 'operador', 'operador', 'Operador', 1),
('Sr. Carlos', 'admin', 'admin', 'Supervisor', 2);

-- Tabela para o histórico de eventos da IHM 
CREATE TABLE IF NOT EXISTS Historico_Logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_hora DATETIME,
    evento VARCHAR(255),
    tipo VARCHAR(50),
    usuario_nome VARCHAR(100),
    usuario_cargo VARCHAR(50)
);

-- Tabela para os relatórios de fecho de turno 
CREATE TABLE IF NOT EXISTS workshift (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conveyorbelt_id INT,
    start_time DATETIME,
    end_time DATETIME,
    total_count INT,
    small_count INT,
    medium_count INT,
    large_count INT,
    stoppage_count INT,
    waste INT,
    downtime_seconds INT,
    oee_percentage FLOAT,
    active_state INT
);