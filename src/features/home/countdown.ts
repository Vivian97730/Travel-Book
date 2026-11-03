const DEPARTURE_AT = new Date("2027-02-05T00:20:00+08:00");

export function formatDepartureCountdown(now: Date): string {
  const difference = DEPARTURE_AT.getTime() - now.getTime();
  if (difference <= 0) return "旅程已開始";

  const days = Math.floor(difference / 86_400_000);
  const hours = Math.floor((difference % 86_400_000) / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  return `${days} 天 ${hours} 小時 ${minutes} 分`;
}
