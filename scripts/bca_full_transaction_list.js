const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getBCAFullTransactionList() {
  try {
    console.log('🏦 BCA Complete Transaction List');
    console.log('='.repeat(50));

    // Step 1: Get BCA fund information
    const { data: funds, error: fundsError } = await supabase
      .from('funds')
      .select('*')
      .ilike('name', '%BCA%');

    if (fundsError) {
      throw new Error(`Error fetching funds: ${fundsError.message}`);
    }

    if (!funds || funds.length === 0) {
      console.log('❌ BCA fund not found');
      return;
    }

    const bcaFund = funds[0];
    console.log(`📊 BCA Fund: ${bcaFund.name} (ID: ${bcaFund.id})`);
    console.log(`💰 Current Balance: ${parseFloat(bcaFund.balance).toLocaleString()}`);
    console.log(`📅 Fund Created: ${new Date(bcaFund.created_at).toLocaleDateString()}`);
    console.log('');

    // Step 2: Get all BCA transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('source_of_funds_id', bcaFund.id)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (transactionsError) {
      throw new Error(`Error fetching transactions: ${transactionsError.message}`);
    }

    // Step 3: Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const netFlow = totalIncome - totalExpense;
    const currentBalance = parseFloat(bcaFund.balance);
    const impliedInitialBalance = currentBalance - netFlow;

    console.log('📈 Summary:');
    console.log(`   Total Transactions: ${transactions.length}`);
    console.log(`   Total Income: ${totalIncome.toLocaleString()}`);
    console.log(`   Total Expense: ${totalExpense.toLocaleString()}`);
    console.log(`   Net Flow: ${netFlow.toLocaleString()}`);
    console.log(`   Current Balance: ${currentBalance.toLocaleString()}`);
    console.log(`   Implied Initial Balance: ${impliedInitialBalance.toLocaleString()}`);
    console.log('');

    // Step 4: Display complete transaction list
    console.log('📋 COMPLETE TRANSACTION LIST:');
    console.log('='.repeat(80));
    
    // Add implied initial balance as first entry
    if (impliedInitialBalance > 0) {
      console.log('🔸 IMPLIED INITIAL BALANCE (not recorded as transaction)');
      console.log(`   Date: ${new Date(bcaFund.created_at).toLocaleDateString()}`);
      console.log(`   Type: Initial Balance`);
      console.log(`   Amount: ${impliedInitialBalance.toLocaleString()}`);
      console.log(`   Running Balance: ${impliedInitialBalance.toLocaleString()}`);
      console.log('');
    }

    // Display all actual transactions
    let runningBalance = impliedInitialBalance;
    
    transactions.forEach((transaction, index) => {
      const amount = parseFloat(transaction.amount);
      const isIncome = transaction.type === 'income';
      
      // Update running balance
      if (isIncome) {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }

      console.log(`${index + 1}. ${isIncome ? '💰' : '💸'} ${transaction.type.toUpperCase()}`);
      console.log(`   Date: ${new Date(transaction.date).toLocaleDateString()}`);
      console.log(`   Amount: ${amount.toLocaleString()}`);
      console.log(`   Description: ${transaction.note || transaction.description || 'No description'}`);
      
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Running Balance: ${runningBalance.toLocaleString()}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('📊 FINAL SUMMARY:');
    console.log(`   Final Running Balance: ${runningBalance.toLocaleString()}`);
    console.log(`   Database Balance: ${currentBalance.toLocaleString()}`);
    console.log(`   Difference: ${(currentBalance - runningBalance).toLocaleString()}`);
    
    if (Math.abs(currentBalance - runningBalance) < 1) {
      console.log('   ✅ Balances match!');
    } else {
      console.log('   ⚠️  Balance discrepancy detected');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getBCAFullTransactionList();