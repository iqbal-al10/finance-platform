/*
  Warnings:

  - You are about to drop the column `permissions` on the `tenant_users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tenant_users" DROP COLUMN "permissions";
