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

async function analyzeBCABalance() {
  try {
    console.log('🔍 Starting comprehensive BCA balance analysis...');
    console.log('=' .repeat(60));
    
    // Step 1: List all funds first to find BCA
    console.log('\n📊 Step 1: Available Funds');
    const { data: allFunds, error: allFundsError } = await supabase
      .from('funds')
      .select('*')
      .order('name');
    
    if (allFundsError) {
      console.error('❌ Could not fetch funds:', allFundsError.message);
      return;
    }
    
    console.log(`Found ${allFunds?.length || 0} funds:`);
    if (allFunds && allFunds.length > 0) {
      allFunds.forEach(fund => {
        console.log(`  - ${fund.name} (ID: ${fund.id}, Balance: ${fund.balance?.toLocaleString() || 'N/A'})`);
      });
    } else {
      console.log('  No funds found. This might indicate:');
      console.log('  - User not authenticated');
      console.log('  - No funds created yet');
      console.log('  - Database connection issues');
      console.log('  - Row Level Security (RLS) blocking access');
      
      // Try to test basic connection
      console.log('\n🔍 Testing basic database connection...');
      const { data: testData, error: testError } = await supabase
        .from('funds')
        .select('count', { count: 'exact' });
      
      if (testError) {
        console.log(`❌ Database connection test failed: ${testError.message}`);
      } else {
        console.log(`✅ Database connection works. Total funds count: ${testData?.[0]?.count || 0}`);
        console.log('   This suggests RLS is blocking access (user not authenticated)');
      }
      return;
    }
    
    // Find BCA fund
    const bcaFund = allFunds.find(fund => 
      fund.name.toLowerCase().includes('bca') || 
      fund.name.toLowerCase().includes('bank central asia')
    );
    
    if (!bcaFund) {
      console.error('❌ Could not find BCA fund in the list above');
      return;
    }
    
    console.log('\n📊 BCA Fund Information');
    
    console.log(`✅ Found BCA fund: ${bcaFund.name} (ID: ${bcaFund.id})`);
    console.log(`   Current Balance: ${bcaFund.balance?.toLocaleString() || 'N/A'}`);
    console.log(`   Created: ${new Date(bcaFund.created_at).toLocaleDateString()}`);
    
    // Step 2: Get all BCA transactions
    console.log('\n📊 Step 2: BCA Transaction Analysis');
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .eq('source_of_funds_id', bcaFund.id)
      .order('date', { ascending: true });
    
    if (transError) {
      console.error('❌ Error fetching transactions:', transError.message);
      return;
    }
    
    console.log(`✅ Found ${transactions.length} BCA transactions`);
    
    if (transactions.length === 0) {
      console.log('⚠️  No transactions found for BCA');
      return;
    }
    
    // Step 3: Analyze income vs expense
    console.log('\n📊 Step 3: Income vs Expense Analysis');
    let totalIncome = 0;
    let totalExpense = 0;
    let initialBalanceTransactions = [];
    
    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      
      // Check for initial balance transactions
      const notes = (transaction.notes || '').toLowerCase();
      const description = (transaction.description || '').toLowerCase();
      if (notes.includes('initial') || notes.includes('balance') || notes.includes('opening') ||
          description.includes('initial') || description.includes('balance') || description.includes('opening')) {
        initialBalanceTransactions.push(transaction);
      }
      
      if (transaction.type === 'income') {
        totalIncome += amount;
      } else if (transaction.type === 'expense') {
        totalExpense += amount;
      }
    });
    
    console.log(`💰 Total Income: ${totalIncome.toLocaleString()}`);
    console.log(`💸 Total Expense: ${totalExpense.toLocaleString()}`);
    console.log(`📈 Net Flow: ${(totalIncome - totalExpense).toLocaleString()}`);
    
    // Step 4: Check for initial balance
    console.log('\n📊 Step 4: Initial Balance Analysis');
    if (initialBalanceTransactions.length > 0) {
      console.log(`✅ Found ${initialBalanceTransactions.length} potential initial balance transaction(s):`);
      initialBalanceTransactions.forEach((trans, index) => {
        console.log(`   ${index + 1}. Date: ${trans.date}, Amount: ${parseFloat(trans.amount).toLocaleString()}, Type: ${trans.type}`);
        console.log(`      Description: ${trans.description || 'N/A'}`);
        console.log(`      Notes: ${trans.notes || 'N/A'}`);
      });
    } else {
      console.log('⚠️  No explicit initial balance transactions found');
      console.log('   Checking first transaction as potential initial balance...');
      
      const firstTransaction = transactions[0];
      console.log(`   First transaction: ${firstTransaction.date}, Amount: ${parseFloat(firstTransaction.amount).toLocaleString()}, Type: ${firstTransaction.type}`);
      console.log(`   Description: ${firstTransaction.description || 'N/A'}`);
      
      // Check if fund was created with an initial balance
      console.log('\n🔍 Checking fund creation details...');
      console.log(`   Fund created: ${bcaFund.created_at}`);
      console.log(`   Current balance: ${bcaFund.balance.toLocaleString()}`);
      
      // Calculate what the initial balance should have been
      const calculatedInitialBalance = parseFloat(bcaFund.balance) - (totalIncome - totalExpense);
      console.log(`   Implied initial balance: ${calculatedInitialBalance.toLocaleString()}`);
      
      if (calculatedInitialBalance > 0) {
        console.log(`   ⚠️  Missing initial balance transaction of ${calculatedInitialBalance.toLocaleString()}`);
      }
    }
    
    // Step 5: Calculate expected balance
    console.log('\n📊 Step 5: Balance Verification');
    
    // Method 1: Simple calculation (assuming no initial balance)
    const calculatedBalance = totalIncome - totalExpense;
    console.log(`🧮 Calculated Balance (Income - Expense): ${calculatedBalance.toLocaleString()}`);
    
    // Method 2: Transaction-by-transaction calculation
    let runningBalance = 0;
    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      if (transaction.type === 'income') {
        runningBalance += amount;
      } else if (transaction.type === 'expense') {
        runningBalance -= amount;
      }
    });
    console.log(`🧮 Running Balance Calculation: ${runningBalance.toLocaleString()}`);
    
    // Compare with current balance
    const currentBalance = parseFloat(bcaFund.balance) || 0;
    console.log(`💳 Current Balance in Database: ${currentBalance.toLocaleString()}`);
    console.log(`🎯 Target Balance (User Reported): 26,908,065`);
    
    // Step 6: Analysis and recommendations
    console.log('\n📊 Step 6: Analysis Summary');
    console.log('=' .repeat(60));
    
    const difference = currentBalance - calculatedBalance;
    const targetDifference = 26908065 - currentBalance;
    
    if (Math.abs(difference) < 1) {
      console.log('✅ Balance calculation matches database balance!');
    } else {
      console.log(`⚠️  Balance discrepancy detected: ${difference.toLocaleString()}`);
      console.log('   This could indicate:');
      console.log('   - Missing initial balance transaction');
      console.log('   - Unrecorded transactions');
      console.log('   - Data entry errors');
    }
    
    if (Math.abs(targetDifference) < 1) {
      console.log('✅ Current balance matches user reported balance (26,908,065)!');
    } else {
      console.log(`⚠️  Current balance differs from target by: ${targetDifference.toLocaleString()}`);
    }
    
    // Step 7: Transaction date range
    console.log('\n📊 Step 7: Transaction Timeline');
    if (transactions.length > 0) {
      const firstDate = transactions[0].date;
      const lastDate = transactions[transactions.length - 1].date;
      console.log(`📅 First Transaction: ${firstDate}`);
      console.log(`📅 Last Transaction: ${lastDate}`);
      
      const daysDiff = Math.ceil((new Date(lastDate) - new Date(firstDate)) / (1000 * 60 * 60 * 24));
      console.log(`📅 Transaction Period: ${daysDiff} days`);
    }
    
    // Step 8: Monthly breakdown
    console.log('\n📊 Step 8: Monthly Breakdown');
    const monthlyData = {};
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0, count: 0 };
      }
      
      const amount = parseFloat(transaction.amount) || 0;
      if (transaction.type === 'income') {
        monthlyData[monthKey].income += amount;
      } else if (transaction.type === 'expense') {
        monthlyData[monthKey].expense += amount;
      }
      monthlyData[monthKey].count++;
    });
    
    Object.keys(monthlyData).sort().forEach(month => {
      const data = monthlyData[month];
      const net = data.income - data.expense;
      console.log(`   ${month}: Income: ${data.income.toLocaleString()}, Expense: ${data.expense.toLocaleString()}, Net: ${net.toLocaleString()} (${data.count} transactions)`);
    });
    
    console.log('\n🎉 BCA Balance Analysis Complete!');
    console.log('=' .repeat(60));
    
    // Fix the balance if there's a discrepancy
    if (Math.abs(difference) > 1) {
      console.log('\n🔧 FIXING BCA BALANCE...');
      console.log('=' .repeat(60));
      
      const { error: updateError } = await supabase
        .from('funds')
        .update({ balance: calculatedBalance })
        .eq('id', bcaFund.id);
      
      if (updateError) {
        console.error('❌ Error updating fund balance:', updateError);
      } else {
        console.log(`✅ BCA fund balance corrected from ${currentBalance.toLocaleString()} to ${calculatedBalance.toLocaleString()}`);
        console.log('🎉 Balance fix complete!');
      }
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeBCABalance();