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
    producao: 0, refugo: 0, meta: 5000, ciclo: 3, status: 'OPERANDO', 
    ultimoUpdate: Date.now(), turnoAtivo: false, horaInicioTurno: '--:--', 
    horaFimTurno: '--:--', horaFalha: '--:--', downtime: 0, oee: 0,
    motivoParada: ''
};

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
    salvarBackup(); // Guarda no disco!
}

// ===== 3. COMUNICAÇÃO TEMPO REAL (TELAS IHM) =====
io.on('connection', (socket) => {
    console.log(`[+] Nova tela conectada: ${socket.id}`);

    socket.emit('estadoAtualizado', estadoMaquina);
    socket.emit('historicoAtualizado', historicoLogs);

    socket.on('atualizarEstado', (novoEstado) => {
        estadoMaquina = novoEstado;
        socket.broadcast.emit('estadoAtualizado', estadoMaquina);
        salvarBackup(); // Guarda no disco!
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

function autenticarAPI(req, res, next) {
    const chaveEnviada = req.headers['x-api-key'];
    
    if (chaveEnviada === CHAVE_MESTRA) {
        next(); 
    } else {
        registrarLogServidor("Acesso Bloqueado: Tentativa de Invasão na API", "FALHA");
        res.status(401).json({ 
            sucesso: false, 
            erro: 'Acesso Negado: API Key inválida ou não fornecida.' 
        });
    }
}

app.use('/v1', autenticarAPI);

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

app.post('/v1/embrapac/turno/encerrar', (req, res) => {
    if (!estadoMaquina.turnoAtivo) return res.status(400).json({ sucesso: false, erro: 'Não há turno ativo.' });
    
    estadoMaquina.turnoAtivo = false;
    estadoMaquina.horaFimTurno = new Date().toLocaleString('pt-BR');    
    estadoMaquina.tsFim = Date.now();
    estadoMaquina.relatorioPendente = true;
    
    registrarLogServidor("Turno Encerrado via API", "NORMAL");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true, mensagem: 'Turno encerrado' });
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

// ===== 5. O CÉREBRO DA MÁQUINA (PLC VIRTUAL) =====
setInterval(() => {
    let houveMudanca = false;
    const agora = Date.now();

    if (estadoMaquina.turnoAtivo && estadoMaquina.status !== 'OPERANDO') {
        if (!estadoMaquina.inicioDowntimeMs) {
            estadoMaquina.inicioDowntimeMs = agora;
            houveMudanca = true;
        }
    } else {
        if (estadoMaquina.inicioDowntimeMs) {
            estadoMaquina.downtime += (agora - estadoMaquina.inicioDowntimeMs) / 1000;
            estadoMaquina.inicioDowntimeMs = null;
            estadoMaquina.ultimoUpdate = agora; 
            houveMudanca = true;
        }
    }

    if (estadoMaquina.status === 'OPERANDO') {
        const cicloMs = estadoMaquina.ciclo * 1000;
        if (agora - estadoMaquina.ultimoUpdate >= cicloMs) {
            const delta = agora - estadoMaquina.ultimoUpdate;
            if (delta > 1800000) { 
                estadoMaquina.ultimoUpdate = agora; 
            } else {
                const qtd = Math.floor(delta / cicloMs);
                if (qtd > 0) {
                    const novaProducao = estadoMaquina.producao + qtd;
                    if (novaProducao >= estadoMaquina.meta && estadoMaquina.meta > 0) {
                        estadoMaquina.producao = estadoMaquina.meta;
                        estadoMaquina.status = 'PARADO';
                        registrarLogServidor("Meta de Produção Atingida", "NORMAL");
                    } else {
                        estadoMaquina.producao = novaProducao;
                        estadoMaquina.ultimoUpdate += (qtd * cicloMs);
                    }
                    houveMudanca = true;
                }
            }
        }
    }
    
    if (houveMudanca) {
        io.emit('estadoAtualizado', estadoMaquina);
        salvarBackup(); // Guarda no disco a cada peça produzida!
    }
}, 500);

const PORTA = 3000;
server.listen(PORTA, () => {
    console.log(`[🚀] Servidor EmbraPac rodando na porta http://localhost:${PORTA}`);
    console.log(`[🔒] API OT Blindada com API-Key e Persistência Ativada!`);
});