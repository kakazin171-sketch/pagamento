const adminSystem = require('./admin-system');

console.log('🧪 Testando sistema admin...');

// Testar adicionar pagamento
const testPayment = {
    id: 'TEST_' + Date.now(),
    customerName: 'João Silva',
    customerEmail: 'joao@teste.com',
    customerCpf: '12345678901',
    amount: 21.67,
    status: 'pending',
    pixCode: '000201010212',
    createdAt: new Date().toISOString()
};

console.log('📝 Adicionando pagamento de teste...');
const result = adminSystem.addPayment(testPayment);

if (result) {
    console.log('✅ Pagamento de teste adicionado!');
    
    // Testar estatísticas
    const stats = adminSystem.getStats();
    console.log('📊 Estatísticas:', stats);
    
    // Testar pagamentos recentes
    const recent = adminSystem.getRecentPayments(5);
    console.log('📋 Pagamentos recentes:', recent.length);
} else {
    console.log('❌ Falha ao adicionar pagamento de teste');
}

console.log('🧪 Teste concluído!');