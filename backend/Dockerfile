# Usa a versão estável do Node.js
FROM node:20

# Define a pasta de trabalho dentro do container
WORKDIR /app

# Copia os ficheiros de dependências
COPY package*.json ./

# Instala as bibliotecas necessárias (sem o serialport, como padronizámos)
RUN npm install --production

# Copia todo o código do backend
COPY . .

# Expõe a porta 3000 da IHM
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server.js"]