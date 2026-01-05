-- Create DevTel Spec Documents table
CREATE TABLE IF NOT EXISTS "devtelSpecDocuments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "projectId" UUID NOT NULL REFERENCES "devtelProjects"("id") ON DELETE CASCADE,
    "authorId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "title" VARCHAR(500) NOT NULL,
    "content" JSONB DEFAULT '{}',
    "status" VARCHAR(20) DEFAULT 'draft',
    "createdById" UUID REFERENCES "users"("id"),
    "updatedById" UUID REFERENCES "users"("id"),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

-- Add tenantId column if it doesn't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devtelSpecDocuments' AND column_name = 'tenantId') THEN
        ALTER TABLE "devtelSpecDocuments" ADD COLUMN "tenantId" UUID;
    END IF;
END $$;

-- Create indexes (only if column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devtelSpecDocuments' AND column_name = 'tenantId') THEN
        CREATE INDEX IF NOT EXISTS "devtelSpecDocuments_tenantId" ON "devtelSpecDocuments"("tenantId");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "devtelSpecDocuments_projectId" ON "devtelSpecDocuments"("projectId");
CREATE INDEX IF NOT EXISTS "devtelSpecDocuments_authorId" ON "devtelSpecDocuments"("authorId");
CREATE INDEX IF NOT EXISTS "devtelSpecDocuments_status" ON "devtelSpecDocuments"("status");
CREATE INDEX IF NOT EXISTS "devtelSpecDocuments_deletedAt" ON "devtelSpecDocuments"("deletedAt");

-- Create DevTel Spec Versions table
CREATE TABLE IF NOT EXISTS "devtelSpecVersions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "specId" UUID NOT NULL REFERENCES "devtelSpecDocuments"("id") ON DELETE CASCADE,
    "authorId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "devtelSpecVersions_specId" ON "devtelSpecVersions"("specId");
CREATE INDEX IF NOT EXISTS "devtelSpecVersions_authorId" ON "devtelSpecVersions"("authorId");

-- Create DevTel Spec Comments table
CREATE TABLE IF NOT EXISTS "devtelSpecComments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "specId" UUID NOT NULL REFERENCES "devtelSpecDocuments"("id") ON DELETE CASCADE,
    "authorId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS "devtelSpecComments_specId" ON "devtelSpecComments"("specId");
CREATE INDEX IF NOT EXISTS "devtelSpecComments_authorId" ON "devtelSpecComments"("authorId");
