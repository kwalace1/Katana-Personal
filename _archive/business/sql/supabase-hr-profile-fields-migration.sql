-- Add profile fields to hr_employees for employee self-service editing
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.hr_employees ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.hr_employees ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.hr_employees ADD COLUMN IF NOT EXISTS bio text;
