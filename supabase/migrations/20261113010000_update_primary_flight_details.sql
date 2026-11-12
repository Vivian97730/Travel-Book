-- Update the primary trip's existing flights without modifying other trips.
update app_private.flights as flight
set
  legs_json = details.legs,
  departure_at = details.departure_at,
  arrival_at = details.arrival_at
from (values
  ('去程', '[
    {"airport": "TPE", "city": "桃園", "terminal": "T2", "time": "00:20", "flightNumber": "EK387", "dateLabel": "2/5"},
    {"airport": "DXB", "city": "杜拜", "terminal": "T3", "time": "06:15"},
    {"airport": "DXB", "city": "杜拜", "terminal": "T3", "time": "08:55", "flightNumber": "EK127"},
    {"airport": "VIE", "city": "維也納", "terminal": "T3", "time": "12:25"}
  ]'::jsonb, '2027-02-05 00:20:00+08'::timestamptz, '2027-02-05 12:25:00+01'::timestamptz),
  ('回程', '[
    {"airport": "VIE", "city": "維也納", "terminal": "T3", "time": "21:45", "flightNumber": "EK126", "dateLabel": "2/14"},
    {"airport": "DXB", "city": "杜拜", "terminal": "T3", "time": "06:25", "dayOffset": 1},
    {"airport": "DXB", "city": "杜拜", "terminal": "T3", "time": "08:45", "dayOffset": 1, "flightNumber": "EK386"},
    {"airport": "TPE", "city": "桃園", "terminal": "T2", "time": "20:40", "dayOffset": 1}
  ]'::jsonb, '2027-02-14 21:45:00+01'::timestamptz, '2027-02-15 20:40:00+08'::timestamptz)
) as details(direction, legs, departure_at, arrival_at)
where flight.trip_id = '11111111-1111-4111-8111-111111111111'
  and flight.direction = details.direction;
