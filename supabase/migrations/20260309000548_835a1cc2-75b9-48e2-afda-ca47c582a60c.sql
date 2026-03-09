-- Create table to track password reset attempts for rate limiting
CREATE TABLE public.password_reset_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient email lookups
CREATE INDEX idx_password_reset_attempts_email ON public.password_reset_attempts(email);
CREATE INDEX idx_password_reset_attempts_reset_at ON public.password_reset_attempts(reset_at);

-- Enable RLS
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own attempts (for client-side rate limit display)
CREATE POLICY "Users can view their own reset attempts" 
ON public.password_reset_attempts 
FOR SELECT 
USING (true); -- Allow reading for rate limit checks

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_password_reset_rate_limit(user_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_attempts INTEGER := 0;
  last_attempt TIMESTAMP WITH TIME ZONE;
  reset_time TIMESTAMP WITH TIME ZONE;
  max_attempts INTEGER := 3;
  cooldown_minutes INTEGER := 15;
  result JSON;
BEGIN
  -- Clean up old entries first
  DELETE FROM public.password_reset_attempts 
  WHERE reset_at < now();
  
  -- Get current attempt count for this email
  SELECT attempt_count, last_attempt_at, reset_at 
  INTO current_attempts, last_attempt, reset_time
  FROM public.password_reset_attempts 
  WHERE email = user_email
  AND reset_at > now()
  ORDER BY last_attempt_at DESC
  LIMIT 1;
  
  -- If no record exists or reset time has passed, allow the attempt
  IF current_attempts IS NULL OR reset_time <= now() THEN
    -- Insert new record or reset existing one
    INSERT INTO public.password_reset_attempts (email, attempt_count, last_attempt_at, reset_at)
    VALUES (user_email, 1, now(), now() + interval '1 hour')
    ON CONFLICT (email) DO UPDATE SET
      attempt_count = 1,
      last_attempt_at = now(),
      reset_at = now() + interval '1 hour';
    
    result := json_build_object(
      'allowed', true,
      'remaining_attempts', max_attempts - 1
    );
  -- If under limit and cooldown has passed
  ELSIF current_attempts < max_attempts AND (last_attempt + interval '15 minutes') <= now() THEN
    -- Increment attempt count
    UPDATE public.password_reset_attempts 
    SET attempt_count = attempt_count + 1,
        last_attempt_at = now()
    WHERE email = user_email;
    
    result := json_build_object(
      'allowed', true,
      'remaining_attempts', max_attempts - (current_attempts + 1)
    );
  ELSE
    -- Rate limited
    result := json_build_object(
      'allowed', false,
      'retry_after_minutes', EXTRACT(EPOCH FROM (last_attempt + interval '15 minutes' - now())) / 60,
      'reset_after_minutes', EXTRACT(EPOCH FROM (reset_time - now())) / 60
    );
  END IF;
  
  RETURN result;
END;
$$;