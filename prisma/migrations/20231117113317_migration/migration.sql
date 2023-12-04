-- CreateTable
CREATE TABLE "Shop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "instance_key" TEXT,
    "authorization_status" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'EN',
    "api_key" TEXT,
    "platform_key" TEXT DEFAULT 'payrexx',
    "access_token" TEXT,
    "design_key" TEXT,
    "design_name" TEXT
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "payrexx_uuid" TEXT,
    "reference_id" INTEGER,
    "shopify_key" TEXT,
    "payrexx_id" INTEGER,
    "amount" INTEGER,
    "psp" TEXT,
    "currency" TEXT,
    "status" TEXT,
    "refund_status" BOOLEAN,
    "refund_gid_id" TEXT,
    "shop" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_name_key" ON "Shop"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_id_key" ON "Payment"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_shopify_key_key" ON "Payment"("shopify_key");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_payrexx_id_key" ON "Payment"("payrexx_id");
