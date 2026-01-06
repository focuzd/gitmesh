-- Add storyPointScale column to devtelWorkspaceSettings
ALTER TABLE "devtelWorkspaceSettings"
ADD COLUMN IF NOT EXISTS "storyPointScale" VARCHAR(20) DEFAULT 'fibonacci';
