'use client'

import { CategoriesPageV2 } from '../../components/categories-page-v2'

export default function TestCategoriesV2() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Categories V2 Test Page
          </h1>
          <p className="text-gray-600">
            Testing the new separate tables structure for categories and subcategories
          </p>
        </div>
        
        <CategoriesPageV2 />
      </div>
    </div>
  )
}