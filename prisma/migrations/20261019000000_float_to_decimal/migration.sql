-- ============================================
-- MIGRASI: Float → Decimal(15, 2) untuk field uang
-- ============================================
-- Konversi field uang dari double precision (float8)
-- ke numeric(15, 2) dengan pembulatan.
--
-- Quantity, stock, minStock, prevStock, newStock
-- TETAP float — tidak diubah.

-- Plan
ALTER TABLE "plans" ALTER COLUMN "price" TYPE numeric(15, 2) USING ROUND("price"::numeric, 2);

-- Account
ALTER TABLE "accounts" ALTER COLUMN "balance" TYPE numeric(15, 2) USING ROUND("balance"::numeric, 2);

-- Transaction
ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE numeric(15, 2) USING ROUND("amount"::numeric, 2);

-- LedgerEntry
ALTER TABLE "ledger_entries" ALTER COLUMN "amount" TYPE numeric(15, 2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "ledger_entries" ALTER COLUMN "balance" TYPE numeric(15, 2) USING ROUND("balance"::numeric, 2);

-- Transfer
ALTER TABLE "transfers" ALTER COLUMN "amount" TYPE numeric(15, 2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "transfers" ALTER COLUMN "fee" TYPE numeric(15, 2) USING ROUND("fee"::numeric, 2);

-- Income
ALTER TABLE "incomes" ALTER COLUMN "amount" TYPE numeric(15, 2) USING ROUND("amount"::numeric, 2);

-- Expense
ALTER TABLE "expenses" ALTER COLUMN "amount" TYPE numeric(15, 2) USING ROUND("amount"::numeric, 2);

-- Debt
ALTER TABLE "debts" ALTER COLUMN "total" TYPE numeric(15, 2) USING ROUND("total"::numeric, 2);
ALTER TABLE "debts" ALTER COLUMN "paid" TYPE numeric(15, 2) USING ROUND("paid"::numeric, 2);

-- DebtPayment
ALTER TABLE "debt_payments" ALTER COLUMN "amount" TYPE numeric(15, 2) USING ROUND("amount"::numeric, 2);

-- Receivable
ALTER TABLE "receivables" ALTER COLUMN "total" TYPE numeric(15, 2) USING ROUND("total"::numeric, 2);
ALTER TABLE "receivables" ALTER COLUMN "paid" TYPE numeric(15, 2) USING ROUND("paid"::numeric, 2);

-- ReceivablePayment
ALTER TABLE "receivable_payments" ALTER COLUMN "amount" TYPE numeric(15, 2) USING ROUND("amount"::numeric, 2);

-- Sale
ALTER TABLE "sales" ALTER COLUMN "subtotal" TYPE numeric(15, 2) USING ROUND("subtotal"::numeric, 2);
ALTER TABLE "sales" ALTER COLUMN "discount" TYPE numeric(15, 2) USING ROUND("discount"::numeric, 2);
ALTER TABLE "sales" ALTER COLUMN "tax" TYPE numeric(15, 2) USING ROUND("tax"::numeric, 2);
ALTER TABLE "sales" ALTER COLUMN "shipping" TYPE numeric(15, 2) USING ROUND("shipping"::numeric, 2);
ALTER TABLE "sales" ALTER COLUMN "totalAmount" TYPE numeric(15, 2) USING ROUND("totalAmount"::numeric, 2);
ALTER TABLE "sales" ALTER COLUMN "paidAmount" TYPE numeric(15, 2) USING ROUND("paidAmount"::numeric, 2);
ALTER TABLE "sales" ALTER COLUMN "changeAmount" TYPE numeric(15, 2) USING ROUND("changeAmount"::numeric, 2);

-- SaleItem
ALTER TABLE "sale_items" ALTER COLUMN "unitPrice" TYPE numeric(15, 2) USING ROUND("unitPrice"::numeric, 2);
ALTER TABLE "sale_items" ALTER COLUMN "discount" TYPE numeric(15, 2) USING ROUND("discount"::numeric, 2);
ALTER TABLE "sale_items" ALTER COLUMN "total" TYPE numeric(15, 2) USING ROUND("total"::numeric, 2);
ALTER TABLE "sale_items" ALTER COLUMN "hppAtTransaction" TYPE numeric(15, 2) USING ROUND("hppAtTransaction"::numeric, 2);

-- Payment
ALTER TABLE "payments" ALTER COLUMN "amount" TYPE numeric(15, 2) USING ROUND("amount"::numeric, 2);

-- Refund
ALTER TABLE "refunds" ALTER COLUMN "refundAmount" TYPE numeric(15, 2) USING ROUND("refundAmount"::numeric, 2);

-- RefundItem
ALTER TABLE "refund_items" ALTER COLUMN "unitPrice" TYPE numeric(15, 2) USING ROUND("unitPrice"::numeric, 2);
ALTER TABLE "refund_items" ALTER COLUMN "total" TYPE numeric(15, 2) USING ROUND("total"::numeric, 2);

-- Product
ALTER TABLE "products" ALTER COLUMN "purchasePrice" TYPE numeric(15, 2) USING ROUND("purchasePrice"::numeric, 2);
ALTER TABLE "products" ALTER COLUMN "sellingPrice" TYPE numeric(15, 2) USING ROUND("sellingPrice"::numeric, 2);
ALTER TABLE "products" ALTER COLUMN "hpp" TYPE numeric(15, 2) USING ROUND("hpp"::numeric, 2);

-- Purchase
ALTER TABLE "purchases" ALTER COLUMN "total" TYPE numeric(15, 2) USING ROUND("total"::numeric, 2);
ALTER TABLE "purchases" ALTER COLUMN "discount" TYPE numeric(15, 2) USING ROUND("discount"::numeric, 2);
ALTER TABLE "purchases" ALTER COLUMN "tax" TYPE numeric(15, 2) USING ROUND("tax"::numeric, 2);
ALTER TABLE "purchases" ALTER COLUMN "shipping" TYPE numeric(15, 2) USING ROUND("shipping"::numeric, 2);
ALTER TABLE "purchases" ALTER COLUMN "grandTotal" TYPE numeric(15, 2) USING ROUND("grandTotal"::numeric, 2);

-- PurchaseItem
ALTER TABLE "purchase_items" ALTER COLUMN "unitPrice" TYPE numeric(15, 2) USING ROUND("unitPrice"::numeric, 2);
ALTER TABLE "purchase_items" ALTER COLUMN "discount" TYPE numeric(15, 2) USING ROUND("discount"::numeric, 2);
ALTER TABLE "purchase_items" ALTER COLUMN "total" TYPE numeric(15, 2) USING ROUND("total"::numeric, 2);

-- CheckoutRequest
ALTER TABLE "checkout_requests" ALTER COLUMN "subtotal" TYPE numeric(15, 2) USING ROUND("subtotal"::numeric, 2);
ALTER TABLE "checkout_requests" ALTER COLUMN "tax" TYPE numeric(15, 2) USING ROUND("tax"::numeric, 2);
ALTER TABLE "checkout_requests" ALTER COLUMN "total" TYPE numeric(15, 2) USING ROUND("total"::numeric, 2);
