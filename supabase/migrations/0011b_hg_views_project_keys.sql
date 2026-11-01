-- 0011b_hg_views_project_keys: a view position must belong to one project.
-- Same idea as 0002: parents expose (id, project_id) and children reference both,
-- so the view, the item and the position row can never sit in different projects.
-- Additive only. hg_items already has hg_items_id_project_key from 0002.

alter table hg_views add constraint hg_views_id_project_key unique (id, project_id);

alter table hg_view_positions add constraint hg_view_positions_view_project_fk
  foreign key (view_id, project_id) references hg_views (id, project_id)
  on delete cascade;

alter table hg_view_positions add constraint hg_view_positions_item_project_fk
  foreign key (item_id, project_id) references hg_items (id, project_id)
  on delete cascade;
