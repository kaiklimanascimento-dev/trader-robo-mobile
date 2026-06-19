const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/v1.0/login', async (req, res) => {
    const { email, password, account_type } = req.body;
    console.log("Tentando login para:", email);

    try {
        const response = await fetch('https://iqoption.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://iqoption.com',
                'Referer': 'https://iqoption.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({ email, password, account_type })
        });

        // Pega o recado exato e bruto que a IQ Option respondeu (seja texto, erro ou HTML)
        const rawResponse = await response.text();
        console.log("Recado bruto recebido da IQ Option:", rawResponse);

        // Se a resposta for um JSON certinho (sucesso ou erro de senha padrão)
        if (rawResponse.trim().startsWith('{')) {
            const data = JSON.parse(rawResponse);
            if (response.ok) {
                return res.json(data);
            } else {
                return res.status(response.status).json({ 
                    success: false, 
                    message: data.message || "Erro de credenciais na IQ Option." 
                });
            }
        } 
        
        // SE A IQ OPTION MANDAR QUALQUER OUTRO RECADO (como o erro 404, bloqueio ou manutenção):
        // Nós limpamos as tags HTML para enviar apenas o texto limpo do recado para o seu celular
        const recadoLimpo = rawResponse.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        
        return res.status(response.status || 400).json({
            success: false,
            message: `Recado da IQ Option: ${recadoLimpo || "Sem resposta textual do servidor."}`
        });

    } catch (error) {
        console.error("Erro interno do servidor:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erro no servidor Render: " + error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
