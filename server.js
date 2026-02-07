const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000; // ⭐ IMPORTANTE!

// ... resto do seu código ...

// ⭐ ADICIONE para servir arquivos estáticos
app.use(express.static('public'));

// ... suas rotas ...

app.listen(PORT, () => {
    console.log(`🚀 API rodando na porta ${PORT}`);
});