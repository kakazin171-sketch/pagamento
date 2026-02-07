// admin-system.js - SISTEMA ADMIN SEPARADO
// NÃO mexe no server.js principal!

const fs = require('fs');
const path = require('path');

// Configurações do Admin (ALTERE AQUI!)
const ADMIN_CONFIG = {
    username: 'tiktok_admin',
    password: 'Admin@TikTok2024!',
    secret: 'tiktok-admin-secret-2024'
};

// Banco de dados SIMPLES em JSON
const DB_FILE = path.join(__dirname, 'admin-data.json');
let database = {
    payments: [],
    users: [],
    settings: {
        siteName: 'TikTok PIX',
        taxAmount: 21.67,
        mainBalance: 4596.72,
        lastUpdated: new Date().toISOString()
    }
};

// Carregar dados existentes
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            database = JSON.parse(data);
            console.log('📁 Dados admin carregados');
        }
    } catch (err) {
        console.log('📁 Criando novo banco admin');
    }
}

// Salvar dados
function saveDatabase() {
    try {
        database.settings.lastUpdated = new Date().toISOString();
        fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
    } catch (err) {
        console.error('❌ Erro ao salvar admin:', err.message);
    }
}

// Registrar novo pagamento
function addPayment(paymentData) {
    try {
        // Adicionar pagamento
        database.payments.push({
            ...paymentData,
            adminId: `ADM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            adminCreated: new Date().toISOString()
        });
        
        // Adicionar/atualizar usuário
        let user = database.users.find(u => u.cpf === paymentData.customerCpf);
        if (!user) {
            user = {
                id: `USR_${Date.now()}`,
                name: paymentData.customerName,
                email: paymentData.customerEmail,
                cpf: paymentData.customerCpf,
                firstPayment: paymentData.createdAt,
                totalPayments: 1,
                totalSpent: paymentData.amount,
                lastPayment: paymentData.createdAt
            };
            database.users.push(user);
        } else {
            user.totalPayments += 1;
            user.totalSpent += paymentData.amount;
            user.lastPayment = paymentData.createdAt;
        }
        
        saveDatabase();
        console.log(`✅ Pagamento registrado no admin: ${paymentData.id}`);
        
    } catch (err) {
        console.error('❌ Erro ao registrar pagamento:', err.message);
    }
}

// Obter estatísticas
function getStats() {
    const totalPayments = database.payments.length;
    const paidPayments = database.payments.filter(p => p.status === 'paid').length;
    const pendingPayments = database.payments.filter(p => p.status === 'pending').length;
    const totalRevenue = database.payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);
    
    return {
        totalPayments,
        paidPayments,
        pendingPayments,
        totalRevenue: totalRevenue.toFixed(2),
        totalUsers: database.users.length,
        lastUpdated: database.settings.lastUpdated
    };
}

// Obter pagamentos recentes
function getRecentPayments(limit = 10) {
    return database.payments
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(p => ({
            id: p.id,
            customerName: p.customerName,
            customerEmail: p.customerEmail,
            amount: p.amount,
            status: p.status,
            createdAt: p.createdAt,
            pixCode: p.pixCode ? '••••••••••' : null
        }));
}

// Validar login
function validateLogin(username, password) {
    return username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password;
}

// Verificar token
function validateToken(token) {
    return token === ADMIN_CONFIG.secret;
}

// Exportar dados
function exportData(format = 'json') {
    if (format === 'json') {
        return {
            success: true,
            exportedAt: new Date().toISOString(),
            payments: database.payments,
            users: database.users,
            settings: database.settings
        };
    }
    
    return null;
}

// Inicializar
loadDatabase();

// Exportar funções
module.exports = {
    ADMIN_CONFIG,
    addPayment,
    getStats,
    getRecentPayments,
    validateLogin,
    validateToken,
    exportData,
    
    // Para debug
    getDatabase: () => database,
    clearDatabase: () => {
        database = { payments: [], users: [], settings: database.settings };
        saveDatabase();
        return 'Banco limpo!';
    }
};

console.log(`
✅ SISTEMA ADMIN INICIALIZADO
===============================
👤 Usuário: ${ADMIN_CONFIG.username}
🔑 Senha: ${ADMIN_CONFIG.password}
📁 Banco: ${DB_FILE}
📊 Pagamentos: ${database.payments.length}
👥 Usuários: ${database.users.length}
===============================
`);