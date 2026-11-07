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
): string[] {
  const start = toEpoch(startDate);
  const end = toEpoch(endDate);
  const totalDays = Math.floor((end - start) / oneDay) + 1;

  return Array.from({ length: totalDays }, (_, index) => toDate(start + index * oneDay));
}
