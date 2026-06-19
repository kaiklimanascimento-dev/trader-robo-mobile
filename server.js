const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Certifique-se de que tem o node-fetch instalado
const app = express();

app.use(cors());
app.use(express.json());

app.post('/v1.0/login', async (req, res) => {
    const { email, password, account_type } = req.body;
    console.log("Tentando login para:", email);

    try {
        const response = await fetch('https://auth.iqoption.com/api/v1.0/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://iqoption.com',
                'Referer': 'https://iqoption.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({ email, password, account_type })
        });

        // Tenta ler como texto para garantir que pegamos qualquer resposta da IQ
        const rawResponse = await response.text();
        console.log("Resposta bruta da IQ Option:", rawResponse);

        let data;
        try {
            data = JSON.parse(rawResponse);
        } catch (e) {
            data = { message: rawResponse }; // Se não for JSON, usamos o texto bruto
        }

        if (response.ok) {
            res.json(data);
        } else {
            // Se falhar, enviamos o conteúdo exato para o seu telemóvel
            res.status(response.status).json({ 
                success: false, 
                message: rawResponse || "Erro sem mensagem da IQ" 
            });
        }

    } catch (error) {
        console.error("Erro interno do servidor:", error);
        res.status(500).json({ success: false, message: "Erro no servidor: " + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
