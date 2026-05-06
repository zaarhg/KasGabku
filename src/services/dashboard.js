import { supabase } from './supabase.js';
import { getDefaultOrganizationId } from './transaksi.js';

export async function getDashboardData() {
    const organizationId = await getDefaultOrganizationId();

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const [
        transactionsResult,
        recentTransactionsResult,
        documentsResult
    ] = await Promise.all([
        supabase
            .from('transactions')
            .select(`
        id,
        proof_number,
        transaction_date,
        period_month,
        period_year,
        type,
        description,
        category_id,
        party_name,
        amount,
        status,
        created_at,
        spending_categories (
          id,
          name
        )
      `)
            .eq('organization_id', organizationId)
            .order('transaction_date', { ascending: false }),

        supabase
            .from('transactions')
            .select(`
        id,
        proof_number,
        transaction_date,
        type,
        description,
        amount,
        status,
        created_at
      `)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(8),

        supabase
            .from('generated_documents')
            .select(`
        id,
        document_type,
        file_name,
        file_url,
        period_month,
        period_year,
        generated_at
      `)
            .eq('organization_id', organizationId)
            .order('generated_at', { ascending: false })
            .limit(6)
    ]);

    if (transactionsResult.error) throw transactionsResult.error;
    if (recentTransactionsResult.error) throw recentTransactionsResult.error;
    if (documentsResult.error) throw documentsResult.error;

    const transactions = transactionsResult.data || [];
    const recentTransactions = recentTransactionsResult.data || [];
    const documents = documentsResult.data || [];

    const finalTransactions = transactions.filter((transaction) => {
        return transaction.status === 'final';
    });

    const currentMonthFinalTransactions = finalTransactions.filter((transaction) => {
        return (
            Number(transaction.period_month) === currentMonth &&
            Number(transaction.period_year) === currentYear
        );
    });

    const totalIncomeAllTime = sumAmount(
        finalTransactions.filter((transaction) => transaction.type === 'masuk')
    );

    const totalExpenseAllTime = sumAmount(
        finalTransactions.filter((transaction) => transaction.type === 'keluar')
    );

    const currentBalance = totalIncomeAllTime - totalExpenseAllTime;

    const currentMonthIncome = sumAmount(
        currentMonthFinalTransactions.filter((transaction) => transaction.type === 'masuk')
    );

    const currentMonthExpense = sumAmount(
        currentMonthFinalTransactions.filter((transaction) => transaction.type === 'keluar')
    );

    const draftCount = transactions.filter((transaction) => {
        return transaction.status === 'draft';
    }).length;

    const canceledCount = transactions.filter((transaction) => {
        return transaction.status === 'dibatalkan';
    }).length;

    const expenseByCategory = buildExpenseByCategory(currentMonthFinalTransactions);

    return {
        period: {
            month: currentMonth,
            year: currentYear
        },
        summary: {
            currentBalance,
            currentMonthIncome,
            currentMonthExpense,
            currentMonthNet: currentMonthIncome - currentMonthExpense,
            draftCount,
            canceledCount,
            finalCount: finalTransactions.length,
            transactionCount: transactions.length
        },
        expenseByCategory,
        recentTransactions,
        documents
    };
}

function sumAmount(rows) {
    return rows.reduce((sum, row) => {
        return sum + Number(row.amount || 0);
    }, 0);
}

function buildExpenseByCategory(transactions) {
    const expenseTransactions = transactions.filter((transaction) => {
        return transaction.type === 'keluar';
    });

    const map = new Map();

    expenseTransactions.forEach((transaction) => {
        const categoryName = transaction.spending_categories?.name || 'Tanpa kategori';
        const current = map.get(categoryName) || 0;

        map.set(categoryName, current + Number(transaction.amount || 0));
    });

    return [...map.entries()]
        .map(([categoryName, amount]) => {
            return {
                categoryName,
                amount
            };
        })
        .sort((a, b) => b.amount - a.amount);
}