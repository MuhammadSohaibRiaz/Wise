-- Create certifications table for lawyer qualifications
CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  credential_url TEXT,
  credential_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on certifications
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for certifications
CREATE POLICY "Users can view their own certifications"
  ON certifications FOR SELECT
  USING (auth.uid() = lawyer_id);

CREATE POLICY "Users can insert their own certifications"
  ON certifications FOR INSERT
  WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Users can update their own certifications"
  ON certifications FOR UPDATE
  USING (auth.uid() = lawyer_id)
  WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Users can delete their own certifications"
  ON certifications FOR DELETE
  USING (auth.uid() = lawyer_id);

-- Create index for faster queries
CREATE INDEX idx_certifications_lawyer_id ON certifications(lawyer_id);
