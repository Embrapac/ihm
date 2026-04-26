require('dotenv').config();
const mqtt = require('mqtt');

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const topicoSensor = process.env.MQTT_TOPIC_SENSOR || 'embrapac/ihm/count';
const topicoComando = process.env.MQTT_TOPIC_COMMAND || 'embrapac/comando/esteira';
const topicoStatus = 'embrapac/edge/cbelt/status'; // RESTAURADO: Tópico vital para a IHM e Edge

const client = mqtt.connect(brokerUrl);
let motorLigado = true; 

let tempoCiclo = 2000; 
let intervaloSensor = null; 

// RESTAURADO: Função que avisa a IHM e o Edge sobre o status do motor
function publicarStatus(statusMotor, estadoMotor = 'NORMAL') {
    const payload = JSON.stringify({
        status: statusMotor,
        state: estadoMotor,
        timestamp: new Date().toISOString()
    });
    client.publish(topicoStatus, payload);
    console.log(`📢 STATUS ENVIADO: ${statusMotor} | ${estadoMotor}`);
}

function iniciarEsteira() {
    if (intervaloSensor) clearInterval(intervaloSensor); 
    
    intervaloSensor = setInterval(() => {
        if (motorLigado) {
            const caixas = ['Pequena', 'Media', 'Grande'];
            const sorteio = caixas[Math.floor(Math.random() * caixas.length)];
            
            // RESTAURADO: Simulando a precisão da Visão Computacional exigida pelo Python
            const confidence = (Math.random() * (0.999 - 0.850) + 0.850).toFixed(3);
            
            const payload = JSON.stringify({ 
                class: sorteio,
                confidence: parseFloat(confidence),
                timestamp: Date.now()
            });
            
            client.publish(topicoSensor, payload);
            console.log(`📦 SENSOR [Ciclo: ${tempoCiclo}ms] -> Leu: ${sorteio} (Confiança: ${confidence})`);
        }
    }, tempoCiclo);
}

client.on('connect', () => {
    console.log(`🟢 Simulador PIC32 conectado ao Broker: ${brokerUrl}`);
    client.subscribe(topicoComando, (err) => {
        if (!err) {
            console.log(`🎧 Ouvindo comandos da IHM no tópico: ${topicoComando}`);
            console.log("⏳ Aguardando Operador iniciar a linha...\n");
            
            publicarStatus('ON', 'NORMAL');
        }
    });
});

client.on('message', (topico, mensagem) => {
    if (topico === topicoComando) {
        try {
            const cmd = JSON.parse(mensagem.toString());
            
            // Aceita tanto 'ciclo' quanto 'novoCiclo' para garantir compatibilidade
            const cicloRecebido = cmd.novoCiclo || cmd.ciclo;
            
            if (cicloRecebido) {
                tempoCiclo = cicloRecebido * 1000;
                console.log(`\n⏱️ VELOCIDADE ALTERADA: Agora enviando a cada ${cicloRecebido}s.`);
                if (motorLigado) iniciarEsteira(); 
            }

            if (cmd.command === "START") {
                motorLigado = true;
                iniciarEsteira();
                publicarStatus('ON', 'NORMAL'); // Avisa a IHM que ligou (Habilita botão PARAR)
                console.log(`\n⚙️ MOTOR LIGADO [Fonte: ${cmd.source || 'Operador'}]`);
            } 
            else if (cmd.command === "STOP") {
                motorLigado = false;
                if (intervaloSensor) {
                    clearInterval(intervaloSensor);
                    intervaloSensor = null; 
                }
                publicarStatus('OFF', 'NORMAL'); // Avisa a IHM que desligou
                console.log(`\n🛑 MOTOR DESLIGADO`);
            }
        } catch (e) { 
            console.log("Erro ao processar comando:", e.message); 
        }
    }
});

client.on('error', (err) => {
    console.error("🔴 Erro de conexão MQTT:", err);
});