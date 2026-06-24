-- Expand contact types and document types so business-card leads (and staff)
-- can be saved as more categories.
alter table public.contacts drop constraint if exists contacts_type_check;
alter table public.contacts add constraint contacts_type_check
  check (type is null or type = any (array[
    'Client','Lead','Prospect','Customer','Vendor','Sub Contractor','Designer','Other'
  ]));

alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents add constraint documents_type_check
  check (type is null or type = any (array[
    'contract','sow','proposal','change_order','other'
  ]));
