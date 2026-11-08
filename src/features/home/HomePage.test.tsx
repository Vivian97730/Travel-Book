import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FlightDuration,
  FlightLegLabel,
  HomeSaveRecovery,
  homeSaveFailureFor,
  tripRangeText,
} from "./HomePage";

describe("home overview labels", () => {
  it("matches the approved Prototype text without extra wording", () => {
    expect(tripRangeText({
      dateLabel: "02/05 (五) - 02/15 (一)",
      durationLabel: "11 天 10 夜",
    })).toBe("02/05 (五) - 02/15 (一)・11 天 10 夜");

    const html = renderToStaticMarkup(<FlightDuration duration="19 小時 05 分" />);
    expect(html).toBe("<span>19 小時 05 分</span>");
    expect(html).not.toContain("總旅行時間");
  });

  it("keeps the approved flight row labels compact", () => {
    const departure = renderToStaticMarkup(<FlightLegLabel city="桃園" time="00:20" stop={false} />);
    const stop = renderToStaticMarkup(<FlightLegLabel city="杜拜轉機" time="06:15－08:55" stop />);
    const overnightStop = renderToStaticMarkup(<FlightLegLabel city="杜拜轉機" time="06:25－08:45" stop dayOffset={1} />);
    const overnightArrival = renderToStaticMarkup(<FlightLegLabel city="桃園" time="20:40" stop={false} dayOffset={1} />);

    expect(departure).toBe("<span>00:20</span>");
    expect(departure).not.toContain("桃園");
    expect(stop).toBe("<span>杜拜轉機<br/>06:15－08:55</span>");
    expect(overnightStop).toBe('<span>杜拜轉機<br/>06:25－08:45<small class="flight-day-offset">＋1 日</small></span>');
    expect(overnightArrival).toBe('<span>20:40<small class="flight-day-offset">＋1 日</small></span>');
  });
});

describe("home fact save recovery", () => {
  it("offers reload for version conflicts and retry for other failures", () => {
    const conflict = homeSaveFailureFor(Object.assign(new Error("request failed"), {
      code: "VERSION_CONFLICT",
    }));
    const unavailable = homeSaveFailureFor(new Error("network unavailable"));

    expect(conflict).toMatchObject({ kind: "conflict", actionLabel: "重新載入" });
    expect(unavailable).toMatchObject({ kind: "retry", actionLabel: "重試保存" });
    expect(conflict.message).toContain("草稿仍保留");
    expect(unavailable.message).toContain("草稿仍保留");

    const conflictHtml = renderToStaticMarkup(<HomeSaveRecovery
      failure={conflict}
      busy={false}
      online
      onRecover={() => undefined}
    />);
    const unavailableHtml = renderToStaticMarkup(<HomeSaveRecovery
      failure={unavailable}
      busy={false}
      online
      onRecover={() => undefined}
    />);

    expect(conflictHtml).toContain("重新載入");
    expect(unavailableHtml).toContain("重試保存");
    expect(conflictHtml).toContain('role="alert"');
  });

  it("does not allow recovery to be submitted while offline", () => {
    const html = renderToStaticMarkup(<HomeSaveRecovery
      failure={homeSaveFailureFor(new Error("network unavailable"))}
      busy={false}
      online={false}
      onRecover={() => undefined}
    />);

    expect(html).toMatch(/<button[^>]*disabled=""/);
  });
});
