require('dotenv').config(); // <-- Agora o simulador também lê o .env
const mqtt = require('mqtt');

// Busca as variáveis do .env ou usa o padrão
const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const topicoSensor = process.env.MQTT_TOPIC_SENSOR || 'embrapac/ihm/count';
const topicoComando = process.env.MQTT_TOPIC_COMMAND || 'embrapac/comando/esteira';

const client = mqtt.connect(brokerUrl);
let motorLigado = false; 

let tempoCiclo = 2000; // Padrão: 2 segundos
let intervaloSensor = null; // Guardamos a referência do timer

function iniciarEsteira() {
    if (intervaloSensor) clearInterval(intervaloSensor); // Limpa o anterior se existir
    
    intervaloSensor = setInterval(() => {
        if (motorLigado) {
            const caixas = ['Pequena', 'Media', 'Grande'];
            const sorteio = caixas[Math.floor(Math.random() * caixas.length)];
            const payload = JSON.stringify({ class: sorteio });
            client.publish(topicoSensor, payload);
            console.log(`📦 SENSOR [Ciclo: ${tempoCiclo}ms] -> Leu: ${sorteio}`);
        }
    }, tempoCiclo);
}

client.on('connect', () => {
    console.log(`🟢 Simulador PIC32 conectado ao Broker: ${brokerUrl}`);
    client.subscribe(topicoComando, (err) => {
        if (!err) {
            console.log(`🎧 Ouvindo comandos da IHM no tópico: ${topicoComando}`);
            console.log("⏳ Aguardando Operador iniciar a linha...\n");
        }
    });
});

client.on('message', (topico, mensagem) => {
    if (topico === topicoComando) {
        try {
            const cmd = JSON.parse(mensagem.toString());
            
            // 1. Captura o novo ciclo e REINICIA o motor se ele estiver ligado
            if (cmd.ciclo) {
                tempoCiclo = cmd.ciclo * 1000;
                console.log(`\n⏱️ VELOCIDADE ALTERADA: Agora enviando a cada ${cmd.ciclo}s.`);
                
                // A CHAVE DO PROBLEMA: Se o motor já está rodando, precisamos resetar o timer
                if (motorLigado) {
                    iniciarEsteira(); 
                }
            }

            if (cmd.command === "START") {
                motorLigado = true;
                iniciarEsteira();
                console.log(`\n⚙️ MOTOR LIGADO [Operador: ${cmd.source}]`);
            } 
            else if (cmd.command === "STOP") {
                motorLigado = false;
                if (intervaloSensor) {
                    clearInterval(intervaloSensor);
                    intervaloSensor = null; // Garante que o timer foi destruído
                }
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