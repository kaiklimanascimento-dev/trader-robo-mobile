const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Rota corrigida para v1.0/login para bater exatamente com o seu app
app.post('/v1.0/login', async (req, res) => {
    try {
        console.log(`Ponte Ativa: Conectando na IQ Option para ${req.body.email}`);

        // Faz a ponte direta com a API oficial da IQ Option
        const response = await fetch('https://iqoption.com/api/v1.0/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        // Devolve a resposta real da IQ Option para o seu celular
        res.json(data);
    } catch (error) {
        console.error("Erro na ponte com a IQ Option:", error);
        res.status(500).json({ success: false, message: "Erro interno no servidor Render." });
    }
});

app.listen(PORT, () => console.log(`Servidor Ponte rodando na porta ${PORT}`));
