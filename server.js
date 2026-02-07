const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Configuração correta (SEM chave no código)
const PLUMIFY_CONFIG = {
  apiKey: process.env.PLUMIFY_API_KEY,
  baseURL: process.env.PLUMIFY_API_URL,
  productHash: process.env.PLUMIFY_PRODUCT_HASH
};

app.use(express.json());
app.use(express.static(__dirname));

// 🌐 Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pagamento.html'));
});

// 💰 Criar PIX
app.post('/api/pix/create', async (req, res) => {
  try {
    const { customerName, customerEmail, customerCpf } = req.body;

    if (!customerName || !customerEmail || !customerCpf) {
      return res.status(400).json({ error: 'Preencha todos os dados' });
    }

    const payload = {
      api_token: PLUMIFY_CONFIG.apiKey,
      amount: 2167,
      payment_method: "pix",
      customer: {
        name: customerName,
        email: customerEmail,
        document: customerCpf.replace(/\D/g, '')
      },
      cart: [
        {
          product_hash: PLUMIFY_CONFIG.productHash,
          title: "Pagamento PIX",
          price: 2167,
          quantity: 1
        }
      ]
    };

    const response = await axios.post(
      `${PLUMIFY_CONFIG.baseURL}/transactions`,
      payload
    );

    res.json({
      success: true,
      pix: response.data.pix
    });

  } catch (err) {
    res.status(500).json({
      error: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
