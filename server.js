const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/v1.0/login', async (req, res) => {
    try {
        const response = await fetch('https://auth.iqoption.com/api/v1.0/login', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://iqoption.com',
                'Referer': 'https://iqoption.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/120.0.0.0'
            },
            body: JSON.stringify(req.body)
        });

        const textData = await response.text();

        try {
            const jsonData = JSON.parse(textData);
            res.json(jsonData);
        } catch (e) {
            res.status(400).json({ success: false, message: "Erro real: " + textData.substring(0, 100) });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: "Erro de conexão: " + error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
