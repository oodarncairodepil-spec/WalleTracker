const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixBCABalance() {
  try {
    console.log('🔍 Analyzing BCA fund balance...');
    
    // Get BCA fund
    const { data: bcaFund, error: fundError } = await supabase
      .from('funds')
      .select('*')
      .eq('name', 'BCA')
      .single();
    
    if (fundError) {
      console.error('❌ Error fetching BCA fund:', fundError);
      return;
    }
    
    console.log(`📊 Current BCA fund balance: ${bcaFund.balance.toLocaleString()}`);
    
    // Get all BCA transactions
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .eq('fund_id', bcaFund.id)
      .order('date', { ascending: true });
    
    if (transError) {
      console.error('❌ Error fetching transactions:', transError);
      return;
    }
    
    console.log(`📝 Found ${transactions.length} BCA transactions`);
    
    // Calculate correct balance from transactions
    let calculatedBalance = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        calculatedBalance += transaction.amount;
        totalIncome += transaction.amount;
      } else if (transaction.type === 'expense') {
        calculatedBalance -= transaction.amount;
        totalExpense += transaction.amount;
      }
    });
    
    console.log(`💰 Total Income: ${totalIncome.toLocaleString()}`);
    console.log(`💸 Total Expense: ${totalExpense.toLocaleString()}`);
    console.log(`🧮 Calculated Balance: ${calculatedBalance.toLocaleString()}`);
    
    const impliedInitialBalance = bcaFund.balance - calculatedBalance;
    console.log(`🔢 Implied Initial Balance: ${impliedInitialBalance.toLocaleString()}`);
    
    if (impliedInitialBalance !== 0) {
      console.log('\n⚠️  ISSUE DETECTED: Fund balance includes an initial balance that was not recorded as a transaction.');
      console.log(`🔧 Correcting BCA fund balance from ${bcaFund.balance.toLocaleString()} to ${calculatedBalance.toLocaleString()}`);
      
      // Update the fund balance to the correct calculated value
      const { error: updateError } = await supabase
        .from('funds')
        .update({ balance: calculatedBalance })
        .eq('id', bcaFund.id);
      
      if (updateError) {
        console.error('❌ Error updating fund balance:', updateError);
        return;
      }
      
      console.log('✅ BCA fund balance has been corrected!');
      console.log(`📊 New balance: ${calculatedBalance.toLocaleString()}`);
    } else {
      console.log('✅ BCA fund balance is already correct!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixBCABalance();