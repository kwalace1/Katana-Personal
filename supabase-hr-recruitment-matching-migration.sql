-- Anonymous resume profiles + per-job match criteria for blind recruitment screening.
-- Run in Supabase SQL editor after supabase-hr-full-schema.sql.

alter table public.job_postings
  add column if not exists match_criteria jsonb;

comment on column public.job_postings.match_criteria is
  'Recruiter-defined requirements for Katana match scoring (skills, experience, education).';

alter table public.job_applications
  add column if not exists resume_profile jsonb;

comment on column public.job_applications.resume_profile is
  'Blind screening profile: skills, experience, education, redacted_full_text, blind_storage_path. '
  'Real identity is stored in resume_profile.sealed_identity until is_revealed is true.';

-- Optional: track when profile was last parsed
-- alter table public.job_applications add column if not exists resume_profile_parsed_at timestamptz;
