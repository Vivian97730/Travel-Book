import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlightDuration, HomeSaveRecovery, homeSaveFailureFor, tripRangeText } from "./HomePage";

describe("home overview labels", () => {
  it("matches the approved Prototype text without extra wording", () => {
    expect(tripRangeText({
      dateLabel: "02/05 (五) - 02/15 (一)",
      durationLabel: "11 天 10 夜",
    })).toBe("02/05 (五) - 02/15 (一)・11 天 10 夜");

    const html = renderToStaticMarkup(<FlightDuration duration="16 小時 05 分" />);
    expect(html).toBe("<span>16 小時 05 分</span>");
    expect(html).not.toContain("總旅行時間");
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
