-- Projections: location for anticipated work (Map view). Job / deal-linked
-- projections use their source's address; these columns are only read when
-- the projection has no job or deal location.
alter table public.projections
  add column if not exists street_address text,
  add column if not exists city           text,
  add column if not exists state          text,
  add column if not exists zip_code       text,
  add column if not exists full_address   text,
  add column if not exists latitude       double precision,
  add column if not exists longitude      double precision;
