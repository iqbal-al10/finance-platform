import NextAuth, { type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"

// ============================================
// DEV LOG HELPER
// ============================================
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args)
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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
        // 2. Cari user + relasi tenantUsers
        // --------------------------------------------
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            tenantUsers: {
              include: {
                tenant: true,
                branch: true,
                role: true,
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
        // 3b. UPDATE lastLoginAt  ← TAMBAHKAN INI
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

        devLog("🔐 Authorize - User:", {
          email: user.email,
          role: tenantUser.role?.name,
          tenantId: tenantUser.tenantId,
          tenantName: tenantUser.tenant?.name,
          tenantStatus: tenantUser.tenant?.status,
        })

        // --------------------------------------------
        // 6. Return user object
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
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.user) {
        devLog("🔄 JWT Update triggered:", session.user)
        token.name = session.user.name
        token.avatar = session.user.avatar
        return token
      }

      if (user) {
        token.id = user.id
        token.avatar = (user as any).avatar || null
        token.tenantId = (user as any).tenantId
        token.tenantSlug = (user as any).tenantSlug
        token.tenantName = (user as any).tenantName
        token.branchId = (user as any).branchId
        token.role = (user as any).role || "STAFF"

        devLog("🔐 JWT - Token:", {
          id: token.id,
          email: user.email,
          role: token.role,
          tenantId: token.tenantId,
        })
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

        devLog("🔐 Session - User:", {
          email: session.user.email,
          role: session.user.role,
          tenantId: session.user.tenantId,
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

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
