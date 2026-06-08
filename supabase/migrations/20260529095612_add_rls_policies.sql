-- Helper function to retrieve current user ID from session JWT or local claims
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true)::json->>'sub', ''),
    nullif(current_setting('request.jwt.claim.sub', true), '')
  )::text;
$$;

-- 1. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_memories ENABLE ROW LEVEL SECURITY;

-- 2. CREATE POLICIES

-- Users Table Policies
CREATE POLICY "Users can manage their own user record" ON public.users
FOR ALL
USING (id = public.current_user_id())
WITH CHECK (id = public.current_user_id());

-- Profiles Table Policies
CREATE POLICY "Users can manage their own profile" ON public.profiles
FOR ALL
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

-- Calendars Table Policies
CREATE POLICY "Users can view calendars they own or belong to" ON public.calendars
FOR SELECT
USING (
  owner_id = public.current_user_id() OR
  EXISTS (
    SELECT 1 FROM public.calendar_members
    WHERE public.calendar_members.calendar_id = id 
      AND public.calendar_members.user_id = public.current_user_id() 
      AND public.calendar_members.deleted = 0
  )
);

CREATE POLICY "Users can modify owned calendars" ON public.calendars
FOR ALL
USING (owner_id = public.current_user_id())
WITH CHECK (owner_id = public.current_user_id());

-- Calendar Members Table Policies
CREATE POLICY "Users can view memberships of their calendars" ON public.calendar_members
FOR SELECT
USING (
  user_id = public.current_user_id() OR
  EXISTS (
    SELECT 1 FROM public.calendar_members AS cm
    WHERE cm.calendar_id = calendar_id 
      AND cm.user_id = public.current_user_id() 
      AND cm.deleted = 0
  )
);

CREATE POLICY "Calendar owners can manage memberships" ON public.calendar_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.calendars
    WHERE public.calendars.id = calendar_id 
      AND public.calendars.owner_id = public.current_user_id()
  )
);

-- Events Table Policies
CREATE POLICY "Users can view events in their calendars" ON public.events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.calendar_members
    WHERE public.calendar_members.calendar_id = calendar_id 
      AND public.calendar_members.user_id = public.current_user_id() 
      AND public.calendar_members.deleted = 0
  )
);

CREATE POLICY "Users can manage events in their calendars" ON public.events
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.calendar_members
    WHERE public.calendar_members.calendar_id = calendar_id 
      AND public.calendar_members.user_id = public.current_user_id() 
      AND public.calendar_members.deleted = 0
  )
);

-- Chat History Table Policies
CREATE POLICY "Users can manage their own chat history" ON public.chat_history
FOR ALL
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

-- Cognitive Memories Table Policies
CREATE POLICY "Users can manage their own cognitive memories" ON public.cognitive_memories
FOR ALL
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());
