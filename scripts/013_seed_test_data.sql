-- =============================================
-- SEED TEST DATA FOR WISECASE (FIXED VERSION)
-- =============================================

-- STATUS CONSTRAINTS (from DB):
-- documents.status: 'pending', 'analyzing', 'completed', 'failed'
-- cases.status: 'open', 'in_progress', 'completed', 'closed'

-- Optional: wrap in a transaction if you want
-- BEGIN;

-- ---------------------------------------------
-- 1) Seed Lawyer Profiles extra stats
-- ---------------------------------------------
UPDATE lawyer_profiles 
SET 
  average_rating = 4.8,
  success_rate = 92,
  total_cases = 45,
  years_of_experience = 12,
  hourly_rate = 250,
  response_time_hours = 4,
  verified = true,
  active_clients = 8,
  bio_extended = 'Experienced corporate lawyer with a focus on mergers and acquisitions. Specialized in handling complex business transactions and corporate restructuring. Over a decade of experience representing Fortune 500 companies.'
WHERE id IN (SELECT id FROM lawyer_profiles LIMIT 1);

-- ---------------------------------------------
-- 2) Seed Reviews
-- ---------------------------------------------
INSERT INTO reviews (
  id,
  reviewer_id,
  reviewee_id,
  case_id,
  rating,
  comment,
  status,
  created_at
)
SELECT 
  gen_random_uuid(),
  c.id AS reviewer_id,
  lp.id AS reviewee_id,
  ca.id AS case_id,
  (ARRAY[5, 5, 4, 5, 4])[ (floor(random() * 5) + 1)::int ],
  (ARRAY[
    'Excellent service! Very professional and responsive.',
    'Great lawyer, resolved my case quickly and efficiently.',
    'Highly recommended. Very knowledgeable and caring.',
    'Best legal consultation I have ever had.',
    'Professional and thorough in handling my case.'
  ])[ (floor(random() * 5) + 1)::int ],
  'published',
  NOW() - (random() * INTERVAL '60 days')
FROM cases ca
JOIN lawyer_profiles lp ON ca.lawyer_id = lp.id
JOIN profiles c ON c.id = ca.client_id
WHERE c.user_type = 'client'
LIMIT 10;

-- ---------------------------------------------
-- 3) Seed Appointments
-- ---------------------------------------------
INSERT INTO appointments (
  id,
  client_id,
  lawyer_id,
  case_id,
  scheduled_at,
  duration_minutes,
  status,
  notes,
  created_at
)
SELECT 
  gen_random_uuid(),
  c.id AS client_id,
  lp.id AS lawyer_id,
  ca.id AS case_id,
  NOW() + (random() * INTERVAL '30 days'),               -- within next 30 days
  (ARRAY[30, 60, 90])[ (floor(random() * 3) + 1)::int ], -- 30 / 60 / 90 mins
  (ARRAY['scheduled', 'completed', 'scheduled'])[ (floor(random() * 3) + 1)::int ],
  'Initial legal consultation and case assessment',
  NOW() - (random() * INTERVAL '10 days')                -- created within last 10 days
FROM cases ca
JOIN profiles c ON ca.client_id = c.id
JOIN lawyer_profiles lp ON ca.lawyer_id = lp.id
WHERE c.user_type = 'client'
LIMIT 15;

-- ---------------------------------------------
-- 4) Seed Messages
-- ---------------------------------------------
INSERT INTO messages (
  id,
  sender_id,
  recipient_id,
  case_id,
  content,
  is_read,
  created_at
)
SELECT 
  gen_random_uuid(),
  CASE WHEN random() > 0.5 THEN c.id ELSE lp.id END AS sender_id,
  CASE WHEN random() > 0.5 THEN lp.id ELSE c.id END AS recipient_id,
  ca.id,
  (ARRAY[
    'When can we schedule the consultation?',
    'I have sent the required documents.',
    'Please review the attached files.',
    'What are the next steps in my case?',
    'Thank you for your help on this matter.',
    'I need an urgent consultation regarding this issue.'
  ])[ (floor(random() * 6) + 1)::int ],
  random() > 0.5,
  NOW() - (random() * INTERVAL '5 days')
FROM cases ca
JOIN profiles c ON ca.client_id = c.id
JOIN lawyer_profiles lp ON ca.lawyer_id = lp.id
WHERE c.user_type = 'client'
LIMIT 20;

-- ---------------------------------------------
-- 5) Seed Payments
-- ---------------------------------------------
INSERT INTO payments (
  id,
  client_id,
  lawyer_id,
  case_id,
  amount,
  currency,
  status,
  payment_method,
  description,
  created_at
)
SELECT 
  gen_random_uuid(),
  c.id AS client_id,
  lp.id AS lawyer_id,
  ca.id AS case_id,
  FLOOR(random() * 1000 + 250),   -- 250–1250
  'USD',
  (ARRAY['completed', 'pending', 'completed'])[ (floor(random() * 3) + 1)::int ],
  (ARRAY['credit_card', 'bank_transfer', 'credit_card'])[ (floor(random() * 3) + 1)::int ],
  'Legal services for ' || ca.case_type,
  NOW() - (random() * INTERVAL '20 days')
FROM cases ca
JOIN profiles c ON ca.client_id = c.id
JOIN lawyer_profiles lp ON ca.lawyer_id = lp.id
WHERE c.user_type = 'client'
LIMIT 8;

-- ---------------------------------------------
-- 6) Seed Documents
-- ---------------------------------------------
INSERT INTO documents (
  id,
  case_id,
  uploaded_by,
  file_name,
  file_url,
  file_type,
  document_type,
  status,
  file_size,
  created_at
)
SELECT 
  gen_random_uuid(),
  ca.id,
  c.id,
  (ARRAY['contract_draft.pdf', 'evidence_document.pdf', 'legal_notice.pdf', 'agreement.pdf'])[ (floor(random() * 4) + 1)::int ],
  'https://storage.example.com/documents/' || gen_random_uuid()::text || '.pdf',
  'pdf',
  (ARRAY['contract', 'evidence', 'notice', 'agreement'])[ (floor(random() * 4) + 1)::int ],
  (ARRAY['pending', 'analyzing', 'completed', 'failed'])[ (floor(random() * 4) + 1)::int ],  -- valid document statuses
  FLOOR(random() * 5000 + 500),  -- 500–5500 KB
  NOW() - (random() * INTERVAL '15 days')
FROM cases ca
JOIN profiles c ON ca.client_id = c.id
WHERE c.user_type = 'client'
LIMIT 10;

-- ---------------------------------------------
-- 7) Seed Document Analysis
-- ---------------------------------------------
INSERT INTO document_analysis (
  id,
  document_id,
  analysis_status,
  summary,
  extracted_text,
  key_terms,
  risk_assessment,
  recommendations,
  created_at
)
SELECT 
  gen_random_uuid(),
  d.id,
  'completed',
  'Contract analysis complete. Standard commercial agreement with favorable terms.',
  'This is a sample contract for legal services. Key sections include payment terms, liability, and confidentiality clauses.',
  ARRAY['payment_terms', 'liability', 'confidentiality', 'termination', 'jurisdiction'],
  'Low risk. Standard clauses present.',
  'Review liability clause. Consider adding force majeure provision.',
  NOW() - (random() * INTERVAL '10 days')
FROM documents d
LIMIT 8;

-- ---------------------------------------------
-- 8) Randomize Case Statuses (using valid values)
-- ---------------------------------------------
UPDATE cases 
SET status = (
  ARRAY['open', 'in_progress', 'completed', 'closed']
)[ (floor(random() * 4) + 1)::int ]
WHERE created_at > NOW() - INTERVAL '60 days';

-- Optional: if you used BEGIN;
-- COMMIT;
