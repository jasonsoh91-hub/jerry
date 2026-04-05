"use client";

import { useRef } from "react";
import ExportButton from "@/components/ExportButton";

export default function Dashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Export Controls */}
      <div className="max-w-7xl mx-auto mb-8 flex gap-4">
        <ExportButton
          dashboardRef={dashboardRef}
          aspectRatio="1:1"
          label="Export 1:1 (Square)"
          className="bg-blue-600 hover:bg-blue-700"
        />
        <ExportButton
          dashboardRef={dashboardRef}
          aspectRatio="3:4"
          label="Export 3:4 (Portrait)"
          className="bg-green-600 hover:bg-green-700"
        />
      </div>

      {/* Dashboard Container - Capturable Area */}
      <div
        ref={dashboardRef}
        className="max-w-7xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-purple-600">J</span>
              </div>
              <h1 className="text-2xl font-bold">Jerry Dashboard</h1>
            </div>
            <nav className="flex gap-6">
              <a href="#" className="hover:text-purple-200 transition-colors">Products</a>
              <a href="#" className="hover:text-purple-200 transition-colors">Analytics</a>
              <a href="#" className="hover:text-purple-200 transition-colors">Settings</a>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
              <div className="text-sm text-blue-600 font-medium mb-2">Total Revenue</div>
              <div className="text-3xl font-bold text-blue-900">$24,780</div>
              <div className="text-sm text-blue-600 mt-2">↑ 12.5% from last month</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
              <div className="text-sm text-purple-600 font-medium mb-2">Active Products</div>
              <div className="text-3xl font-bold text-purple-900">1,284</div>
              <div className="text-sm text-purple-600 mt-2">↑ 8.2% from last month</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
              <div className="text-sm text-green-600 font-medium mb-2">Orders</div>
              <div className="text-3xl font-bold text-green-900">486</div>
              <div className="text-sm text-green-600 mt-2">↑ 23.1% from last month</div>
            </div>
          </div>

          {/* Product Showcase */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Featured Products</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-gray-400 text-lg">Product Image</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Premium Wireless Headphones</h3>
                <p className="text-sm text-gray-600 mb-3">High-quality sound with noise cancellation</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-purple-600">$299</span>
                  <span className="text-sm text-gray-500">In Stock: 45</span>
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-gray-400 text-lg">Product Image</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Smart Watch Pro</h3>
                <p className="text-sm text-gray-600 mb-3">Fitness tracking with heart rate monitor</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-purple-600">$199</span>
                  <span className="text-sm text-gray-500">In Stock: 78</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Orders</h2>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#ORD-2847</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Premium Wireless Headphones</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$299</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#ORD-2846</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Smart Watch Pro</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$199</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Processing</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#ORD-2845</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">USB-C Hub</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$79</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Shipped</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Instructions */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-gray-600">
        <p className="text-sm">Click the export buttons above to download the dashboard as an image in different aspect ratios.</p>
      </div>
    </div>
  );
}
