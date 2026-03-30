const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// 1. INICIALIZAÇÃO DO IO (Precisa vir antes das APIs)
const io = new Server(server, {
    // Adicionei 'PUT' aos métodos permitidos
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] }
});

// ===== 2. BANCO DE DADOS EM MEMÓRIA =====
let estadoMaquina = {
    producao: 0, refugo: 0, meta: 5000, ciclo: 3, status: 'OPERANDO', 
    ultimoUpdate: Date.now(), turnoAtivo: false, horaInicioTurno: '--:--', 
    horaFimTurno: '--:--', horaFalha: '--:--', downtime: 0, oee: 0
};

let historicoLogs = [];

// Dados do seu exemplo (Mantidos intactos)
let linhasProducao = [
    { id: 1, nome: 'Linha A', descricao: 'Principal', status: 'OPERANDO', velocidade: 60, criadoEm: new Date().toISOString() },
    { id: 2, nome: 'Linha B', descricao: 'Secundária', status: 'PARADO', velocidade: 45, criadoEm: new Date().toISOString() }
];
let proximoIdLinha = 3;

// Função Auxiliar de Logs
function registrarLogServidor(evento, tipo) {
    const novoLog = {
        timestamp: Date.now(), data: new Date().toISOString(),
        evento: evento, tipo: tipo, usuario: 'Sistema', cargo: 'Automático'
    };
    historicoLogs.unshift(novoLog);
    if (historicoLogs.length > 300) historicoLogs.pop();
    io.emit('historicoAtualizado', historicoLogs);
}

// ===== 3. COMUNICAÇÃO TEMPO REAL (TELAS IHM) =====
io.on('connection', (socket) => {
    console.log(`[+] Nova tela conectada: ${socket.id}`);

    socket.emit('estadoAtualizado', estadoMaquina);
    socket.emit('historicoAtualizado', historicoLogs);

    socket.on('atualizarEstado', (novoEstado) => {
        estadoMaquina = novoEstado;
        socket.broadcast.emit('estadoAtualizado', estadoMaquina);
    });

    socket.on('registrarLog', (novoLog) => {
        historicoLogs.unshift(novoLog); 
        if (historicoLogs.length > 300) historicoLogs.pop();
        io.emit('historicoAtualizado', historicoLogs); 
    });

    socket.on('disconnect', () => {
        console.log(`[-] Tela desconectada: ${socket.id}`);
    });
});


// ======================================================================
// 🌐 4. API REST v1 - INTEGRAÇÃO COM SISTEMAS EXTERNOS
// ======================================================================

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
    io.emit('linhaProducaoCriada', novaLinha); // Agora funciona sem erro!
    res.status(201).json({ sucesso: true, dados: novaLinha });
});

// --- NOVAS ROTAS DA NOSSA MÁQUINA REAL ---

// Consulta de Status (GET)
app.get('/v1/embrapac/estado', (req, res) => {
    res.json({ sucesso: true, dados: estadoMaquina });
});

// Histórico e Logs (GET)
app.get('/v1/embrapac/logs', (req, res) => {
    res.json({ sucesso: true, total: historicoLogs.length, dados: historicoLogs });
});

// Atualiza Meta e Ciclo com Validação Rigorosa (PUT)
app.put('/v1/embrapac/parametros', (req, res) => {
    const { meta, ciclo } = req.body;
    
    // 1. Validação da Meta
    if (meta !== undefined) {
        const metaNumerica = parseInt(meta);
        // Verifica se não é número, ou se tentaram enviar meta negativa ou zero
        if (isNaN(metaNumerica) || metaNumerica <= 0) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'A meta de produção deve ser um número inteiro maior que zero.' 
            });
        }
        estadoMaquina.meta = metaNumerica;
    }
    
    // 2. Validação do Tempo de Ciclo
    if (ciclo !== undefined) {
        const cicloNumerico = parseInt(ciclo);
        // Verifica se não é número, ou se o ciclo é absurdo (menor que 1s ou maior que 60s)
        if (isNaN(cicloNumerico) || cicloNumerico < 1 || cicloNumerico > 60) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'O tempo de ciclo deve ser um número válido entre 1 e 60 segundos.' 
            });
        }
        estadoMaquina.ciclo = cicloNumerico;
    }
    
    registrarLogServidor(`Parâmetros Alterados via API (Meta: ${estadoMaquina.meta}, Ciclo: ${estadoMaquina.ciclo}s)`, "ALERTA");
    io.emit('estadoAtualizado', estadoMaquina); 
    
    res.json({ 
        sucesso: true, 
        mensagem: 'Parâmetros atualizados e validados com sucesso!',
        dados: estadoMaquina 
    });
});

// Gestão de Turno (POST)
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

// Comandos de Motor (POST)
app.post('/v1/embrapac/comando/iniciar', (req, res) => {
    if (estadoMaquina.status === 'FALHA') return res.status(400).json({ sucesso: false, erro: 'Máquina em falha.' });
    
    estadoMaquina.status = 'OPERANDO';
    estadoMaquina.ultimoUpdate = Date.now();
    
    registrarLogServidor("Comando Remoto API: Iniciar", "NORMAL");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true, mensagem: 'Comando de INÍCIO enviado.' });
});

app.post('/v1/embrapac/comando/parar', (req, res) => {
    estadoMaquina.status = 'PARADO';
    registrarLogServidor("Comando Remoto API: Parar", "NORMAL");
    io.emit('estadoAtualizado', estadoMaquina); 
    res.json({ sucesso: true, mensagem: 'Comando de PARADA enviado.' });
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
    
    if (houveMudanca) io.emit('estadoAtualizado', estadoMaquina);
}, 500);

const PORTA = 3000;
server.listen(PORTA, () => {
    console.log(`[🚀] Servidor EmbraPac rodando na porta http://localhost:${PORTA}`);
    console.log(`[🌐] API REST v1 ativada com sucesso!`);
});