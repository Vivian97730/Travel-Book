const oneDay = 86_400_000;

function toEpoch(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function toDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

export function chooseDefaultDate(today: string, startDate: string, endDate: string): string {
  if (today < startDate) return startDate;
  if (today > endDate) return endDate;
  return today;
}

export function buildDateWindow(
  startDate: string,
  endDate: string,
  selectedDate: string,
  maximumDays = 5,
): string[] {
  const start = toEpoch(startDate);
  const end = toEpoch(endDate);
  const selected = Math.min(end, Math.max(start, toEpoch(selectedDate)));
  const totalDays = Math.floor((end - start) / oneDay) + 1;
  const count = Math.min(maximumDays, totalDays);
  const selectedIndex = Math.floor((selected - start) / oneDay);
  const firstIndex = Math.min(
    totalDays - count,
    Math.max(0, selectedIndex - Math.floor(count / 2)),
  );

  return Array.from({ length: count }, (_, index) => toDate(start + (firstIndex + index) * oneDay));
}
