// ===== IMPORTAÇÕES GERAIS E SEGURANÇA =====
require('dotenv').config(); // <-- ESSENCIAL: Carrega o arquivo .env
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const fs = require('fs'); 
const path = require('path');
const jwt = require('jsonwebtoken');
const mariadb = require('mariadb');
const mqtt = require('mqtt');

const SECRET_KEY = "EMBRAPAC_SUPER_SECRET_2026";

// ===== 1. CONEXÃO DESACOPLADA COM O MARIADB =====
const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',       
    user: process.env.DB_USER || 'root',            
    password: process.env.DB_PASSWORD || 'sua_senha_aqui',   
    database: process.env.DB_NAME || 'embrapac_db', 
    connectionLimit: 5
});

pool.getConnection()
    .then(conn => {
        console.log('[📦] Conectado com sucesso ao Banco de Dados MariaDB!');
        conn.release();
    })
    .catch(err => {
        console.error('[!] Erro Crítico: Não foi possível conectar ao Banco de Dados.', err.message);
    });

// ===== 2. CONFIGURAÇÃO DO SERVIDOR WEB (EXPRESS) =====
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] }
});

// ===== 3. SISTEMA DE BACKUP E VARIÁVEIS DE MEMÓRIA =====
const ARQUIVO_BACKUP = './backup_embrapac.json';
let historicoLogs = [];
let estadoMaquina = {
    producao: 0, producaoP: 0, producaoM: 0, producaoG: 0,
    refugo: 0, meta: 5000, ciclo: 3, status: 'OPERANDO',  
    ultimoUpdate: Date.now(), turnoAtivo: false, horaInicioTurno: '--:--', 
    horaFimTurno: '--:--', horaFalha: '--:--', downtime: 0, oee: 0,
    motivoParada: ''
};

// Dados mantidos intactos
let linhasProducao = [
    { id: 1, nome: 'Linha A', descricao: 'Principal', status: 'OPERANDO', velocidade: 60, criadoEm: new Date().toISOString() },
    { id: 2, nome: 'Linha B', descricao: 'Secundária', status: 'PARADO', velocidade: 45, criadoEm: new Date().toISOString() }
];
let proximoIdLinha = 3;

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

function salvarBackup() {
    try {
        const dados = { estadoMaquina, historicoLogs };
        const arquivoTemp = ARQUIVO_BACKUP + '.tmp'; 
        fs.writeFileSync(arquivoTemp, JSON.stringify(dados, null, 2), 'utf8');
        fs.renameSync(arquivoTemp, ARQUIVO_BACKUP);
    } catch (erro) {
        console.error('[!] Erro ao salvar backup no disco:', erro);
    }
}

function registrarLogServidor(evento, tipo, usuario_nome = 'Sistema', usuario_cargo = 'Automático') {
    const novoLog = {
        timestamp: Date.now(), data: new Date().toISOString(),
        evento: evento, tipo: tipo, usuario: usuario_nome, cargo: usuario_cargo
    };
    
    historicoLogs.unshift(novoLog);
    if (historicoLogs.length > 300) historicoLogs.pop();
    io.emit('historicoAtualizado', historicoLogs);
    salvarBackup();

    const dataFormatada = novoLog.data.slice(0, 19).replace('T', ' ');
    pool.query(
        `INSERT INTO Historico_Logs (data_hora, evento, tipo, usuario_nome, usuario_cargo) VALUES (?, ?, ?, ?, ?)`,
        [dataFormatada, novoLog.evento, novoLog.tipo, novoLog.usuario, novoLog.cargo]
    ).catch(err => {
        console.error('[!] Falha não-crítica: Não foi possível gravar o log no MariaDB', err.message);
    });
}

// ===== 4. COMUNICAÇÃO IoT (MQTT) =====
// A URL do broker agora vem do ficheiro .env. Se não existir, ele usa o localhost como padrão (fallback).
const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const clienteMqtt = mqtt.connect(brokerUrl, { reconnectPeriod: 5000 });

clienteMqtt.on('connect', () => {
    console.log('[🌐 MQTT] Conectado ao Broker! Aguardando Módulo ESP...');
    clienteMqtt.subscribe('embrapac/producao/sensor'); 
});

clienteMqtt.on('error', (erro) => {
    console.warn('[!] Aviso MQTT: Broker não encontrado. O sistema operará no modo IHM isolado.');
});

clienteMqtt.on('message', (topico, mensagem) => {
    const payloadBruto = mensagem.toString().trim();
    try {
        const pacoteMqtt = JSON.parse(payloadBruto);
        if (estadoMaquina.status === 'OPERANDO' && topico === 'embrapac/producao/sensor' && pacoteMqtt.tamanho) {
            const tamanhoPeca = String(pacoteMqtt.tamanho).toUpperCase();
            
            if (tamanhoPeca === 'P') estadoMaquina.producaoP++;
            else if (tamanhoPeca === 'M') estadoMaquina.producaoM++;
            else if (tamanhoPeca === 'G') estadoMaquina.producaoG++;
            else return; 
            
            estadoMaquina.producao++;
            estadoMaquina.ultimoUpdate = Date.now();
            
            if (estadoMaquina.producao >= estadoMaquina.meta && estadoMaquina.meta > 0) {
                estadoMaquina.producao = estadoMaquina.meta;
                estadoMaquina.status = 'PARADO';
                registrarLogServidor('Meta atingida pelo sensor óptico. Linha parada.', 'ALERTA');
            }
            io.emit('estadoAtualizado', estadoMaquina);
            salvarBackup(); 
        }
    } catch (erro) {
        console.warn(`[!] Aviso: Lixo na rede ou JSON inválido recebido: ${payloadBruto}`);
    }
});

// ===== 5. COMUNICAÇÃO TEMPO REAL (WEBSOCKETS) =====
io.on('connection', (socket) => {
    console.log(`[+] Nova tela conectada: ${socket.id}`);
    socket.emit('estadoAtualizado', estadoMaquina);
    socket.emit('historicoAtualizado', historicoLogs);

    socket.on('atualizarEstado', (pacote) => {
        const novoEstado = pacote.estado;
        const tokenEnviado = pacote.token;

        try {
            const usuarioAutenticado = jwt.verify(tokenEnviado, SECRET_KEY);
            
            if (estadoMaquina.status !== novoEstado.status) {
                let pacoteJson = { comando: "", timestamp: Date.now(), origem: usuarioAutenticado.nome };

                if (novoEstado.status === 'OPERANDO') {
                    pacoteJson.comando = "START";
                    clienteMqtt.publish('embrapac/comando/esteira', JSON.stringify(pacoteJson));
                } 
                else if (novoEstado.status === 'PARADO' || novoEstado.status === 'FALHA') {
                    pacoteJson.comando = "STOP";
                    clienteMqtt.publish('embrapac/comando/esteira', JSON.stringify(pacoteJson));
                }
            }

            estadoMaquina = novoEstado;
            socket.broadcast.emit('estadoAtualizado', estadoMaquina);
            salvarBackup(); 

        } catch (erro) {
            registrarLogServidor("Comando rejeitado: Token WebSocket inválido", "FALHA");
        }
    });

    socket.on('registrarLog', (novoLog) => {
        registrarLogServidor(novoLog.evento, novoLog.tipo, novoLog.usuario, novoLog.cargo);
    });

    socket.on('disconnect', () => {
        console.log(`[-] Tela desconectada: ${socket.id}`);
    });
});

// ===== 6. API REST (JWT E BANCO DE DADOS) =====
function verificarTokenAPI(req, res, next) {
    const headerAuth = req.headers['authorization'];
    const token = headerAuth && headerAuth.split(' ')[1]; 

    if (!token) return res.status(401).json({ sucesso: false, erro: 'Acesso Negado.' });

    try {
        req.usuario = jwt.verify(token, SECRET_KEY);
        next(); 
    } catch (erro) {
        return res.status(403).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
    }
}

app.post('/v1/auth/login', async (req, res) => {
    const { login, senha } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM Usuarios WHERE id_login = ? AND senha = ?", [login, senha]);

        if (rows.length > 0) {
            const user = rows[0];
            const token = jwt.sign({ id: user.id_login, nivel: user.nivel_acesso, nome: user.nome }, SECRET_KEY, { expiresIn: '8h' });
            res.json({ sucesso: true, token: token, user: { nome: user.nome, cargo: user.cargo, nivel: user.nivel_acesso } });
        } else {
            res.status(401).json({ sucesso: false, erro: "Credenciais inválidas" });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: "Erro no servidor de autenticação" });
    } finally {
        if (conn) conn.release();
    }
});

app.use('/v1/embrapac', verificarTokenAPI);

// ROTAS RESTAURADAS
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

app.get('/v1/embrapac/estado', (req, res) => {
    res.json({ sucesso: true, dados: estadoMaquina });
});

app.get('/v1/embrapac/logs', (req, res) => {
    res.json({ sucesso: true, total: historicoLogs.length, dados: historicoLogs });
});

app.put('/v1/embrapac/parametros', (req, res) => {
    const { meta, ciclo } = req.body;
    if (meta !== undefined) estadoMaquina.meta = parseInt(meta);
    if (ciclo !== undefined) estadoMaquina.ciclo = parseInt(ciclo);
    
    registrarLogServidor(`Parâmetros Alterados via API (Meta: ${estadoMaquina.meta}, Ciclo: ${estadoMaquina.ciclo}s)`, "ALERTA");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true, dados: estadoMaquina });
});

app.post('/v1/embrapac/turno/iniciar', (req, res) => {
    if (estadoMaquina.turnoAtivo) return res.status(400).json({ sucesso: false, erro: 'Já existe um turno.' });
    estadoMaquina.turnoAtivo = true;
    estadoMaquina.horaInicioTurno = new Date().toLocaleString('pt-BR');       
    estadoMaquina.tsInicio = Date.now(); 
    estadoMaquina.relatorioPendente = false;
    registrarLogServidor("Turno Iniciado via API", "NORMAL");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true });
});

app.post('/v1/embrapac/turno/encerrar', async (req, res) => {
    if (!estadoMaquina.turnoAtivo) return res.status(400).json({ sucesso: false, erro: 'Não há turno.' });

    estadoMaquina.turnoAtivo = false;
    estadoMaquina.horaFimTurno = new Date().toLocaleString('pt-BR');
    estadoMaquina.tsFim = Date.now();
    estadoMaquina.relatorioPendente = true;

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`
            INSERT INTO Turno (maquina_id, hora_inicio, hora_fim, producao_ok, product_s_count, product_m_count, product_l_count, refugo, downtime_segundos, oee_percentual, turno_ativo) 
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [new Date(estadoMaquina.tsInicio).toISOString().slice(0, 19).replace('T', ' '), new Date(estadoMaquina.tsFim).toISOString().slice(0, 19).replace('T', ' '), estadoMaquina.producao, estadoMaquina.producaoP, estadoMaquina.producaoM, estadoMaquina.producaoG, estadoMaquina.refugo, Math.floor(estadoMaquina.downtime), estadoMaquina.oee]
        );
        registrarLogServidor("Turno Encerrado e Guardado no Banco", "NORMAL");
    } catch (err) {
        registrarLogServidor("Falha ao gravar turno no Banco de Dados", "FALHA");
    } finally {
        if (conn) conn.release();
    }

    estadoMaquina.producao = estadoMaquina.producaoP = estadoMaquina.producaoM = estadoMaquina.producaoG = estadoMaquina.refugo = estadoMaquina.downtime = estadoMaquina.oee = 0;
    io.emit('estadoAtualizado', estadoMaquina); 
    salvarBackup();
    res.json({ sucesso: true });
});

app.post('/v1/embrapac/comando/iniciar', (req, res) => {
    estadoMaquina.status = 'OPERANDO';
    estadoMaquina.motivoParada = ''; 
    estadoMaquina.ultimoUpdate = Date.now();
    registrarLogServidor("Comando Remoto API: Iniciar", "NORMAL");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true });
});

app.post('/v1/embrapac/comando/parar', (req, res) => {
    estadoMaquina.status = 'PARADO';
    estadoMaquina.motivoParada = req.body.motivo || 'Parada Manual'; 
    registrarLogServidor(`Parada Remota: ${estadoMaquina.motivoParada}`, "ALERTA");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true });
});

// ===== 7. LOOP CRONÔMETRO (DOWNTIME) =====
setInterval(() => {
    const agora = Date.now();
    if (estadoMaquina.turnoAtivo && estadoMaquina.status !== 'OPERANDO') {
        if (!estadoMaquina.inicioDowntimeMs) estadoMaquina.inicioDowntimeMs = agora;
    } else if (estadoMaquina.inicioDowntimeMs) {
        estadoMaquina.downtime += (agora - estadoMaquina.inicioDowntimeMs) / 1000;
        estadoMaquina.inicioDowntimeMs = null;
        io.emit('estadoAtualizado', estadoMaquina);
        salvarBackup(); 
    }
}, 500);

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
    console.log(`[🚀] Servidor EmbraPac rodando na porta ${PORTA}`);
});