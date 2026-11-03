import { describe, expect, it } from "vitest";
import { parseMutationMetadata } from "./mutation";

describe("shared mutation metadata", () => {
  it("accepts an expected version and UUID idempotency key", () => {
    expect(parseMutationMetadata({
      expectedVersion: 8,
      idempotencyKey: "c3f1699e-8b8f-4d38-b2da-d144a9f984fe",
    })).toEqual({
      ok: true,
      value: {
        expectedVersion: 8,
        idempotencyKey: "c3f1699e-8b8f-4d38-b2da-d144a9f984fe",
      },
    });
  });

  it("rejects stale version shapes and reusable human labels", () => {
    expect(parseMutationMetadata({
      expectedVersion: -1,
      idempotencyKey: "save-button",
    })).toEqual({
      ok: false,
      issues: [
        { path: "expectedVersion", message: "預期版本必須是非負整數。" },
        { path: "idempotencyKey", message: "Idempotency Key 必須是 UUID。" },
      ],
    });
  });
});
