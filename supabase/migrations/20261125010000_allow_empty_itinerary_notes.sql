-- Notes are optional; retain the existing storage limit and NOT NULL type.
alter table app_private.itinerary_items
  drop constraint itinerary_items_notes_check,
  add constraint itinerary_items_notes_check check (length(trim(notes)) <= 500);
