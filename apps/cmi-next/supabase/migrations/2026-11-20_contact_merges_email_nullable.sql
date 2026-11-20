-- Merging a duplicate contact that has no email failed.
--
-- merge_contacts() logs each merge in contact_merges, copying the merged
-- record's email into merged_email, which was NOT NULL. Contacts made from a
-- deal often have only a name (e.g. three "Rall Elder" copies), so the merge
-- raised a not-null error and rolled back, both from the Contacts duplicate
-- finder and from Claude/Bolt. The email is only a note in the log, so allow
-- it to be empty.

alter table public.contact_merges alter column merged_email drop not null;
