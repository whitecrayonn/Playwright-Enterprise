'use client';

import React, {useState} from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Package,
  Search,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Hardware' | 'Security' | 'Software';
  stock: number;
  unitPrice: number;
}

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: '1',
    sku: 'ACM-901',
    name: 'Quantum Edge Gateway',
    category: 'Hardware',
    stock: 42,
    unitPrice: 2400,
  },
  {
    id: '2',
    sku: 'ACM-902',
    name: 'Zero-Trust Firewall Appliance',
    category: 'Security',
    stock: 18,
    unitPrice: 3850,
  },
  {
    id: '3',
    sku: 'ACM-903',
    name: 'Telemetry Rack Sensor',
    category: 'Hardware',
    stock: 64,
    unitPrice: 490,
  },
  {
    id: '4',
    sku: 'ACM-904',
    name: 'Enterprise SSO Bridge',
    category: 'Software',
    stock: 999,
    unitPrice: 1200,
  },
];

export default function ControlledSampleAppPage() {
  const [email, setEmail] = useState('qa.lead@acme.io');
  const [password, setPassword] = useState('••••••••••••');
  const [authenticatedUser, setAuthenticatedUser] = useState('qa.lead@acme.io');
  const [mfaBannerVisible, setMfaBannerVisible] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState('5');
  const [expeditedShipping, setExpeditedShipping] = useState(true);
  const [approvalPressed, setApprovalPressed] = useState(true);
  const [orderStatus, setOrderStatus] = useState('Approved & Dispatched');
  const [latestOrderId, setLatestOrderId] = useState('ORD-2026-8841');
  const [showTestIds, setShowTestIds] = useState(true);

  const filteredInventory = INITIAL_INVENTORY.filter((item) => {
    const matchesCat =
      categoryFilter === 'All' || item.category === categoryFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setAuthenticatedUser(email.trim());
    }
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(quantity) || 1;
    if (numQty > 0) {
      setOrderStatus(
        approvalPressed ? 'Approved & Dispatched' : 'Pending Supervisor Review'
      );
      setLatestOrderId(`ORD-2026-${8841 + Math.floor(numQty)}`);
    }
  };

  return (
    <div
      data-testid="sample-app-root"
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
    >
      {/* Top Bar following clean 3-zone contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Playwright Studio
          </Link>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span
            data-testid="portal-heading"
            className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Acme Cloud Portal — Controlled QA Target App
          </span>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span data-testid="authenticated-user" className="font-mono">
            User: {authenticatedUser}
          </span>
          <span>·</span>
          <span>Environment: Local Target Sandbox</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowTestIds((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            {showTestIds ? 'Hide Locator Overlay' : 'Show Locator Overlay'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome Banner */}
        <section
          data-testid="dashboard-welcome-banner"
          className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Controlled Target Under Test</span>
              <span>·</span>
              <span className="font-mono">Route: /sample-app</span>
              {showTestIds && (
                <>
                  <span>·</span>
                  <code className="text-blue-600 dark:text-blue-400">
                    testid=dashboard-welcome-banner
                  </code>
                </>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Enterprise Hardware Procurement & Inventory System
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Deterministic target application with instrumented locators for verifying visual Playwright test workflows.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="approval-toggle-btn"
              aria-pressed={approvalPressed}
              onClick={() => setApprovalPressed((p) => !p)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                approvalPressed
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5" />
              Supervisor Auto-Approval: {approvalPressed ? 'ON' : 'OFF'}
            </button>
          </div>
        </section>

        {/* Conditional MFA Security Notice */}
        {mfaBannerVisible && (
          <section
            data-testid="mfa-challenge-banner"
            className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-center justify-between gap-4"
          >
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Security Hardware Key Verified:</span>{' '}
              Session authenticated with FIDO2 hardware token.
              {showTestIds && (
                <code className="ml-2 text-xs font-mono text-amber-700 dark:text-amber-300">
                  [testid=mfa-challenge-banner]
                </code>
              )}
            </div>
            <button
              type="button"
              data-testid="acknowledge-banner-btn"
              onClick={() => setMfaBannerVisible(false)}
              className="px-3 py-1.5 text-xs font-medium bg-amber-900 text-white dark:bg-amber-700 rounded-md hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              Acknowledge Banner
            </button>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: SSO Authentication & Order Creation Form */}
          <div className="lg:col-span-5 space-y-6">
            {/* SSO Login Card */}
            <section className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  1. Corporate SSO Session
                </h2>
                {showTestIds && (
                  <code className="text-xs font-mono text-blue-600 dark:text-blue-400">
                    SOP: enterprise-sso-login
                  </code>
                )}
              </div>
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="login-email-input"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Corporate Email
                    {showTestIds && (
                      <code className="ml-2 text-blue-600 dark:text-blue-400">
                        testid=login-email-input
                      </code>
                    )}
                  </label>
                  <input
                    id="login-email-input"
                    data-testid="login-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="login-password-input"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    SSO Vault Credential
                    {showTestIds && (
                      <code className="ml-2 text-blue-600 dark:text-blue-400">
                        testid=login-password-input
                      </code>
                    )}
                  </label>
                  <input
                    id="login-password-input"
                    data-testid="login-password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  data-testid="login-submit-btn"
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-md hover:opacity-90 transition-opacity"
                >
                  Authenticate Session
                </button>
              </form>
            </section>

            {/* Procurement Order Form */}
            <section className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  2. Procurement Requisition Form
                </h2>
                {showTestIds && (
                  <code className="text-xs font-mono text-blue-600 dark:text-blue-400">
                    TC: ACME-TC-101
                  </code>
                )}
              </div>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div>
                  <label
                    htmlFor="quantity-input"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Order Unit Quantity
                    {showTestIds && (
                      <code className="ml-2 text-blue-600 dark:text-blue-400">
                        testid=quantity-input
                      </code>
                    )}
                  </label>
                  <input
                    id="quantity-input"
                    data-testid="quantity-input"
                    type="number"
                    min={1}
                    max={500}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="expedited-shipping-checkbox"
                    checked={expeditedShipping}
                    onChange={(e) => setExpeditedShipping(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>Request Priority Air Freight Dispatch</span>
                  {showTestIds && (
                    <code className="text-xs font-mono text-blue-600 dark:text-blue-400">
                      testid=expedited-shipping-checkbox
                    </code>
                  )}
                </label>

                <button
                  type="submit"
                  data-testid="create-order-submit"
                  className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors"
                >
                  Submit Requisition Order
                </button>
              </form>

              {/* Order Output Banner */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Requisition Status:
                  </span>
                  <span
                    data-testid="order-status-badge"
                    className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {orderStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Latest Order Reference:
                  </span>
                  <code
                    data-testid="latest-order-id"
                    className="font-mono font-semibold text-slate-900 dark:text-white"
                  >
                    {latestOrderId}
                  </code>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Inventory Catalog Table */}
          <div className="lg:col-span-7 space-y-6">
            <section className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    3. Approved Hardware & Software Catalog
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Target table for <code className="font-mono">assert.count</code> and{' '}
                    <code className="font-mono">act.selectOption</code> steps.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      data-testid="inventory-search-input"
                      aria-label="Search SKU or item name"
                      placeholder="Filter SKU or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <select
                    aria-label="Filter by Category"
                    data-testid="category-filter-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="All">All Categories (4)</option>
                    <option value="Hardware">Hardware (2)</option>
                    <option value="Security">Security (1)</option>
                    <option value="Software">Software (1)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3 font-medium">SKU</th>
                      <th className="py-2.5 px-3 font-medium">Item Name</th>
                      <th className="py-2.5 px-3 font-medium">Category</th>
                      <th className="py-2.5 px-3 font-medium text-right">Stock</th>
                      <th className="py-2.5 px-3 font-medium text-right">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredInventory.map((item) => (
                      <tr
                        key={item.id}
                        data-testid="inventory-row"
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-white">
                          {item.sku}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {item.category}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {item.stock}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                          ${item.unitPrice.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Locator Cheat Sheet Footer */}
              <div
                data-testid="audit-summary-footer"
                className="mt-4 p-3 rounded-md bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              >
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Instrumented Playwright Locators on This Target Page
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-slate-600 dark:text-slate-400">
                  <span>testid=login-email-input</span>
                  <span>testid=login-password-input</span>
                  <span>testid=login-submit-btn</span>
                  <span>testid=dashboard-welcome-banner</span>
                  <span>testid=quantity-input</span>
                  <span>testid=expedited-shipping-checkbox</span>
                  <span>testid=create-order-submit</span>
                  <span>testid=order-status-badge</span>
                  <span>testid=latest-order-id</span>
                  <span>testid=category-filter-select</span>
                  <span>testid=inventory-row</span>
                  <span>testid=approval-toggle-btn</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
