const ADMIN_CONFIG = {
    username: 'tiktok_admin',
    password: 'Admin@TikTok2024!',
    secret: 'tiktok_admin_token_secreto_' + Date.now()
};

class AdminSystem {
    constructor() {
        // Banco de dados em memória com persistência simples
        this.database = {
            payments: [],
            logs: [],
            statistics: {
                totalRevenue: 0,
                todayRevenue: 0,
                totalPayments: 0,
                todayPayments: 0,
                pendingPayments: 0,
                uniqueCustomers: new Set()
            },
            lastUpdate: new Date().toISOString()
        };
        
        console.log('🚀 Sistema Admin Inicializado - Logs em Tempo Real');
        this.addLog('system', 'Sistema admin inicializado');
    }

    // ========== SISTEMA DE LOGS ==========
    addLog(type, message, data = null) {
        const log = {
            id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type, // 'payment', 'status', 'system', 'error', 'access'
            message: message,
            data: data,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString('pt-BR'),
            date: new Date().toLocaleDateString('pt-BR'),
            ip: 'server'
        };

        this.database.logs.unshift(log);
        
        // Manter apenas últimos 500 logs
        if (this.database.logs.length > 500) {
            this.database.logs = this.database.logs.slice(0, 500);
        }
        
        // Log no console também
        const colors = {
            payment: '🟢',
            status: '🔵',
            system: '⚪',
            error: '🔴',
            access: '🟡'
        };
        console.log(`${colors[type] || '📝'} ${new Date().toLocaleTimeString('pt-BR')} ${message}`);
        
        return log;
    }

    // ========== GERENCIAMENTO DE PAGAMENTOS ==========
    addPayment(paymentData) {
        try {
            const payment = {
                id: paymentData.id || `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                transactionId: paymentData.transactionId || paymentData.id,
                customerName: paymentData.customerName?.trim() || 'Cliente',
                customerEmail: paymentData.customerEmail?.trim() || '',
                customerCpf: this.formatCPF(paymentData.customerCpf || ''),
                amount: parseFloat(paymentData.amount) || 21.67,
                status: 'pending',
                pixCode: paymentData.pixCode || '',
                pixUrl: paymentData.pixUrl || '',
                createdAt: new Date().toISOString(),
                createdTime: new Date().toLocaleTimeString('pt-BR'),
                createdDate: new Date().toLocaleDateString('pt-BR'),
                updatedAt: new Date().toISOString(),
                paidAt: null,
                sessionId: paymentData.sessionId || '',
                userAgent: paymentData.userAgent || '',
                ip: paymentData.ip || ''
            };

            // Adicionar ao banco de dados
            this.database.payments.unshift(payment);
            
            // Atualizar estatísticas
            this.updateStatistics(payment);
            
            // Log detalhado
            this.addLog('payment', `💰 NOVO PIX: ${payment.customerName} - R$ ${payment.amount.toFixed(2)}`, {
                id: payment.id,
                customer: payment.customerName,
                email: payment.customerEmail,
                cpf: payment.customerCpf,
                amount: payment.amount,
                status: payment.status
            });

            // Manter apenas últimos 200 pagamentos
            if (this.database.payments.length > 200) {
                this.database.payments = this.database.payments.slice(0, 200);
            }

            this.database.lastUpdate = new Date().toISOString();
            
            return payment;
            
        } catch (error) {
            this.addLog('error', `Erro ao registrar pagamento: ${error.message}`);
            return null;
        }
    }

    // ========== ATUALIZAR ESTATÍSTICAS ==========
    updateStatistics(payment) {
        const stats = this.database.statistics;
        
        if (payment.status === 'paid') {
            stats.totalRevenue += payment.amount;
            stats.totalPayments++;
            
            // Verificar se é do dia de hoje
            const today = new Date().toDateString();
            const paymentDate = new Date(payment.createdAt).toDateString();
            
            if (today === paymentDate) {
                stats.todayRevenue += payment.amount;
                stats.todayPayments++;
            }
        } else if (payment.status === 'pending') {
            stats.pendingPayments++;
        }
        
        // Adicionar cliente ao conjunto único
        if (payment.customerEmail) {
            stats.uniqueCustomers.add(payment.customerEmail);
        }
    }

    // ========== STATUS E ATUALIZAÇÕES ==========
    updatePaymentStatus(paymentId, status, adminUser = 'admin') {
        const payment = this.database.payments.find(p => p.id === paymentId);
        
        if (payment) {
            const oldStatus = payment.status;
            payment.status = status;
            payment.updatedAt = new Date().toISOString();
            
            if (status === 'paid') {
                payment.paidAt = new Date().toISOString();
                payment.paidTime = new Date().toLocaleTimeString('pt-BR');
                payment.paidDate = new Date().toLocaleDateString('pt-BR');
                
                // Atualizar estatísticas
                this.database.statistics.totalRevenue += payment.amount;
                this.database.statistics.totalPayments++;
                this.database.statistics.pendingPayments = Math.max(0, this.database.statistics.pendingPayments - 1);
            }

            // Log da atualização
            this.addLog('status', `🔄 Status atualizado: ${paymentId} (${oldStatus} → ${status})`, {
                paymentId: paymentId,
                customer: payment.customerName,
                amount: payment.amount,
                oldStatus: oldStatus,
                newStatus: status,
                updatedBy: adminUser
            });

            return true;
        }
        
        this.addLog('error', `Pagamento não encontrado: ${paymentId}`);
        return false;
    }

    // ========== RELATÓRIOS E ESTATÍSTICAS ==========
    getStats() {
        const stats = this.database.statistics;
        const payments = this.database.payments;
        
        // Calcular receita dos últimos 7 dias
        const last7Days = this.getLast7DaysRevenue();
        
        return {
            totalRevenue: stats.totalRevenue.toFixed(2),
            todayRevenue: stats.todayRevenue.toFixed(2),
            totalPayments: stats.totalPayments,
            todayPayments: stats.todayPayments,
            pendingPayments: this.database.payments.filter(p => p.status === 'pending').length,
            uniqueCustomers: stats.uniqueCustomers.size,
            conversionRate: stats.totalPayments > 0 ? 
                ((stats.totalPayments / payments.length) * 100).toFixed(1) : '0.0',
            averageValue: stats.totalPayments > 0 ? 
                (stats.totalRevenue / stats.totalPayments).toFixed(2) : '0.00',
            chartData: {
                labels: last7Days.map(d => d.date),
                data: last7Days.map(d => d.revenue)
            }
        };
    }

    getLast7DaysRevenue() {
        const result = [];
        const payments = this.database.payments;
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            
            const dayRevenue = payments
                .filter(p => {
                    const paymentDate = new Date(p.createdAt);
                    return paymentDate.toDateString() === date.toDateString() && p.status === 'paid';
                })
                .reduce((sum, p) => sum + p.amount, 0);
            
            result.push({
                date: dateStr,
                revenue: parseFloat(dayRevenue.toFixed(2))
            });
        }
        
        return result;
    }

    // ========== BUSCA E FILTROS ==========
    getAllPayments(filter = 'all', page = 1, limit = 20) {
        let payments = [...this.database.payments];

        if (filter !== 'all') {
            payments = payments.filter(p => p.status === filter);
        }

        const total = payments.length;
        const pages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const end = start + limit;

        return {
            payments: payments.slice(start, end),
            pagination: {
                page,
                limit,
                total,
                pages,
                hasNext: page < pages,
                hasPrev: page > 1
            }
        };
    }

    searchPayments(query) {
        const searchTerm = query.toLowerCase();
        return this.database.payments.filter(p => 
            p.customerName.toLowerCase().includes(searchTerm) ||
            p.customerEmail.toLowerCase().includes(searchTerm) ||
            p.customerCpf.includes(searchTerm) ||
            p.id.toLowerCase().includes(searchTerm)
        );
    }

    // ========== LOGS DO SISTEMA ==========
    getLogs(filter = 'all', limit = 50) {
        let logs = [...this.database.logs];

        if (filter !== 'all') {
            logs = logs.filter(log => log.type === filter);
        }

        return logs.slice(0, limit);
    }

    getSystemInfo() {
        return {
            serverTime: new Date().toLocaleString('pt-BR'),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            totalLogs: this.database.logs.length,
            totalPayments: this.database.payments.length,
            lastUpdate: this.database.lastUpdate
        };
    }

    // ========== FUNÇÕES ÚTEIS ==========
    formatCPF(cpf) {
        if (!cpf) return '';
        const cleaned = cpf.replace(/\D/g, '');
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    // ========== VALIDAÇÃO ==========
    validateLogin(username, password) {
        const isValid = username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password;
        this.addLog('access', `🔐 Login ${isValid ? 'bem-sucedido' : 'falhou'}: ${username}`);
        return isValid;
    }

    validateToken(token) {
        return token === ADMIN_CONFIG.secret;
    }

    // ========== LIMPEZA ==========
    clearDatabase() {
        this.database = {
            payments: [],
            logs: [],
            statistics: {
                totalRevenue: 0,
                todayRevenue: 0,
                totalPayments: 0,
                todayPayments: 0,
                pendingPayments: 0,
                uniqueCustomers: new Set()
            },
            lastUpdate: new Date().toISOString()
        };
        
        this.addLog('system', '📁 Banco de dados limpo pelo administrador');
        return true;
    }

    // ========== BACKUP SIMPLES ==========
    exportData() {
        return {
            payments: this.database.payments,
            logs: this.database.logs,
            statistics: {
                ...this.database.statistics,
                uniqueCustomers: Array.from(this.database.statistics.uniqueCustomers)
            },
            exportTime: new Date().toISOString(),
            totalRecords: this.database.payments.length + this.database.logs.length
        };
    }
}

// Exportar instância única
const adminSystem = new AdminSystem();
module.exports = adminSystem;
