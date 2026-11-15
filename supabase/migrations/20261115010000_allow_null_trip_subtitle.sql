-- Align existing hosted databases with the nullable home read model.
alter table app_private.trips alter column subtitle drop not null;
