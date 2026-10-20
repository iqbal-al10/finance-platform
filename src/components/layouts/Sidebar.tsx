'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  Package,
  FileText,
  Settings,
  Users,
  Store,
  LogOut,
  ChevronDown,
  ChevronRight,
  Shield,
  CreditCard,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { useSession } from 'next-auth/react'

interface SubMenuItem {
  label: string
  href: string
  roles?: string[]
}

interface MenuItem {
  icon: React.ElementType
  label: string
  href: string
  subItems?: SubMenuItem[]
  roles?: string[]
}

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { tenantTheme, refreshTheme } = useTheme()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-minimized')
    if (saved) {
      setIsMinimized(saved === 'true')
    }
  }, [])

  useEffect(() => {
    if (session?.user?.tenantId) {
      refreshTheme()
    }
  }, [session])

  const toggleMinimize = () => {
    const newState = !isMinimized
    setIsMinimized(newState)
    localStorage.setItem('sidebar-minimized', String(newState))
  }

  const userRole = session?.user?.role || 'STAFF'

  // ============================================
  // MENU ITEMS
  // ============================================
  const menuItems: MenuItem[] = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      href: '/dashboard',
      roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
    },
    {
      icon: ShoppingCart,
      label: 'POS',
      href: '/pos',
      roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'],
    },
    {
      icon: Wallet,
      label: 'Keuangan',
      href: '/finance/incomes',
      roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'],
      subItems: [
        { label: 'Pemasukan', href: '/finance/incomes' },
        { label: 'Pengeluaran', href: '/finance/expenses' },
        { label: 'Kas & Bank', href: '/finance/accounts' },
        { label: 'Transfer', href: '/finance/transfers' },
      ],
    },
    {
      icon: Package,
      label: 'Inventori',
      href: '/inventory/products',
      roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
      subItems: [
        { label: 'Produk', href: '/inventory/products' },
        {
          label: 'Supplier',
          href: '/inventory/suppliers',
          roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'],
        },
        {
          label: 'Pembelian',
          href: '/inventory/purchases',
          roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'],
        },
      ],
    },
    {
      icon: FileText,
      label: 'Laporan',
      href: '/reports',
      roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'],
      subItems: [
        { label: 'Penjualan', href: '/reports/sales' },
        { label: 'Laba Rugi', href: '/reports/profit-loss' },
        { label: 'Cash Flow', href: '/reports/cash-flow' },
        { label: 'Stok', href: '/reports/inventory' },
      ],
    },
    {
      icon: Store,
      label: 'Cabang',
      href: '/branches',
      roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'],
    },
    {
      icon: Users,
      label: 'Pengguna',
      href: '/users',
      roles: ['SUPER_ADMIN', 'OWNER'],
    },
    {
      icon: CreditCard,
      label: 'Subscription',
      href: '/subscription',
      roles: ['SUPER_ADMIN', 'OWNER'],
    },
    {
      icon: Settings,
      label: 'Pengaturan',
      href: '/settings/branding-white-label',
      roles: ['SUPER_ADMIN', 'OWNER'],
      subItems: [
        { label: 'Branding & White Label', href: '/settings/branding-white-label' },
      ],
    },
  ]

  // TAMBAH SUBMENU ADMIN PANEL (khusus SUPER_ADMIN)
  const settingsMenu = menuItems.find((item) => item.label === 'Pengaturan')
  if (settingsMenu && settingsMenu.subItems && userRole === 'SUPER_ADMIN') {
    settingsMenu.subItems.push({
      label: 'Admin Panel',
      href: '/admin',
    })
  }

  const hasMenuAccess = (item: MenuItem): boolean => {
    if (item.roles) {
      return item.roles.includes(userRole)
    }
    return true
  }

  const hasSubMenuAccess = (sub: SubMenuItem): boolean => {
    if (sub.roles) {
      return sub.roles.includes(userRole)
    }
    return true
  }

  const filteredItems = menuItems.filter((item) => hasMenuAccess(item))

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }))
  }

  const isActive = (item: MenuItem) => {
    if (item.href === pathname) return true
    if (item.subItems?.some((sub) => sub.href === pathname)) return true
    return false
  }

  const isSubActive = (item: MenuItem) => {
    return item.subItems?.some((sub) => sub.href === pathname) || false
  }

  const shouldBeExpanded = (item: MenuItem) => {
    if (isSubActive(item)) return true
    return expandedMenus[item.label] || false
  }

  // ============================================
  // THEME DATA
  // ============================================
  const primaryColor = tenantTheme?.primaryColor || '#2563EB'
  const tenantName = tenantTheme?.tenantName || 'Finance Platform'
  const tenantLogo = tenantTheme?.logo || null

  // ============================================
  // HANDLE MENU CLICK
  // ============================================
  const handleMenuClick = (item: MenuItem) => {
    const hasSubItems = item.subItems && item.subItems.length > 0
    if (hasSubItems && !isMinimized) {
      toggleMenu(item.label)
    } else {
      router.push(item.href)
    }
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <aside
      className={`bg-white border-r border-gray-200 min-h-screen flex flex-col transition-all duration-300 ${
        isMinimized ? 'w-16' : 'w-64'
      }`}
    >
      {/* LOGO */}
      <div
        className={`px-3 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors flex items-center ${
          isMinimized ? 'justify-center' : 'justify-between'
        }`}
        onClick={toggleMinimize}
        title={
          isMinimized
            ? 'Klik untuk memperluas sidebar'
            : 'Klik untuk meminimalkan sidebar'
        }
      >
        {!isMinimized ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {tenantLogo ? (
              <img
                src={tenantLogo}
                alt={tenantName}
                className="h-10 w-auto object-contain flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {tenantName?.charAt(0) || 'F'}
              </div>
            )}
            <span
              className="text-lg font-semibold truncate"
              style={{ color: primaryColor }}
            >
              {tenantName}
            </span>
          </div>
        ) : tenantLogo ? (
          <img
            src={tenantLogo}
            alt={tenantName}
            className="h-10 w-10 object-contain rounded"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: primaryColor }}
          >
            {tenantName?.charAt(0) || 'F'}
          </div>
        )}

        {!isMinimized && (
          <span className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2">
            ◀
          </span>
        )}
      </div>

      {/* NAVIGATION */}
      <nav
        className={`flex-1 p-2 space-y-1 overflow-y-auto ${
          isMinimized ? 'px-1' : 'px-2'
        }`}
      >
        {filteredItems.map((item) => {
          const allSubItems = item.subItems || []
          const visibleSubItems = allSubItems.filter(hasSubMenuAccess)
          const hasSubItems = visibleSubItems.length > 0
          const isMenuActive = isActive(item)
          const isExpanded = shouldBeExpanded(item)

          return (
            <div key={item.label}>
              <div
                className={`flex items-center ${
                  isMinimized ? 'justify-center' : 'justify-between'
                } px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isMenuActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => handleMenuClick(item)}
                style={
                  isMenuActive
                    ? {
                        backgroundColor: `${primaryColor}10`,
                        color: primaryColor,
                      }
                    : {}
                }
                title={isMinimized ? item.label : ''}
              >
                <div
                  className={`flex items-center gap-3 ${
                    isMinimized ? 'justify-center' : ''
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {!isMinimized && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </div>
                {!isMinimized && hasSubItems && (
                  <span className="text-gray-400">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                )}
              </div>

              {!isMinimized && hasSubItems && isExpanded && (
                <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 pl-3">
                  {visibleSubItems.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`block px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        pathname === sub.href
                          ? 'text-blue-700 bg-blue-50'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      style={
                        pathname === sub.href
                          ? {
                              backgroundColor: `${primaryColor}10`,
                              color: primaryColor,
                            }
                          : {}
                      }
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* LOGOUT */}
      <div
        className={`p-3 border-t border-gray-200 ${
          isMinimized ? 'flex justify-center' : ''
        }`}
      >
        <button
          onClick={() => signOut()}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors ${
            isMinimized ? 'justify-center' : 'w-full'
          }`}
          title={isMinimized ? 'Logout' : ''}
        >
          <LogOut className="w-5 h-5" />
          {!isMinimized && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
