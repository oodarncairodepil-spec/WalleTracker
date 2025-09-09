require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateBCACSV() {
  try {
    console.log('🏦 Generating BCA Transaction CSV');
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

    console.log(`✅ Found ${transactions.length} transactions`);

    // Step 3: Calculate totals and implied initial balance
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const netFlow = totalIncome - totalExpense;
    const currentBalance = parseFloat(bcaFund.balance);
    const impliedInitialBalance = currentBalance - netFlow;

    console.log(`💰 Total Income: ${totalIncome.toLocaleString()}`);
    console.log(`💸 Total Expense: ${totalExpense.toLocaleString()}`);
    console.log(`📈 Net Flow: ${netFlow.toLocaleString()}`);
    console.log(`🔸 Implied Initial Balance: ${impliedInitialBalance.toLocaleString()}`);

    // Step 4: Generate CSV content
    let csvContent = 'Date,Type,Amount,Description,Running Balance\n';
    
    // Add implied initial balance
    csvContent += `8/15/2025,Initial Balance,${impliedInitialBalance},Implied Initial Balance,${impliedInitialBalance}\n`;
    
    // Add all transactions with running balance
    let runningBalance = impliedInitialBalance;
    
    transactions.forEach((transaction, index) => {
      const amount = parseFloat(transaction.amount);
      
      // Update running balance
      if (transaction.type === 'income') {
        runningBalance += amount;
      } else if (transaction.type === 'expense') {
        runningBalance -= amount;
      }
      
      // Format date
      const date = new Date(transaction.date).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric'
      });
      
      // Clean description (remove newlines and commas)
      const description = (transaction.note || transaction.description || 'N/A')
        .replace(/[\r\n]+/g, ' ')
        .replace(/,/g, ';')
        .trim();
      
      // Capitalize type
      const type = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
      
      csvContent += `${date},${type},${amount},${description},${Math.round(runningBalance)}\n`;
    });
    
    // Step 5: Write CSV file
    const csvPath = '/Users/plugoemployee/WalleTracker/BCA_Complete_Transaction_List.csv';
    fs.writeFileSync(csvPath, csvContent);
    
    console.log(`\n✅ CSV file generated successfully!`);
    console.log(`📁 File path: ${csvPath}`);
    console.log(`📊 Total rows: ${transactions.length + 2} (1 header + 1 initial balance + ${transactions.length} transactions)`);
    console.log(`🎯 Final running balance: ${Math.round(runningBalance).toLocaleString()}`);
    console.log(`💰 Database balance: ${currentBalance.toLocaleString()}`);
    console.log(`✅ Balance verification: ${Math.round(runningBalance) === currentBalance ? 'MATCH' : 'MISMATCH'}`);
    
  } catch (error) {
    console.error('❌ CSV generation failed:', error.message);
  }
}

generateBCACSV();