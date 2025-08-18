'use client'

import { useState, useRef, useEffect } from 'react'
import { LogOut, Settings, ChevronDown, Upload, Image } from 'lucide-react'
import { useAuth } from '../contexts/auth-context'
import { cn } from '../lib/utils'
import { JSONParser } from './json-parser'
import { AIParser } from './ai-parser'

export function AvatarDropdown() {
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isAIParserOpen, setIsAIParserOpen] = useState(false)
  const [isJSONParserOpen, setIsJSONParserOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const getInitials = (email: string) => {
    return email.split('@')[0].substring(0, 2).toUpperCase()
  }

  const handleSignOut = async () => {
    setIsOpen(false)
    await signOut()
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center space-x-2 p-2 rounded-lg transition-colors",
          "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isOpen && "bg-gray-100"
        )}
      >
        {/* Avatar Circle */}
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {getInitials(user.email || 'U')}
        </div>
        
        {/* User Email (hidden on mobile) */}
        <span className="hidden sm:block text-sm text-gray-700 max-w-32 truncate">
          {user.email}
        </span>
        
        {/* Dropdown Arrow */}
        <ChevronDown className={cn(
          "w-4 h-4 text-gray-500 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                {getInitials(user.email || 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.email}
                </p>
                <p className="text-xs text-gray-500">
                  User ID: {user.id.substring(0, 8)}...
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* Profile/Settings (placeholder for future) */}
            <button
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="w-4 h-4 mr-3 text-gray-400" />
              Settings
            </button>

            {/* JSON Parser */}
            <button
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => {
                setIsOpen(false)
                setIsJSONParserOpen(true)
              }}
            >
              <Upload className="w-4 h-4 mr-3 text-gray-400" />
              JSON Parser
            </button>

            {/* AI Parser */}
            <button
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => {
                setIsOpen(false)
                setIsAIParserOpen(true)
              }}
            >
              <Image className="w-4 h-4 mr-3 text-gray-400" />
              AI Parser
            </button>

            {/* Divider */}
            <div className="border-t border-gray-100 my-1" />

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      )}
      
      {/* JSON Parser Dialog */}
      <JSONParser
        isOpen={isJSONParserOpen}
        onClose={() => setIsJSONParserOpen(false)} 
      />
      
      {/* AI Parser Dialog */}
      <AIParser
          isOpen={isAIParserOpen}
          onClose={() => setIsAIParserOpen(false)} 
      />
    </div>
  )
}