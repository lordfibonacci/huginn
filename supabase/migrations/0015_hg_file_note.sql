-- 0015_hg_file_note
-- One sentence per file: what it is and for whom (spec 2026-11-03-skjol-design.md).
-- Nothing else changes: hg_stamp_author and hg_log_event key on storage_path,
-- so a note write moves no stamp and logs no event.

alter table hg_files add column note text;
