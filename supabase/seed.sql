-- ============================================================
-- CMI WebApp — Supabase Seed Data
-- Project: uoerzrmeibavqgisfzso
-- Seeds the 7 initial documents matching the dashboard DOCS array
-- Run AFTER schema.sql
-- ============================================================

INSERT INTO documents (
  id, type, title, client, client_email, client_phone,
  project, location, date, start_date, completion_date,
  value, deposit, payment_schedule, payment_terms,
  allowances, sq_ft, services, description,
  deliverables, exclusions, assumptions,
  warranty, change_order, dispute, permits, inspections,
  roc, cmi_rep, prepared_by, status, notes
) VALUES

-- contract-001
(
  'contract-001', 'contract', 'Arcadia Modern Remodel',
  'Sarah & Tom Mitchell', 'mitchell@email.com', '(602) 555-0181',
  'Arcadia Modern Remodel', 'Arcadia, Phoenix, AZ',
  'Apr 10, 2026', 'Apr 21, 2026', 'Oct 15, 2026',
  '$285,000', '$57,000',
  'Monthly draws tied to completion milestones', NULL,
  '$15,000 tile & stone allowance',
  '3,200',
  'Framing, Electrical, Plumbing, HVAC / Mechanical, Flooring, Cabinetry & Millwork, Painting & Coatings',
  'Full interior and exterior remodel of a 3,200 sq ft residential property in the Arcadia neighborhood. Scope includes structural framing modifications, full MEP rough-in and trim, new flooring throughout, kitchen and bath remodel.',
  NULL, NULL, NULL,
  '2-year workmanship warranty on all labor',
  'All change orders require written approval and signed amendment prior to work beginning.',
  'Maricopa County, AZ — binding arbitration',
  NULL, NULL,
  'AZ ROC KB-1 #343120', 'Ben Peck', NULL,
  'Signed / Active', ''
),

-- contract-002
(
  'contract-002', 'contract', 'Desert Highlands ADU',
  'James Okonkwo', 'jokonkwo@email.com', '(480) 555-0247',
  'Desert Highlands ADU', 'Scottsdale, AZ',
  'Apr 14, 2026', 'May 5, 2026', 'Sep 30, 2026',
  '$142,500', '$28,500',
  '3 draws: mobilization, framing/MEP rough-in, final completion', NULL,
  '$8,000 flooring allowance',
  '720',
  'Site Preparation & Grading, Foundation & Concrete, Framing, Electrical, Plumbing, HVAC / Mechanical, Roofing, Flooring',
  'Detached ADU construction on existing residential lot. 720 sq ft one-bedroom unit with full kitchen and bathroom.',
  NULL, NULL, NULL,
  '2-year workmanship warranty on all labor',
  'All change orders require written approval and signed amendment prior to work beginning.',
  'Maricopa County, AZ — binding arbitration',
  NULL, NULL,
  'AZ ROC KB-1 #343120', 'Ben Peck', NULL,
  'Pending Signature', ''
),

-- contract-003
(
  'contract-003', 'contract', 'Paradise Valley Commercial TI',
  'Prestige Retail Group', 'projects@prestigeretail.com', '(602) 555-0399',
  'PV Commercial TI', 'Paradise Valley, AZ',
  'Mar 28, 2026', 'Apr 7, 2026', 'Aug 1, 2026',
  '$510,000', '$102,000',
  'Monthly AIA-style draw schedule with 10% retention', NULL,
  '$30,000 FF&E allowance; $20,000 storefront glazing allowance',
  '6,400',
  'Site Preparation & Grading, Structural Steel, Framing, Electrical, Plumbing, HVAC / Mechanical, Flooring, Cabinetry & Millwork, Painting & Coatings, Lighting Design',
  'Tenant improvement buildout for retail and showroom space. Includes demising walls, MEP for new retail configuration, custom millwork, storefront modifications, and full ADA compliance.',
  NULL, NULL, NULL,
  '1-year workmanship warranty; manufacturer warranties passed through on equipment',
  'All change orders require written approval and signed amendment prior to work beginning.',
  'Maricopa County, AZ — binding arbitration',
  NULL, NULL,
  'AZ ROC KB-1 #343120', 'Ben Peck', NULL,
  'Signed / Active', ''
),

-- contract-004
(
  'contract-004', 'contract', 'Tempe Interior Design',
  'Cassandra Wu', 'cassandra.wu@email.com', '(480) 555-0563',
  'Tempe Interior Design', 'Tempe, AZ',
  'Apr 22, 2026', 'TBD', 'TBD',
  '$32,000', '$9,600',
  '50% deposit; 50% upon project completion', NULL,
  '$5,000 furnishings allowance',
  '1,850',
  'Interior Design, Flooring, Painting & Coatings, Lighting Design',
  'Interior design and light renovation for a 1,850 sq ft condo in downtown Tempe. Scope includes new flooring, paint, lighting, and design direction for furnishings.',
  NULL, NULL, NULL,
  '90-day workmanship warranty on installation work',
  'All change orders require written approval and signed amendment prior to work beginning.',
  'Maricopa County, AZ — binding arbitration',
  NULL, NULL,
  'AZ ROC KB-1 #343120', 'Ben Peck', NULL,
  'Draft', ''
),

-- sow-001
(
  'sow-001', 'sow', 'Scottsdale Master Bath Renovation',
  'Dana Reyes', 'dana.reyes@email.com', '(480) 555-0152',
  'Scottsdale Master Bath', 'Scottsdale, AZ',
  'Apr 18, 2026', 'May 12, 2026', 'Jun 30, 2026',
  '$68,000', NULL,
  NULL, '50% deposit, 50% upon completion',
  NULL,
  '280',
  'Plumbing, Tile & Stone, Cabinetry & Millwork, Flooring, Painting & Coatings',
  'Complete master bathroom gut renovation including new tile and stone work, custom vanity, freestanding soaking tub, frameless glass shower enclosure, and smart fixtures.',
  'Demo and haul-off; new shower tile and stone; custom double vanity with quartz top; freestanding soaking tub install; heated floor; lighting package; plumbing fixtures.',
  'Painting beyond bathroom; structural changes; permits for anything outside bath scope.',
  'Client to select all tile, fixtures, and finishes within allowance. Existing plumbing stack remains in current location.',
  NULL,
  'All change orders require written approval and signed amendment prior to work beginning.',
  NULL,
  'CMI to obtain all required trade permits',
  'Plumbing and tile inspections as required by city',
  'AZ ROC KB-1 #343120', NULL, 'Jeremy Waters',
  'Approved', ''
),

-- sow-002
(
  'sow-002', 'sow', 'Chandler New Construction',
  'Marcus & Leila Osei', 'osei.family@email.com', '(480) 555-0318',
  'Chandler Custom Home', 'Chandler, AZ',
  'Apr 20, 2026', 'Jun 1, 2026', 'Apr 30, 2027',
  '$1,240,000', NULL,
  NULL, 'Monthly AIA-style draws with 10% retention through substantial completion',
  NULL,
  '4,800',
  'Site Preparation & Grading, Permitting & Entitlements, Foundation & Concrete, Framing, Roofing, Electrical, Plumbing, HVAC / Mechanical, Flooring, Cabinetry & Millwork, Painting & Coatings, Landscaping, Smart Home / AV',
  'Ground-up construction of a 4,800 sq ft custom single-family residence with attached 3-car garage, pool pre-plumb, and smart home integration throughout.',
  'Full structure from foundation to final finishes; all mechanical systems; smart home pre-wire; landscaping rough grade; pool pre-plumb.',
  'Pool construction; furniture and FF&E; solar installation; window treatments.',
  'City of Chandler permits; approved architectural plans on file; client to provide landscaping design before rough grade.',
  NULL,
  'All change orders require written approval and signed amendment prior to work beginning.',
  NULL,
  'CMI to obtain building permit and all trade permits',
  'All required city and county inspections through certificate of occupancy',
  'AZ ROC KB-1 #343120', NULL, 'Ben Peck',
  'Pending Signature', ''
),

-- sow-003
(
  'sow-003', 'sow', 'Gilbert Kitchen Remodel',
  'Priya Nair', 'priya.nair@email.com', '(480) 555-0427',
  'Gilbert Kitchen Remodel', 'Gilbert, AZ',
  'Apr 21, 2026', 'TBD', 'TBD',
  '$44,500', NULL,
  NULL, '40% deposit, 30% at cabinet install, 30% at final completion',
  NULL,
  '320',
  'Electrical, Plumbing, Cabinetry & Millwork, Tile & Stone, Flooring, Painting & Coatings',
  'Kitchen remodel including new custom cabinetry, quartz countertops, tile backsplash, appliance rough-in, and updated lighting package.',
  'Demo existing kitchen; install new custom cabinetry; quartz countertops; tile backsplash; updated electrical for island and appliances; new sink and faucet.',
  'Appliance purchase; flooring outside kitchen; painting beyond kitchen walls.',
  'Existing layout to remain; no structural wall changes; appliances provided by client.',
  NULL,
  'All change orders require written approval and signed amendment prior to work beginning.',
  NULL,
  'Electrical and plumbing permits as required',
  'Per city requirements',
  'AZ ROC KB-1 #343120', NULL, 'Jeremy Waters',
  'Draft', ''
)

ON CONFLICT (id) DO NOTHING;
