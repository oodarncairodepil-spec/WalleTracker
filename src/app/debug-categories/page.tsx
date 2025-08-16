'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

interface CategoryDebug {
  id: string
  name: string
  type: string
  parent_id: string | null
  user_id: string
}

export default function DebugCategoriesPage() {
  const [categories, setCategories] = useState<CategoryDebug[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true)
        
        // Fetch all categories for the current user
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, type, parent_id, user_id')
          .eq('user_id', user?.id || '')
          .order('name')
        
        if (error) {
          setError(`Database error: ${error.message}`)
          return
        }
        
        setCategories(data || [])
      } catch (err) {
        setError(`Fetch error: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchCategories()
    }
  }, [user])

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Categories</h1>
        <p>Please log in to view categories.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Categories</h1>
        <p>Loading categories...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Categories</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      </div>
    )
  }

  // Group categories
  const mainCategories = categories.filter(cat => !cat.parent_id)
  const subCategories = categories.filter(cat => cat.parent_id)
  
  // Find duplicates
  const nameGroups: { [key: string]: CategoryDebug[] } = {}
  categories.forEach(cat => {
    const key = `${cat.name}_${cat.type}`
    if (!nameGroups[key]) nameGroups[key] = []
    nameGroups[key].push(cat)
  })
  
  const duplicates = Object.entries(nameGroups).filter(([, cats]) => cats.length > 1)
  
  // Transport-related categories
  const transportCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes('transport') || 
    cat.name.toLowerCase().includes('ka bandara') ||
    cat.name.toLowerCase().includes('krl')
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Categories</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Summary</h2>
        <div className="bg-gray-100 p-4 rounded">
          <p><strong>User ID:</strong> {user.id}</p>
          <p><strong>Total Categories:</strong> {categories.length}</p>
          <p><strong>Main Categories:</strong> {mainCategories.length}</p>
          <p><strong>Sub-Categories:</strong> {subCategories.length}</p>
          <p><strong>Duplicates Found:</strong> {duplicates.length}</p>
        </div>
      </div>

      {/* Main Categories */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Main Categories ({mainCategories.length})</h2>
        <div className="bg-white border rounded p-4">
          {mainCategories.length === 0 ? (
            <p className="text-gray-500">No main categories found</p>
          ) : (
            <ul className="space-y-1">
              {mainCategories.map(cat => (
                <li key={cat.id} className="flex justify-between">
                  <span>{cat.name} ({cat.type})</span>
                  <span className="text-gray-500 text-sm">{cat.id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Sub-Categories */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Sub-Categories ({subCategories.length})</h2>
        <div className="bg-white border rounded p-4">
          {subCategories.length === 0 ? (
            <p className="text-gray-500">No sub-categories found</p>
          ) : (
            <ul className="space-y-1">
              {subCategories.map(cat => {
                const parent = mainCategories.find(p => p.id === cat.parent_id)
                return (
                  <li key={cat.id} className="flex justify-between">
                    <span>{cat.name} ({cat.type}) [Parent: {parent?.name || 'Unknown'}]</span>
                    <span className="text-gray-500 text-sm">{cat.id}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Transport Categories */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Transport-Related Categories ({transportCategories.length})</h2>
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          {transportCategories.length === 0 ? (
            <p className="text-gray-500">No transport-related categories found</p>
          ) : (
            <ul className="space-y-1">
              {transportCategories.map(cat => {
                const isSubCategory = !!cat.parent_id
                const parent = isSubCategory ? mainCategories.find(p => p.id === cat.parent_id) : null
                return (
                  <li key={cat.id} className="flex justify-between">
                    <span>
                      {cat.name} ({cat.type}) 
                      {isSubCategory ? ` [Sub of: ${parent?.name || 'Unknown'}]` : ' [Main Category]'}
                    </span>
                    <span className="text-gray-500 text-sm">{cat.id}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Duplicates */}
      {duplicates.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Duplicate Category Names ({duplicates.length})</h2>
          <div className="bg-red-50 border border-red-200 rounded p-4">
            {duplicates.map(([key, cats]) => {
              const [name, type] = key.split('_')
              return (
                <div key={key} className="mb-4">
                  <h3 className="font-medium text-red-800">Duplicate: &quot;{name}&quot; ({type})</h3>
                  <ul className="ml-4 mt-1 space-y-1">
                    {cats.map(cat => {
                      const categoryType = cat.parent_id ? 'Sub-category' : 'Main category'
                      const parent = cat.parent_id ? mainCategories.find(p => p.id === cat.parent_id) : null
                      return (
                        <li key={cat.id} className="text-sm">
                          {categoryType} [ID: {cat.id}]
                          {cat.parent_id && ` [Parent: ${parent?.name || 'Unknown'}]`}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Raw Data */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Raw Data</h2>
        <div className="bg-gray-100 border rounded p-4">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(categories, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}