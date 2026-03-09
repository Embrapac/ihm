const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

// Criando o servidor HTTP que o Express e o Socket.io vão compartilhar
const server = http.createServer(app);

// Configurando o Socket.io com permissão de CORS (Porteiro liberando a comunicação)
const io = new Server(server, {
    cors: {
        origin: "*", // Permite que o seu frontend local acesse o servidor
        methods: ["GET", "POST"]
    }
});

// Este é o nosso "Banco de Dados" em memória inicial (baseado no seu master.js)
let estadoMaquina = {
    producao: 0, refugo: 0, meta: 5000, ciclo: 3, status: 'OPERANDO', 
    ultimoUpdate: Date.now(), turnoAtivo: false, horaInicioTurno: '--:--', 
    horaFimTurno: '--:--', horaFalha: '--:--', downtime: 0, oee: 0
};

// --- LÓGICA DE TEMPO REAL (SOCKET.IO) ---
io.on('connection', (socket) => {
    console.log(`[+] Nova tela conectada ao IHM: ${socket.id}`);

    // 1. Assim que a tela (Operador ou Supervisor) conectar, envia o estado atual
    socket.emit('estadoAtualizado', estadoMaquina);

    // 2. Quando alguma tela atualizar algo (ex: Operador apertou Start)
    socket.on('atualizarEstado', (novoEstado) => {
        estadoMaquina = novoEstado; // Atualiza a "fonte da verdade" no servidor
        
        // 3. Avisa TODAS as outras telas instantaneamente (Substitui o storage event)
        socket.broadcast.emit('estadoAtualizado', estadoMaquina);
    });

    socket.on('disconnect', () => {
        console.log(`[-] Tela desconectada: ${socket.id}`);
    });
});

// --- LIGANDO O SERVIDOR ---
const PORTA = 3000;
server.listen(PORTA, () => {
    console.log(`[🚀] Servidor EmbraPac rodando na porta http://localhost:${PORTA}`);
    console.log(`[📡] Socket.io aguardando conexões do Front-end...`);
});