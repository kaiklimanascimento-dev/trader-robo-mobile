const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/v1.0/login', async (req, res) => {
    try {
        console.log("Tentando login na IQ Option para:", req.body.email);

        const response = await fetch('https://iqoption.com/api/v1.0/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        // 1. Lê a resposta como texto puro primeiro (não quebra o código)
        const textData = await response.text();
        console.log("Resposta bruta da IQ:", textData);

        try {
            // 2. Tenta converter para JSON. Se for um login normal, funciona.
            const jsonData = JSON.parse(textData);
            res.json(jsonData);
        } catch (e) {
            // 3. Se a IQ Option mandar HTML ou erro de segurança, mostramos na tela!
            res.status(400).json({ 
                success: false, 
                message: "IQ Option bloqueou/mudou a rota. Resposta deles: " + textData.substring(0, 150) 
            });
        }

    } catch (error) {
        console.error("Erro no fetch:", error);
        res.status(500).json({ success: false, message: "Erro de conexão: " + error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
