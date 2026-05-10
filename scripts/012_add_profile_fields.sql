-- Add additional fields to profiles table for better profile management
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS response_time_hours INTEGER DEFAULT 24;

-- Add certification-related fields to lawyer_profiles table
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS min_consultation_hours INTEGER DEFAULT 1;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS is_profile_active BOOLEAN DEFAULT TRUE;
ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS response_time_hours INTEGER DEFAULT 24;
