/*
  Warnings:

  - You are about to drop the column `category` on the `expenses` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `incomes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,invoiceNumber]` on the table `sales` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "IncomeCategoryEnum" AS ENUM ('SALES', 'SERVICE', 'CAPITAL_IN', 'OTHER_INCOME', 'REFUND', 'INTEREST', 'INVESTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategoryEnum" AS ENUM ('STOCK_PURCHASE', 'SALARY', 'ELECTRICITY', 'WATER', 'INTERNET', 'RENT', 'TRANSPORTATION', 'OPERATIONAL', 'MARKETING', 'MAINTENANCE', 'TAX', 'INSURANCE', 'OTHER');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'QRIS';

-- DropForeignKey
ALTER TABLE "settings" DROP CONSTRAINT "settings_tenantId_fkey";

-- DropIndex
DROP INDEX "sales_invoiceNumber_key";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "accountHolder" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "qrCodeUrl" TEXT;

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "incomes" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "customerName" TEXT;

-- AlterTable
ALTER TABLE "settings" ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "receiptLayout" SET DEFAULT 'minimal';

-- DropEnum
DROP TYPE "ExpenseCategory";

-- DropEnum
DROP TYPE "IncomeCategory";

-- CreateTable
CREATE TABLE "income_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "income_categories_tenantId_slug_key" ON "income_categories"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_tenantId_slug_key" ON "expense_categories"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "sales_tenantId_invoiceNumber_key" ON "sales"("tenantId", "invoiceNumber");

-- AddForeignKey
ALTER TABLE "income_categories" ADD CONSTRAINT "income_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_categories" ADD CONSTRAINT "income_categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "income_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
