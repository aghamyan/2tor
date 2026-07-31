\set ON_ERROR_STOP on

UPDATE users
SET phone_verified_at = NOW()
WHERE id = 'usr_demo_parent';

INSERT INTO users (
  id,
  email,
  password_hash,
  status,
  primary_timezone,
  locale,
  email_verified_at,
  phone_verified_at
) VALUES (
  'usr_e2e_approver',
  'approver-e2e@example.com',
  'e2e-placeholder-not-a-real-hash',
  'active',
  'America/New_York',
  'en',
  NOW(),
  NOW()
);

INSERT INTO user_roles (id, user_id, role_id, granted_by_user_id)
VALUES ('urole_e2e_approver', 'usr_e2e_approver', 'role_admin', 'usr_demo_admin');

INSERT INTO student_interests (id, student_profile_id, interest)
VALUES ('interest_e2e_optional', 'sprof_demo_1', 'Optional robotics club note');

INSERT INTO lessons (
  id,
  tutor_student_assignment_id,
  subject_id,
  scheduled_start_at,
  scheduled_end_at,
  status,
  timezone_at_booking,
  is_trial
) VALUES (
  'lesson_e2e_payment',
  'tsa_demo_1',
  'subj_math',
  '2026-07-15T18:00:00Z',
  '2026-07-15T18:45:00Z',
  'completed',
  'America/Los_Angeles',
  FALSE
);

INSERT INTO lesson_charges (
  id,
  lesson_id,
  parent_profile_id,
  price_id,
  amount_minor,
  currency,
  status
) VALUES (
  'lcharge_e2e_authorization',
  'lesson_e2e_payment',
  'pprof_demo_1',
  'price_demo_standard_usd',
  1800,
  'USD',
  'pending'
);

INSERT INTO invoices (
  id,
  parent_profile_id,
  status,
  currency,
  subtotal_minor,
  discount_minor,
  total_minor,
  issued_at,
  due_at
) VALUES (
  'invoice_e2e_authorization',
  'pprof_demo_1',
  'open',
  'USD',
  1800,
  0,
  1800,
  NOW(),
  NOW() + INTERVAL '1 day'
);

INSERT INTO invoice_items (
  id,
  invoice_id,
  lesson_charge_id,
  description,
  quantity,
  unit_amount_minor,
  amount_minor,
  currency
) VALUES (
  'iitem_e2e_authorization',
  'invoice_e2e_authorization',
  'lcharge_e2e_authorization',
  'E2E manual authorization',
  1,
  1800,
  1800,
  'USD'
);

INSERT INTO payment_transactions (
  id,
  lesson_charge_id,
  invoice_id,
  parent_profile_id,
  stripe_payment_intent_id,
  type,
  amount_minor,
  currency,
  status
) VALUES (
  'ptxn_e2e_authorization',
  'lcharge_e2e_authorization',
  'invoice_e2e_authorization',
  'pprof_demo_1',
  'pi_e2e_authorization',
  'charge',
  1800,
  'USD',
  'pending'
);
