const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/v1.0/login', async (req, res) => {
    try {
        console.log("Tentando login para:", req.body.email);

        const response = await fetch('https://iqoption.com/api/v1.0/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        // Isto vai mostrar o erro real no log do Render e no teu celular
        console.error("Erro real na ponte:", error);
        res.status(500).json({ success: false, message: "Erro real: " + error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
