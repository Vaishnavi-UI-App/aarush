-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_tenantId_role_key_key" ON "role_permissions"("tenantId", "role", "key");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
