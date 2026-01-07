-- Add WIP limit field to devtel projects
ALTER TABLE "devtelProjects" ADD COLUMN IF NOT EXISTS "wipLimit" INTEGER DEFAULT 0;

-- Add estimated hours field to issues for capacity planning
ALTER TABLE "devtelIssues" ADD COLUMN IF NOT EXISTS "estimatedHours" DECIMAL(10,2) DEFAULT 0;

-- Add planned points field to cycles
ALTER TABLE "devtelCycles" ADD COLUMN IF NOT EXISTS "plannedPoints" INTEGER DEFAULT 0;
