const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Certifique-se de que tem o node-fetch instalado
const app = express();

app.use(cors());
app.use(express.json());

// Log de inicialização para você acompanhar no painel do Render
console.log("Servidor do Trader Robô Mobile Inicializado.");

// ==========================================
// 1. ROTA PARA OBTER HISTÓRICO DE VELAS (CANDLES)
// ==========================================
app.post('/v1.0/candles/history', async (req, res) => {
    const { active_id, period, size, right_edge } = req.body;
    const authHeader = req.headers['authorization'];

    try {
        const response = await fetch('https://iqoption.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader // Repassa o Token/SSID gerado pelo celular
            },
            body: JSON.stringify({ active_id, period, size, right_edge })
        });

        const rawResponse = await response.text();
        let data;
        try {
            data = JSON.parse(rawResponse);
        } catch (e) {
            data = { message: rawResponse };
        }

        if (response.ok) {
            res.json({ isSuccessful: true, data: data });
        } else {
            res.status(response.status).json({ isSuccessful: false, message: rawResponse });
        }
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        res.status(500).json({ isSuccessful: false, message: error.message });
    }
});

// ==========================================
// 2. ROTA PARA ENTRAR NAS OPERAÇÕES (BUY/SELL)
// ==========================================
app.post('/v1.0/place-digital-option', async (req, res) => {
    const { user_balance_id, active_id, direction, amount, expiration_period } = req.body;
    const authHeader = req.headers['authorization'];

    try {
        const response = await fetch('https://iqoption.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({ user_balance_id, active_id, direction, amount, expiration_period })
        });

        const rawResponse = await response.text();
        let data;
        try {
            data = JSON.parse(rawResponse);
        } catch (e) {
            data = { message: rawResponse };
        }

        if (response.ok) {
            res.json({ isSuccessful: true, data: data });
        } else {
            res.status(response.status).json({ isSuccessful: false, message: rawResponse });
        }
    } catch (error) {
        console.error("Erro ao colocar operação:", error);
        res.status(500).json({ isSuccessful: false, message: error.message });
    }
});

// ==========================================
// 3. ROTA PARA CONSULTAR SALDO ATUAL DO PERFIL
// ==========================================
app.get('/v1.0/profile', async (req, res) => {
    const authHeader = req.headers['authorization'];

    try {
        const response = await fetch('https://iqoption.com', {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });

        const rawResponse = await response.text();
        let data;
        try {
            data = JSON.parse(rawResponse);
        } catch (e) {
            data = { message: rawResponse };
        }

        if (response.ok) {
            res.json({ isSuccessful: true, profile: data });
        } else {
            res.status(response.status).json({ isSuccessful: false, message: rawResponse });
        }
    } catch (error) {
        console.error("Erro ao obter perfil:", error);
        res.status(500).json({ isSuccessful: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
