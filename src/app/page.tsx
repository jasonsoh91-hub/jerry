"use client";

import MockupGenerator from "@/components/mockup-generator/MockupGenerator";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 p-2 md:p-4">
      {/* Header */}
      <header className="w-[95%] mx-auto mb-8 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">M</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Product Mockup Generator</h1>
              <p className="text-gray-600 mt-1">
                Generate professional mockups with product information
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Instructions - Now First Section */}
      <div className="w-[95%] mx-auto mb-8 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Upload Product</h3>
              <p className="text-sm text-gray-600">Upload your product image and fill in product information</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Generate & Download</h3>
              <p className="text-sm text-gray-600">Generate professional mockups with default frame and product info</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Generator */}
      <main className="w-[95%] mx-auto px-4">
        <MockupGenerator />
      </main>
    </div>
  );
}
