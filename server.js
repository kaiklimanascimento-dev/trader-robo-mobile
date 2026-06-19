const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Rota exata que o seu iqoption-api.js chama no celular
app.post('/v1/login', async (req, res) => {
    try {
        console.log(`Ponte Ativa: Conectando na IQ Option para ${req.body.email}`);

        // O Render faz o acesso direto à IQ Option aqui nos bastidores
        const response = await fetch('https://iqoption.com/api/v1/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        // Devolve a resposta da IQ Option direto para o seu celular
        res.json(data);
    } catch (error) {
        console.error("Erro na ponte com a IQ Option:", error);
        res.status(500).json({ success: false, message: "Erro na nuvem do Render ao tentar conectar." });
    }
});

app.listen(PORT, () => console.log(`Servidor Ponte rodando na porta ${PORT}`));
