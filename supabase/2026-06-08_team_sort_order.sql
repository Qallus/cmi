-- Set team member display order per user request:
-- 1. Brandon Fadden, 2. Joe Ballard, 3. Ben, 4. Angel, 5. Yovana

UPDATE team_members SET sort_order = 1  WHERE name ILIKE '%brandon%';
UPDATE team_members SET sort_order = 2  WHERE name ILIKE '%joe%' OR name ILIKE '%joseph%' OR name ILIKE '%ballard%';
UPDATE team_members SET sort_order = 3  WHERE name ILIKE '%ben%' AND name NOT ILIKE '%brandon%';
UPDATE team_members SET sort_order = 4  WHERE name ILIKE '%angel%';
UPDATE team_members SET sort_order = 5  WHERE name ILIKE '%yovana%';

-- Remaining members sort after the named five
UPDATE team_members SET sort_order = 100
WHERE sort_order IS NULL OR sort_order NOT IN (1, 2, 3, 4, 5);
