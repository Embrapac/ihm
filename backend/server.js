const jwt = require('jsonwebtoken');
const SECRET_KEY = "EMBRAPAC_SUPER_SECRET_2026"; // Mantenha isso seguro!
const mariadb = require('mariadb'); // MÓDULO NOVO: Motor do MariaDB

// ===== CONEXÃO COM O BANCO DE DADOS MARIADB =====
// Criamos um "Pool" de conexões para aguentar várias abas ao mesmo tempo
const pool = mariadb.createPool({
    host: 'localhost',       // Mude se o banco do seu colega estiver noutro IP
    user: 'root',            // O seu utilizador do MariaDB
    password: 'sua_senha',   // A sua senha do MariaDB
    database: 'embrapac_db', // O nome do banco que vai usar
    connectionLimit: 5
});

// Transforma o seu diagrama PlantUML em Tabelas Reais no MariaDB
async function inicializarTabelas() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('[📦] Banco de Dados MariaDB Conectado com Sucesso!');

        // 1. Tabela de Usuários
        await conn.query(`CREATE TABLE IF NOT EXISTS Usuarios (
            id_login VARCHAR(20) PRIMARY KEY,
            senha VARCHAR(100),
            nome VARCHAR(50),
            cargo VARCHAR(30),
            nivel_acesso INT
        )`);

        const usuariosCadastrados = await conn.query("SELECT COUNT(*) as total FROM Usuarios");
        if (usuariosCadastrados[0].total === 0) {
        await conn.query(`
        INSERT INTO Usuarios (id_login, senha, nome, cargo, nivel_acesso) VALUES 
        ('admin', 'admin123', 'Sr. Carlos', 'Supervisor', 2),
        ('operador', 'op123', 'Sr. Agenor', 'Operador', 1)
    `);
         console.log('[🔐] Usuários padrão inseridos no MariaDB.');
}

        // 2. Tabela da Máquina
        await conn.query(`CREATE TABLE IF NOT EXISTS Maquina (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(50),
            meta INT,
            ciclo_segundos INT,
            status VARCHAR(20)
        )`);

       // 3. Tabela do Turno (Atualizada para o modelo antigo do Hardware)
        await conn.query(`CREATE TABLE IF NOT EXISTS Turno (
            id INT AUTO_INCREMENT PRIMARY KEY,
            maquina_id INT,
            hora_inicio DATETIME,
            hora_fim DATETIME,
            producao_ok INT,
            product_s_count INT, -- Caixa Pequena
            product_m_count INT, -- Caixa Média
            product_l_count INT, -- Caixa Grande
            refugo INT,
            downtime_segundos INT,
            oee_percentual DECIMAL(5,2),
            turno_ativo BOOLEAN,
            FOREIGN KEY(maquina_id) REFERENCES Maquina(id)
        )`);

        // 4. Tabela de Logs de Auditoria
        await conn.query(`CREATE TABLE IF NOT EXISTS Historico_Logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            turno_id INT,
            data_hora DATETIME,
            evento VARCHAR(255),
            tipo VARCHAR(20),
            usuario_nome VARCHAR(50),
            usuario_cargo VARCHAR(30),
            FOREIGN KEY(turno_id) REFERENCES Turno(id)
        )`);

        console.log('[🛠️] Tabelas do Sistema 4.0 verificadas no MariaDB!');
    } catch (err) {
        console.error('[!] Erro Crítico no Banco de Dados:', err);
    } finally {
        if (conn) conn.release(); // Liberta a conexão para não travar o servidor
    }
}

// Inicia a verificação das tabelas assim que o servidor liga
inicializarTabelas();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const fs = require('fs'); 
const path = require('path'); // MÓDULO NOVO: Para encontrar as pastas

const app = express();
app.use(cors());
app.use(express.json());

// ===== MÁGICA DO SERVIDOR WEB (Hospedar o Frontend) =====
// Ensina o Node a entregar os arquivos da pasta 'frontend' que está no nível acima
app.use(express.static(path.join(__dirname, '../frontend')));

const server = http.createServer(app);
// ... (O resto do seu código continua igual a partir daqui)

// 1. INICIALIZAÇÃO DO IO
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] }
});

// ===== 2. SISTEMA DE BACKUP E BANCO DE DADOS EM MEMÓRIA =====
const ARQUIVO_BACKUP = './backup_embrapac.json';

let estadoMaquina = {
    producao: 0, producaoP: 0, producaoM: 0, producaoG: 0,
    refugo: 0, meta: 5000, ciclo: 3, status: 'OPERANDO',  
    ultimoUpdate: Date.now(), turnoAtivo: false, horaInicioTurno: '--:--', 
    horaFimTurno: '--:--', horaFalha: '--:--', downtime: 0, oee: 0,
    motivoParada: ''
};
const mqtt = require('mqtt');

// =================================================================
// 📡 INTEGRAÇÃO OFICIAL DA ARQUITETURA: MQTT (ESP / Visão)
// =================================================================
const clienteMqtt = mqtt.connect('mqtt://localhost:1883', { 
    reconnectPeriod: 5000 // Tenta reconectar a cada 5 segundos se a rede falhar
});

clienteMqtt.on('connect', () => {
    console.log('[🌐 MQTT] Conectado ao Broker! Aguardando Módulo ESP...');
    clienteMqtt.subscribe('embrapac/producao/sensor'); 
});

clienteMqtt.on('error', (erro) => {
    console.warn('[!] Aviso MQTT: Broker não encontrado. O sistema operará no modo IHM isolado.');
});

// Quando o ESP/Câmera publicar uma mensagem, o servidor escuta aqui:
clienteMqtt.on('message', (topico, mensagem) => {
    const payloadBruto = mensagem.toString().trim();
    
    try {
        // 1. Tenta converter o texto que chegou num objeto JSON real
        const pacoteMqtt = JSON.parse(payloadBruto);
        console.log(`[📩 MQTT - ${topico}] JSON Recebido:`, pacoteMqtt);

        if (estadoMaquina.status === 'OPERANDO') {
            
            if (topico === 'embrapac/producao/sensor' && pacoteMqtt.tamanho) {
                
                // 2. Extrai a letra e força para MAIÚSCULA (Resolve o bug do "p" minúsculo!)
                const tamanhoPeca = String(pacoteMqtt.tamanho).toUpperCase();
                
                // 3. Identifica o tamanho e soma no contador específico
                if (tamanhoPeca === 'P') estadoMaquina.producaoP++;
                else if (tamanhoPeca === 'M') estadoMaquina.producaoM++;
                else if (tamanhoPeca === 'G') estadoMaquina.producaoG++;
                else return; // Ignora se vier uma letra que não existe
                
                // 4. Soma no contador GERAL (O que aparece na tela grande)
                estadoMaquina.producao++;
                estadoMaquina.ultimoUpdate = Date.now();
                
                // 5. Trava a máquina se bater a meta
                if (estadoMaquina.producao >= estadoMaquina.meta && estadoMaquina.meta > 0) {
                    estadoMaquina.producao = estadoMaquina.meta;
                    estadoMaquina.status = 'PARADO';
                    registrarLogServidor('Meta atingida pelo sensor óptico. Linha parada.', 'ALERTA');
                }

                // 6. Atualiza a tela e o disco
                io.emit('estadoAtualizado', estadoMaquina);
                salvarBackup(); 
            }
        }
    } catch (erro) {
        // Se a máquina mandar um texto normal em vez de JSON, o Node.js não crasha!
        console.warn(`[!] Aviso: Lixo na rede ou JSON inválido recebido: ${payloadBruto}`);
    }
});
        
      
let historicoLogs = [];

// Dados do seu exemplo (Mantidos intactos)
let linhasProducao = [
    { id: 1, nome: 'Linha A', descricao: 'Principal', status: 'OPERANDO', velocidade: 60, criadoEm: new Date().toISOString() },
    { id: 2, nome: 'Linha B', descricao: 'Secundária', status: 'PARADO', velocidade: 45, criadoEm: new Date().toISOString() }
];
let proximoIdLinha = 3;

// Tenta carregar o backup ao ligar o servidor
try {
    if (fs.existsSync(ARQUIVO_BACKUP)) {
        const dadosSalvos = JSON.parse(fs.readFileSync(ARQUIVO_BACKUP, 'utf8'));
        if (dadosSalvos.estadoMaquina) estadoMaquina = dadosSalvos.estadoMaquina;
        if (dadosSalvos.historicoLogs) historicoLogs = dadosSalvos.historicoLogs;
        console.log('[📦] Backup carregado com sucesso. Sistema restaurado!');
    }
} catch (erro) {
    console.error('[!] Erro ao carregar backup. Iniciando do zero.', erro);
}

// Função para gravar no disco de forma SEGURA (Atomic Write)
function salvarBackup() {
    try {
        const dados = { estadoMaquina, historicoLogs };
        const arquivoTemp = ARQUIVO_BACKUP + '.tmp'; 
        
        // 1. Escreve tudo no arquivo fantasma primeiro
        fs.writeFileSync(arquivoTemp, JSON.stringify(dados, null, 2), 'utf8');
        
        // 2. Substitui o arquivo real instantaneamente (Zero risco de corrupção)
        fs.renameSync(arquivoTemp, ARQUIVO_BACKUP);
    } catch (erro) {
        console.error('[!] Erro ao salvar backup no disco:', erro);
    }
}

// Função Auxiliar de Logs 
function registrarLogServidor(evento, tipo) {
    const novoLog = {
        timestamp: Date.now(), data: new Date().toISOString(),
        evento: evento, tipo: tipo, usuario: 'Sistema', cargo: 'Automático'
    };
    
    historicoLogs.unshift(novoLog);
    if (historicoLogs.length > 300) historicoLogs.pop();
    io.emit('historicoAtualizado', historicoLogs);
    salvarBackup(); // Guarda no ficheiro JSON

    // [!] CORREÇÃO: Guarda silenciosamente na Base de Dados Oficial
    const dataFormatada = novoLog.data.slice(0, 19).replace('T', ' ');
    pool.query(
        `INSERT INTO Historico_Logs (data_hora, evento, tipo, usuario_nome, usuario_cargo) VALUES (?, ?, ?, ?, ?)`,
        [dataFormatada, novoLog.evento, novoLog.tipo, novoLog.usuario, novoLog.cargo]
    ).catch(err => {
        console.error('[!] Falha não-crítica: Não foi possível gravar o log no MariaDB', err.message);
    });
}

// ===== 3. COMUNICAÇÃO TEMPO REAL (TELAS IHM) =====
io.on('connection', (socket) => {
    console.log(`[+] Nova tela conectada: ${socket.id}`);

    socket.emit('estadoAtualizado', estadoMaquina);
    socket.emit('historicoAtualizado', historicoLogs);

   socket.on('atualizarEstado', (pacote) => {
        // Agora o front-end envia um pacote contendo o novo estado e o Token
        const novoEstado = pacote.estado;
        const tokenEnviado = pacote.token;

        try {
            // Se o token for falso, ele cai no catch e a máquina não liga!
            const usuarioAutenticado = jwt.verify(tokenEnviado, SECRET_KEY);
            
            // --- MAGIA DA IOT: COMANDO EM JSON ---
            if (estadoMaquina.status !== novoEstado.status) {
                let pacoteJson = {
                    comando: "",
                    timestamp: Date.now(),
                    origem: usuarioAutenticado.nome // Agora sabemos o NOME de quem apertou o botão!
                };

                if (novoEstado.status === 'OPERANDO') {
                    pacoteJson.comando = "START";
                    clienteMqtt.publish('embrapac/comando/esteira', JSON.stringify(pacoteJson));
                    console.log(`[📡 MQTT] JSON START disparado por ${usuarioAutenticado.nome}`);
                } 
                else if (novoEstado.status === 'PARADO' || novoEstado.status === 'FALHA') {
                    pacoteJson.comando = "STOP";
                    clienteMqtt.publish('embrapac/comando/esteira', JSON.stringify(pacoteJson));
                    console.log(`[📡 MQTT] JSON STOP disparado por ${usuarioAutenticado.nome}`);
                }
            }

            // Salva e avisa os outros computadores
            estadoMaquina = novoEstado;
            socket.broadcast.emit('estadoAtualizado', estadoMaquina);
            salvarBackup(); 

        } catch (erro) {
            console.warn(`[!] Tentativa de fraude detectada no Socket.io da tela ${socket.id}`);
            registrarLogServidor("Comando rejeitado: Token WebSocket inválido", "FALHA");
        }
    });

    socket.on('registrarLog', (novoLog) => {
        historicoLogs.unshift(novoLog); 
        if (historicoLogs.length > 300) historicoLogs.pop();
        io.emit('historicoAtualizado', historicoLogs); 
        salvarBackup(); // Guarda no disco!
    });

    socket.on('disconnect', () => {
        console.log(`[-] Tela desconectada: ${socket.id}`);
        registrarLogServidor("IHM Desconectada da Rede", "INFORME");
    });
});

// ======================================================================
// 🌐 4. API REST v1 - INTEGRAÇÃO COM SISTEMAS EXTERNOS
// ======================================================================

// --- MIDDLEWARE DE SEGURANÇA (API KEY) ---
const CHAVE_MESTRA = "EMBRAPAC-IOT-2026"; 

// --- MIDDLEWARE DE SEGURANÇA (JWT) ---
// Este é o "Segurança da Porta". Ele verifica o crachá de quem tenta usar a API.
function verificarTokenAPI(req, res, next) {
    const headerAuth = req.headers['authorization'];
    // Extrai o token do formato "Bearer eyJhb..."
    const token = headerAuth && headerAuth.split(' ')[1]; 

    if (!token) {
        registrarLogServidor("Bloqueio: Tentativa de acesso sem crachá (Token ausente)", "FALHA");
        return res.status(401).json({ sucesso: false, erro: 'Acesso Negado: Token não fornecido.' });
    }

    try {
        // Tenta abrir o "crachá" usando a nossa chave secreta
        const usuarioDecodificado = jwt.verify(token, SECRET_KEY);
        
        // Se chegou aqui, o crachá é verdadeiro e não expirou!
        req.usuario = usuarioDecodificado; // Guarda os dados do usuário para a rota usar
        next(); // Libera a catraca para o comando passar
        
    } catch (erro) {
        registrarLogServidor("Bloqueio: Tentativa de acesso com crachá falso ou vencido", "FALHA");
        return res.status(403).json({ sucesso: false, erro: 'Acesso Negado: Token inválido ou expirado.' });
    }
}

// Aplica o cadeado em todas as rotas '/v1', mas deixa a rota de '/login' livre!
app.use('/v1/embrapac', verificarTokenAPI);

app.post('/v1/auth/login', async (req, res) => {
    const { login, senha } = req.body;
    let conn;

    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            "SELECT * FROM Usuarios WHERE id_login = ? AND senha = ?", 
            [login, senha]
        );

        if (rows.length > 0) {
            const user = rows[0];
            // Gera o Token com validade de 8 horas
            const token = jwt.sign(
                { id: user.id_login, nivel: user.nivel_acesso, nome: user.nome },
                SECRET_KEY,
                { expiresIn: '8h' }
            );

            res.json({
                sucesso: true,
                token: token,
                user: { nome: user.nome, cargo: user.cargo, nivel: user.nivel_acesso }
            });
        } else {
            res.status(401).json({ sucesso: false, erro: "Credenciais inválidas" });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: "Erro no servidor de autenticação" });
    } finally {
        if (conn) conn.release();
    }
});

// --- ROTAS DO SEU EXEMPLO (Linhas de Produção) ---
app.get('/v1/embrapac/linhaprod', (req, res) => {
    res.json({ sucesso: true, total: linhasProducao.length, dados: linhasProducao });
});

app.get('/v1/embrapac/linhaprod/:id', (req, res) => {
    const linha = linhasProducao.find(l => l.id === parseInt(req.params.id));
    if (!linha) return res.status(404).json({ sucesso: false, erro: 'Linha não encontrada' });
    res.json({ sucesso: true, dados: linha });
});

app.post('/v1/embrapac/linhaprod', (req, res) => {
    const { nome, descricao, status, velocidade } = req.body;
    if (!nome) return res.status(400).json({ sucesso: false, erro: 'Campo "nome" é obrigatório' });
    
    const novaLinha = {
        id: proximoIdLinha++, nome: nome.trim(), descricao: descricao || '',
        status: status || 'PARADO', velocidade: velocidade || 0, criadoEm: new Date().toISOString()
    };
    
    linhasProducao.push(novaLinha);
    io.emit('linhaProducaoCriada', novaLinha); 
    res.status(201).json({ sucesso: true, dados: novaLinha });
});

// --- NOVAS ROTAS DA NOSSA MÁQUINA REAL ---

app.get('/v1/embrapac/estado', (req, res) => {
    res.json({ sucesso: true, dados: estadoMaquina });
});

app.get('/v1/embrapac/logs', (req, res) => {
    res.json({ sucesso: true, total: historicoLogs.length, dados: historicoLogs });
});

app.put('/v1/embrapac/parametros', (req, res) => {
    const { meta, ciclo } = req.body;
    
    if (meta !== undefined) {
        const metaNumerica = parseInt(meta);
        if (isNaN(metaNumerica) || metaNumerica <= 0) {
            return res.status(400).json({ sucesso: false, erro: 'A meta de produção deve ser um número inteiro maior que zero.' });
        }
        estadoMaquina.meta = metaNumerica;
    }
    
    if (ciclo !== undefined) {
        const cicloNumerico = parseInt(ciclo);
        if (isNaN(cicloNumerico) || cicloNumerico < 1 || cicloNumerico > 60) {
            return res.status(400).json({ sucesso: false, erro: 'O tempo de ciclo deve ser um número válido entre 1 e 60 segundos.' });
        }
        estadoMaquina.ciclo = cicloNumerico;
    }
    
    registrarLogServidor(`Parâmetros Alterados via API (Meta: ${estadoMaquina.meta}, Ciclo: ${estadoMaquina.ciclo}s)`, "ALERTA");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true, mensagem: 'Parâmetros atualizados e validados com sucesso!', dados: estadoMaquina });
});

app.post('/v1/embrapac/turno/iniciar', (req, res) => {
    if (estadoMaquina.turnoAtivo) return res.status(400).json({ sucesso: false, erro: 'Já existe um turno.' });
    
    estadoMaquina.turnoAtivo = true;
    estadoMaquina.horaInicioTurno = new Date().toLocaleString('pt-BR');       
    estadoMaquina.tsInicio = Date.now(); 
    estadoMaquina.relatorioPendente = false;
    
    registrarLogServidor("Turno Iniciado via API", "NORMAL");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true, mensagem: 'Turno iniciado' });
});

app.post('/v1/embrapac/turno/encerrar', async (req, res) => {
    if (!estadoMaquina.turnoAtivo) {
        return res.status(400).json({ sucesso: false, erro: 'Não há turno ativo.' });
    }

    // 1. Finaliza os cálculos de tempo
    estadoMaquina.turnoAtivo = false;
    estadoMaquina.horaFimTurno = new Date().toLocaleString('pt-BR');
    estadoMaquina.tsFim = Date.now();
    estadoMaquina.relatorioPendente = true;

    // 2. Gravação no MariaDB (Sincronização com a equipa de Hardware)
    let conn;
    try {
        conn = await pool.getConnection();
        
        const querySQL = `
            INSERT INTO Turno (
                maquina_id, hora_inicio, hora_fim, 
                producao_ok, product_s_count, product_m_count, product_l_count, 
                refugo, downtime_segundos, oee_percentual, turno_ativo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const valores = [
            1, // ID da Máquina (Linha A)
            new Date(estadoMaquina.tsInicio).toISOString().slice(0, 19).replace('T', ' '),
            new Date(estadoMaquina.tsFim).toISOString().slice(0, 19).replace('T', ' '),
            estadoMaquina.producao,
            estadoMaquina.producaoP,
            estadoMaquina.producaoM,
            estadoMaquina.producaoG,
            estadoMaquina.refugo,
            Math.floor(estadoMaquina.downtime),
            estadoMaquina.oee,
            false
        ];

        await conn.query(querySQL, valores);
        console.log('[💾 DB] Turno guardado com sucesso no MariaDB!');
        registrarLogServidor("Turno Encerrado e Guardado no Banco", "NORMAL");

    } catch (err) {
        console.error('[!] Erro ao gravar turno no MariaDB:', err);
        registrarLogServidor("Falha ao gravar turno no Banco de Dados", "FALHA");
    } finally {
        if (conn) conn.release();
    }

    estadoMaquina.producao = 0;
    estadoMaquina.producaoP = 0;
    estadoMaquina.producaoM = 0;
    estadoMaquina.producaoG = 0;
    estadoMaquina.refugo = 0;
    estadoMaquina.downtime = 0;
    estadoMaquina.oee = 0;

    // 3. Atualiza a IHM e guarda o Backup JSON (Segurança em dobro)
    io.emit('estadoAtualizado', estadoMaquina); 
    salvarBackup();

    res.json({ 
        sucesso: true, 
        mensagem: 'Turno encerrado e dados sincronizados com o banco de dados.' 
    });
});

app.post('/v1/embrapac/comando/iniciar', (req, res) => {
    if (estadoMaquina.status === 'FALHA') return res.status(400).json({ sucesso: false, erro: 'Máquina em falha.' });
    
    estadoMaquina.status = 'OPERANDO';
    estadoMaquina.motivoParada = ''; 
    estadoMaquina.ultimoUpdate = Date.now();
    
    registrarLogServidor("Comando Remoto API: Iniciar", "NORMAL");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true, mensagem: 'Comando de INÍCIO enviado.' });
});

app.post('/v1/embrapac/comando/parar', (req, res) => {
    const { motivo } = req.body;
    const motivoTexto = motivo ? motivo : 'Parada Manual (Sem Justificativa)';
    
    estadoMaquina.status = 'PARADO';
    estadoMaquina.motivoParada = motivoTexto; 
    
    registrarLogServidor(`Parada Remota: ${motivoTexto}`, "ALERTA");
    io.emit('estadoAtualizado', estadoMaquina); 
    
    res.json({ sucesso: true, mensagem: 'Comando de PARADA enviado.', motivo_registrado: motivoTexto });
});

// ===== 5. O CÉREBRO DA MÁQUINA (Apenas Cronometria agora) =====
setInterval(() => {
    let houveMudanca = false;
    const agora = Date.now();

    // Calcula APENAS o tempo de máquina parada (Downtime)
    if (estadoMaquina.turnoAtivo && estadoMaquina.status !== 'OPERANDO') {
        if (!estadoMaquina.inicioDowntimeMs) {
            estadoMaquina.inicioDowntimeMs = agora;
            houveMudanca = true;
        }
    } else {
        if (estadoMaquina.inicioDowntimeMs) {
            estadoMaquina.downtime += (agora - estadoMaquina.inicioDowntimeMs) / 1000;
            estadoMaquina.inicioDowntimeMs = null;
            houveMudanca = true;
        }
    }

    // REMOVEMOS A FABRICAÇÃO VIRTUAL. O Hardware (MQTT) assumiu o comando das peças!

    if (houveMudanca) {
        io.emit('estadoAtualizado', estadoMaquina);
        salvarBackup(); 
    }
}, 500);

const PORTA = 3000;
server.listen(PORTA, () => {
    console.log(`[🚀] Servidor EmbraPac rodando na porta http://localhost:${PORTA}`);
    console.log(`[🔒] API OT Blindada com API-Key e Persistência Ativada!`);
});