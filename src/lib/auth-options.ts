import { type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"
import { loadUserPermissions } from "@/lib/auth/permission-loader"

// ============================================
// CONSTANTS
// ============================================
const PERMISSIONS_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 menit
const PASSWORD_CHECK_INTERVAL_MS = 60 * 1000 // 1 menit

// ============================================
// DEV LOG HELPER
// ============================================
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args)
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // --------------------------------------------
        // 1. Validasi input dasar
        // --------------------------------------------
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // --------------------------------------------
        // 2. Cari user + relasi tenantUsers + role + permissions
        // --------------------------------------------
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            tenantUsers: {
              include: {
                tenant: true,
                branch: true,
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
              where: { status: "ACTIVE" },
              orderBy: { joinedAt: "asc" },
            },
          },
        })

        if (!user) {
          return null
        }

        // --------------------------------------------
        // 2b. Cek status USER
        // --------------------------------------------
        if (user.status === 'PENDING_VERIFICATION') {
          devLog('🔐 Login rejected - email not verified:', user.email)
          return null
        }

        if (user.status !== "ACTIVE") {
          devLog("🔐 Login rejected - user status:", user.status)
          return null
        }

        // --------------------------------------------
        // 3. Verifikasi password
        // --------------------------------------------
        const isValid = await compare(credentials.password, user.password)
        if (!isValid) {
          return null
        }

        // --------------------------------------------
        // 3b. UPDATE lastLoginAt
        // --------------------------------------------
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          devLog("🔐 lastLoginAt updated for:", user.email)
        } catch (updateError) {
          // Jangan gagalkan login kalau update gagal
          console.error("Failed to update lastLoginAt:", updateError)
        }

        // --------------------------------------------
        // 4. Ambil tenantUser pertama dengan tenant valid
        // --------------------------------------------
        const tenantUser = user.tenantUsers.find(
          (tu) =>
            tu.tenant &&
            (tu.tenant.status === "ACTIVE" || tu.tenant.status === "TRIAL")
        )

        if (!tenantUser) {
          devLog(
            "🔐 Login rejected - no active tenant found for user:",
            user.email
          )
          return null
        }

        // --------------------------------------------
        // 5. Guard ekstra untuk tenant status
        // --------------------------------------------
        if (
          tenantUser.tenant.status !== "ACTIVE" &&
          tenantUser.tenant.status !== "TRIAL"
        ) {
          devLog(
            "🔐 Login rejected - tenant status:",
            tenantUser.tenant.status
          )
          return null
        }

        // --------------------------------------------
        // 6. Extract permissions dari role
        // --------------------------------------------
        const permissions =
          tenantUser.role?.permissions.map((rp) => rp.permission.name) || []

        devLog("🔐 Authorize - User:", {
          email: user.email,
          role: tenantUser.role?.name,
          tenantId: tenantUser.tenantId,
          tenantName: tenantUser.tenant?.name,
          tenantStatus: tenantUser.tenant?.status,
          permissionCount: permissions.length,
        })

        // --------------------------------------------
        // 7. Return user object
        // --------------------------------------------
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar || null,
          tenantId: tenantUser.tenantId,
          tenantSlug: tenantUser.tenant?.slug || "",
          tenantName: tenantUser.tenant?.name || "",
          branchId: tenantUser.branchId || "",
          role: tenantUser.role?.name || "STAFF",
          permissions,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // --------------------------------------------
      // Handle update trigger (misal: user ubah nama/avatar)
      // --------------------------------------------
      if (trigger === "update" && session?.user) {
        devLog("🔄 JWT Update triggered:", session.user)
        token.name = session.user.name
        token.avatar = session.user.avatar
        return token
      }

      // --------------------------------------------
      // Login pertama — set semua data dari user object
      // --------------------------------------------
      if (user) {
        token.id = user.id
        token.avatar = (user as any).avatar || null
        token.tenantId = (user as any).tenantId
        token.tenantSlug = (user as any).tenantSlug
        token.tenantName = (user as any).tenantName
        token.branchId = (user as any).branchId
        token.role = (user as any).role || "STAFF"
        token.permissions = (user as any).permissions || []
        token.permissionsLastFetched = Date.now()
        token.passwordCheckedAt = Date.now()

        devLog("🔐 JWT - Token created:", {
          id: token.id,
          email: user.email,
          role: token.role,
          tenantId: token.tenantId,
          permissionCount: token.permissions.length,
        })

        return token
      }

      const now = Date.now()

      // --------------------------------------------
      // Cek apakah password berubah setelah token dibuat
      // --------------------------------------------
      // Dijalankan tiap 1 menit (bukan tiap request)
      // untuk mengurangi beban DB.
      // Jika passwordChangedAt > iat → logout.
      // --------------------------------------------
      const passwordCheckedAt = (token.passwordCheckedAt as number) || 0
      if (now - passwordCheckedAt > PASSWORD_CHECK_INTERVAL_MS) {
        if (token.id && token.iat) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { passwordChangedAt: true },
            })

            if (
              dbUser?.passwordChangedAt &&
              dbUser.passwordChangedAt.getTime() >
                (token.iat as number) * 1000
            ) {
              devLog(
                "🔐 Password changed after token issued → logout"
              )
              return null as any
            }
          } catch (error) {
            // Fail-open: DB error → jangan logout
            console.error(
              "🔐 Password check error (fail-open):",
              error
            )
          }
        }
        token.passwordCheckedAt = now
      }

      // --------------------------------------------
      // Refresh permissions setiap 5 menit
      // --------------------------------------------
      const lastFetched = (token.permissionsLastFetched as number) || 0

      if (now - lastFetched > PERMISSIONS_REFRESH_INTERVAL_MS) {
        // Validasi: token harus punya id & tenantId
        if (!token.id || !token.tenantId) {
          devLog("🔐 JWT refresh skipped - missing id or tenantId")
          return token
        }

        try {
          const result = await loadUserPermissions(
            token.id as string,
            token.tenantId as string
          )

          if (!result.isValid) {
            // Fail-closed: user/tenant tidak valid → logout
            devLog(
              "🔐 JWT refresh failed - user invalid:",
              result.reason,
              "→ logging out"
            )
            return null as any
          }

          // Update token dengan data terbaru
          token.permissions = result.permissions
          token.role = result.role
          token.permissionsLastFetched = now

          devLog("🔐 JWT - Permissions refreshed:", {
            role: result.role,
            permissionCount: result.permissions.length,
          })
        } catch (error) {
          // Fail-open: DB error → pakai token lama, jangan logout
          console.error(
            "🔐 JWT refresh error (fail-open, using old token):",
            error
          )
          // Update lastFetched supaya tidak retry setiap request
          token.permissionsLastFetched = now
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.avatar = (token.avatar as string) || null
        session.user.tenantId = token.tenantId as string
        session.user.tenantSlug = token.tenantSlug as string
        session.user.tenantName = token.tenantName as string
        session.user.branchId = token.branchId as string
        session.user.role = (token.role as string) || "STAFF"
        session.user.permissions = (token.permissions as string[]) || []

        devLog("🔐 Session - User:", {
          email: session.user.email,
          role: session.user.role,
          tenantId: session.user.tenantId,
          permissionCount: session.user.permissions.length,
        })
      }
      return session
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}
