'use client'

import { useState } from 'react'
import { BottomNavbar } from './bottom-navbar'
import { Homepage } from './homepage'
import { TransactionHistory } from './transaction-history'
import { FundsPage } from './funds-page'
import { CategoriesPageV2 } from './categories-page-v2'

import { useAuth } from '../contexts/auth-context'

export function MainApp() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'home' | 'transactions' | 'funds' | 'categories'>('home')

  if (!user) {
    return null // This will be handled by the auth form
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home':
        return <Homepage />
      case 'transactions':
        return <TransactionHistory />
      case 'funds':
        return <FundsPage />
      case 'categories':
        return <CategoriesPageV2 />

      default:
        return <Homepage />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main content */}
      <main className="pb-20">
        {renderActiveTab()}
      </main>
      
      {/* Bottom Navigation */}
      <BottomNavbar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
    </div>
  )
}