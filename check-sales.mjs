import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  const count = await prisma.sale.count()
  console.log('Total sales:', count)

  const duplicates = await prisma.$queryRaw`
    SELECT "invoiceNumber", COUNT(*)::int as cnt
    FROM sales
    GROUP BY "invoiceNumber"
    HAVING COUNT(*) > 1
  `
  console.log('Duplikat invoiceNumber:', duplicates)

  const perTenant = await prisma.$queryRaw`
    SELECT "tenantId", COUNT(*)::int as cnt
    FROM sales
    GROUP BY "tenantId"
  `
  console.log('Sales per tenant:', perTenant)
} catch (error) {
  console.error('Error:', error)
} finally {
  await prisma.$disconnect()
}
