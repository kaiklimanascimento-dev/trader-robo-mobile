const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/v1.0/login', async (req, res) => {
    try {
        console.log("Tentando login na IQ Option para:", req.body.email);

        // 1. Mudamos a URL para o servidor de AUTENTICAÇÃO da IQ Option (auth.iqoption.com)
        const response = await fetch('https://auth.iqoption.com/api/v1.0/login', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // 2. Disfarçamos o nosso robô como se fosse o navegador Google Chrome no Windows
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            },
            body: JSON.stringify(req.body)
        });

        const textData = await response.text();
        console.log("Resposta bruta da IQ:", textData);

        try {
            // Tenta converter a resposta para JSON
            const jsonData = JSON.parse(textData);
            res.json(jsonData);
        } catch (e) {
            // Se der erro, mostra o que a IQ Option respondeu
            res.status(400).json({ 
                success: false, 
                message: "IQ Option rejeitou o formato. Resposta: " + textData.substring(0, 150) 
            });
        }

    } catch (error) {
        console.error("Erro no fetch:", error);
        res.status(500).json({ success: false, message: "Erro de conexão: " + error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
