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
    } & DefaultSession['user']
  }

  interface User {
    avatar: string | null
    tenantId: string
    tenantSlug: string
    tenantName: string
    branchId: string
    role: string
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
  }
}
