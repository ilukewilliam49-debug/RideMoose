
-- Table to store escalated support conversations
CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid REFERENCES public.rides(id),
  user_id uuid NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  admin_notes text
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_support_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'in_progress', 'resolved') THEN
    RAISE EXCEPTION 'support conversation status must be open, in_progress, or resolved';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_support_conversation_status
BEFORE INSERT OR UPDATE ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.validate_support_status();

-- Enable RLS
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view own support conversations"
ON public.support_conversations
FOR SELECT
USING (user_id IN (
  SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
));

-- Users can create support conversations
CREATE POLICY "Users can create support conversations"
ON public.support_conversations
FOR INSERT
WITH CHECK (user_id IN (
  SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
));

-- Admins can manage all support conversations
CREATE POLICY "Admins can manage all support conversations"
ON public.support_conversations
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));
