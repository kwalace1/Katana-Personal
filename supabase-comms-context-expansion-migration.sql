-- Expand comms context links for cross-module discussions (WFM jobs, invoices)

ALTER TABLE public.comms_context_links
  DROP CONSTRAINT IF EXISTS comms_context_links_context_type_check;

ALTER TABLE public.comms_context_links
  ADD CONSTRAINT comms_context_links_context_type_check
  CHECK (context_type IN ('task', 'client', 'employee', 'project', 'job', 'invoice'));
