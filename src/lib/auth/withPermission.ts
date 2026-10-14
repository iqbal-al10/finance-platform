import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { Permission, hasPermission } from './permissions'

export async function requirePermission(
  permission: Permission,
  request: Request
): Promise<{ authorized: boolean; response?: NextResponse }> {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('🔍 requirePermission - Session:', {
      email: session?.user?.email,
      role: session?.user?.role,
      permissions: session?.user?.permissions,
      tenantId: session?.user?.tenantId,
    })

    if (!session?.user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Unauthorized - Please login' },
          { status: 401 }
        ),
      }
    }

    if (session.user.role === 'SUPER_ADMIN') {
      console.log('✅ SUPER ADMIN granted access')
      return { authorized: true }
    }

    const userPermissions = session.user.permissions as Permission[] || []
    
    console.log(`🔍 Checking permission: ${permission}`, {
      userPermissions,
      has: hasPermission(userPermissions, permission)
    })

    if (!hasPermission(userPermissions, permission)) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: `Forbidden - Insufficient permission: ${permission}` },
          { status: 403 }
        ),
      }
    }

    return { authorized: true }
  } catch (error) {
    console.error('❌ requirePermission error:', error)
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      ),
    }
  }
}
