-- Add interviewer column to interviews table
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS interviewer text;

-- Update existing records to extract interviewer from participants
-- This is optional and can be run manually if needed
