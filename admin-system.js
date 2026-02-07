const fs = require('fs');
const path = require('path');

const ADMIN_CONFIG = {
    username: 'tiktok_admin',
    password: 'Admin@TikTok2024!',
    secret: 'tiktok_admin_token_secreto'
};

class AdminSystem {
    constructor() {
        this.dbPath = path.join(__dirname, 'admin-database.json');
        this.initDatabase();
        console.log('✅ AdminSystem inicializado. DB path:', this.dbPath);
    }

    // Inicializar banco de dados
    initDatabase() {
        if (!fs.existsSync(this.dbPath)) {
            const initialData = {
                payments: [],
                users: [],
                settings: {
                    apiToken: '',
                    accountId: '',
                    smtpServer: '',
                    notificationEmail: ''
                },
                lastUpdate: new Date().toISOString()
            };
            fs.writeFileSync(this.dbPath, JSON.stringify(initialData, null, 2));
            console.log('✅ Banco de dados admin criado:', this.dbPath);
        } else {
            console.log('📁 Banco de dados já existe:', this.dbPath);
        }
    }

    // Carregar banco de dados
    loadDatabase() {
        try {
            const data = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ Erro ao carregar banco de dados:', error.message);
            return { payments: [], users: [], settings: {}, lastUpdate: new Date().toISOString() };
        }
    }

    // Salvar banco de dados
    saveDatabase(data) {
        try {
            data.lastUpdate = new Date().toISOString();
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar banco de dados:', error.message);
            return false;
        }
    }

    // Validar login
    validateLogin(username, password) {
        const isValid = username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password;
        console.log(`🔐 Login: ${username} - ${isValid ? '✅' : '❌'}`);
        return isValid;
    }

    // Validar token
    validateToken(token) {
        const isValid = token === ADMIN_CONFIG.secret;
        if (!isValid) console.log('❌ Token inválido');
        return isValid;
    }

    // Adicionar pagamento
    addPayment(paymentData) {
        try {
            console.log('📋 Tentando registrar pagamento:', paymentData.id);
            
            const db = this.loadDatabase();
            
            const payment = {
                id: paymentData.id || `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                transactionId: paymentData.transactionId || paymentData.id,
                customerName: paymentData.customerName || '',
                customerEmail: paymentData.customerEmail || '',
                customerCpf: paymentData.customerCpf || '',
                amount: paymentData.amount || 21.67,
                status: paymentData.status || 'pending',
                pixCode: paymentData.pixCode || '',
                pixUrl: paymentData.pixUrl || '',
                createdAt: paymentData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                paidAt: paymentData.paidAt || null,
                notes: paymentData.notes || ''
            };

            console.log('📝 Pagamento a ser salvo:', payment);
            
            db.payments.unshift(payment);
            
            // Manter apenas os últimos 1000 pagamentos
            if (db.payments.length > 1000) {
                db.payments = db.payments.slice(0, 1000);
            }

            const saved = this.saveDatabase(db);
            
            if (saved) {
                console.log(`✅ Pagamento ${payment.id} registrado no admin para ${payment.customerName}`);
                return payment;
            } else {
                console.log(`❌ Falha ao salvar pagamento ${payment.id}`);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Erro ao adicionar pagamento:', error);
            return null;
        }
    }

    // Atualizar status do pagamento
    updatePaymentStatus(paymentId, status) {
        try {
            const db = this.loadDatabase();
            const paymentIndex = db.payments.findIndex(p => p.id === paymentId);
            
            if (paymentIndex !== -1) {
                db.payments[paymentIndex].status = status;
                db.payments[paymentIndex].updatedAt = new Date().toISOString();
                
                if (status === 'paid') {
                    db.payments[paymentIndex].paidAt = new Date().toISOString();
                }
                
                this.saveDatabase(db);
                console.log(`✅ Status atualizado: ${paymentId} -> ${status}`);
                return true;
            }
            console.log(`❌ Pagamento não encontrado: ${paymentId}`);
            return false;
        } catch (error) {
            console.error('❌ Erro ao atualizar pagamento:', error);
            return false;
        }
    }

    // Excluir pagamento
    deletePayment(paymentId) {
        try {
            const db = this.loadDatabase();
            const initialLength = db.payments.length;
            
            db.payments = db.payments.filter(p => p.id !== paymentId);
            
            if (db.payments.length < initialLength) {
                this.saveDatabase(db);
                console.log(`✅ Pagamento excluído: ${paymentId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Erro ao excluir pagamento:', error);
            return false;
        }
    }

    // Obter estatísticas
    getStats() {
        const db = this.loadDatabase();
        const payments = db.payments;

        console.log(`📊 Total de pagamentos no banco: ${payments.length}`);

        const totalRevenue = payments
            .filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        const totalPayments = payments.filter(p => p.status === 'paid').length;
        const pendingPayments = payments.filter(p => p.status === 'pending').length;
        const failedPayments = payments.filter(p => p.status === 'failed').length;

        // Gerar dados para gráfico (últimos 7 dias)
        const chartData = {
            labels: [],
            data: []
        };

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayRevenue = payments
                .filter(p => {
                    const paymentDate = p.createdAt.split('T')[0];
                    return paymentDate === dateStr && p.status === 'paid';
                })
                .reduce((sum, p) => sum + (p.amount || 0), 0);
            
            chartData.labels.push(dateStr.substring(5)); // MM-DD
            chartData.data.push(dayRevenue.toFixed(2));
        }

        return {
            totalRevenue: totalRevenue.toFixed(2),
            totalPayments,
            pendingPayments,
            failedPayments,
            totalUsers: new Set(payments.map(p => p.customerEmail)).size,
            chartData: chartData
        };
    }

    // Obter pagamentos recentes
    getRecentPayments(limit = 10) {
        const db = this.loadDatabase();
        const recent = db.payments
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit)
            .map(p => ({
                id: p.id,
                customer_name: p.customerName,
                customer_email: p.customerEmail,
                customer_cpf: p.customerCpf,
                amount: p.amount,
                status: p.status,
                created_at: p.createdAt,
                paid_at: p.paidAt,
                pix_code: p.pixCode ? `${p.pixCode.substring(0, 20)}...` : ''
            }));
        
        console.log(`📋 Retornando ${recent.length} pagamentos recentes`);
        return recent;
    }

    // Obter todos os pagamentos com filtros
    getAllPayments(filter = 'all', page = 1, limit = 50) {
        const db = this.loadDatabase();
        let payments = [...db.payments];

        if (filter !== 'all') {
            payments = payments.filter(p => p.status === filter);
        }

        const total = payments.length;
        const pages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const end = start + limit;

        const paginated = payments
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(start, end)
            .map(p => ({
                id: p.id,
                transaction_id: p.transactionId || p.id,
                customer_name: p.customerName,
                customer_email: p.customerEmail,
                customer_cpf: p.customerCpf,
                amount: p.amount,
                status: p.status,
                created_at: p.createdAt,
                paid_at: p.paidAt,
                pix_code: p.pixCode,
                pix_url: p.pixUrl
            }));

        console.log(`📄 Paginação: página ${page}, total ${total}, mostrando ${paginated.length}`);
        
        return {
            payments: paginated,
            pagination: {
                page,
                limit,
                total,
                pages
            }
        };
    }

    // Obter banco de dados completo
    getDatabase() {
        return this.loadDatabase();
    }

    // Limpar dados
    clearDatabase() {
        const emptyData = {
            payments: [],
            users: [],
            settings: {},
            lastUpdate: new Date().toISOString()
        };
        const success = this.saveDatabase(emptyData);
        if (success) console.log('✅ Banco de dados limpo');
        return success;
    }
}

// Criar instância única
const adminSystem = new AdminSystem();

module.exports = adminSystem;
