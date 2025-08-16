'use client'

import { useState } from 'react'
import { Home, History, Wallet, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavbarProps {
  activeTab: 'home' | 'transactions' | 'funds' | 'categories'
  onTabChange: (tab: 'home' | 'transactions' | 'funds' | 'categories') => void
}

export function BottomNavbar({ activeTab, onTabChange }: BottomNavbarProps) {
  const tabs = [
    {
      id: 'home' as const,
      label: 'Home',
      icon: Home
    },
    {
      id: 'transactions' as const,
      label: 'Transaction',
      icon: History
    },
    {
      id: 'funds' as const,
      label: 'Fund',
      icon: Wallet
    },
    {
      id: 'categories' as const,
      label: 'Category',
      icon: Tags
    }
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg transition-colors",
                "min-w-[60px] min-h-[60px]",
                isActive
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className={cn(
                "w-6 h-6 mb-1",
                isActive ? "text-blue-600" : "text-gray-500"
              )} />
              <span className={cn(
                "text-xs font-medium",
                isActive ? "text-blue-600" : "text-gray-500"
              )}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}