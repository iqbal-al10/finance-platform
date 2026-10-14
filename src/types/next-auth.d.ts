import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      avatar: string | null
      tenantId: string
      tenantSlug: string
      tenantName: string
      branchId: string
      role: string
      permissions: string[]
    } & DefaultSession['user']
  }

  interface User {
    id: string
    avatar: string | null
    tenantId: string
    tenantSlug: string
    tenantName: string
    branchId: string
    role: string
    permissions: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    avatar: string | null
    tenantId: string
    tenantSlug: string
    tenantName: string
    branchId: string
    role: string
    permissions: string[]
    permissionsLastFetched: number
  }
}
