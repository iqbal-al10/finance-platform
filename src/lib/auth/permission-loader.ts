import { prisma } from '@/lib/prisma'

// ============================================
// TYPES
// ============================================
export interface LoadPermissionsResult {
  isValid: boolean
  permissions: string[]
  role: string
  reason?:
    | 'USER_NOT_FOUND'
    | 'USER_INACTIVE'
    | 'TENANT_USER_INACTIVE'
    | 'TENANT_INACTIVE'
    | 'ROLE_NOT_FOUND'
    | 'NO_TENANT_USER'
}

// ============================================
// LOAD USER PERMISSIONS FROM DB
// ============================================
//
// Fungsi ini dipanggil dari JWT callback NextAuth untuk:
//   1. Memverifikasi user masih valid (User ACTIVE, tenantUser ACTIVE, tenant ACTIVE/TRIAL)
//   2. Mengambil permissions terbaru dari Role → RolePermission → Permission
//
// Return:
//   - isValid: false  → caller harus logout user (fail-closed)
//   - isValid: true   → token diperbarui dengan permissions & role terbaru
//
export async function loadUserPermissions(
  userId: string,
  tenantId: string
): Promise<LoadPermissionsResult> {
  // --------------------------------------------
  // 1. Cari TenantUser beserta role & permissions
  // --------------------------------------------
  const tenantUser = await prisma.tenantUser.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      tenant: {
        select: {
          status: true,
        },
      },
      user: {
        select: {
          status: true,
        },
      },
    },
  })

  // --------------------------------------------
  // 2. Validasi: TenantUser harus ada
  // --------------------------------------------
  if (!tenantUser) {
    return {
      isValid: false,
      permissions: [],
      role: '',
      reason: 'NO_TENANT_USER',
    }
  }

  // --------------------------------------------
  // 3. Validasi: User harus ACTIVE
  // --------------------------------------------
  if (!tenantUser.user || tenantUser.user.status !== 'ACTIVE') {
    return {
      isValid: false,
      permissions: [],
      role: '',
      reason: 'USER_INACTIVE',
    }
  }

  // --------------------------------------------
  // 4. Validasi: TenantUser harus ACTIVE
  // --------------------------------------------
  if (tenantUser.status !== 'ACTIVE') {
    return {
      isValid: false,
      permissions: [],
      role: '',
      reason: 'TENANT_USER_INACTIVE',
    }
  }

  // --------------------------------------------
  // 5. Validasi: Tenant harus ACTIVE atau TRIAL
  // --------------------------------------------
  if (
    tenantUser.tenant.status !== 'ACTIVE' &&
    tenantUser.tenant.status !== 'TRIAL'
  ) {
    return {
      isValid: false,
      permissions: [],
      role: '',
      reason: 'TENANT_INACTIVE',
    }
  }

  // --------------------------------------------
  // 6. Validasi: Role harus ada
  // --------------------------------------------
  if (!tenantUser.role) {
    return {
      isValid: false,
      permissions: [],
      role: '',
      reason: 'ROLE_NOT_FOUND',
    }
  }

  // --------------------------------------------
  // 7. Extract permissions
  // --------------------------------------------
  const permissions = tenantUser.role.permissions.map(
    (rp) => rp.permission.name
  )

  return {
    isValid: true,
    permissions,
    role: tenantUser.role.name,
  }
}
