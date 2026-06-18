const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração para permitir que seu site no Chrome converse com a nuvem
app.use(cors({ origin: '*' }));
app.use(express.json());

// Estado inicial do robô guardado na nuvem
let botState = { connected: false, running: false, balance: 0, lucroAtual: 0 };

app.get('/status', (req, res) => res.json(botState));

// Rota que vai receber o E-mail e Senha que você digitar no Chrome
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    console.log(`Tentativa de login recebida para: ${email}`);
    
    // Simulando a conexão com a corretora
    setTimeout(() => {
        botState.connected = true;
        botState.balance = 1000.00; // Saldo inicial simulado da sua banca
        res.json({ success: true, message: "Conectado à corretora!", balance: botState.balance });
    }, 1500);
});

app.post('/api/start', (req, res) => {
    botState.running = true;
    res.json({ success: true, message: "Robô iniciado na nuvem!" });
});

app.post('/api/stop', (req, res) => {
    botState.running = false;
    res.json({ success: true, message: "Robô pausado." });
});

app.listen(PORT, () => console.log(`Servidor do robô rodando na porta ${PORT}`));
