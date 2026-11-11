import { expect, it, vi } from "vitest";
import { prepareStayPhoto } from "./prepareStayPhoto";
import { ApiStaysRepository } from "./apiStaysRepository";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { StayPhoto } from "./StayPhoto";

it("rejects unsupported and oversized source files before decoding", async () => {
  await expect(prepareStayPhoto(new File(["<svg/>"],"photo.svg",{type:"image/svg+xml"}))).rejects.toThrow("10 MB");
  await expect(prepareStayPhoto(new File([new Uint8Array(10*1024*1024+1)],"large.jpg",{type:"image/jpeg"}))).rejects.toThrow("10 MB");
});

it("uploads binary JPEG with authorization and reads photos through the authenticated API", async () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST"
    ? new Response(JSON.stringify({id}),{status:201}) : new Response(new Blob(["image"],{type:"image/jpeg"})));
  const repository = new ApiStaysRepository("https://example.test", "test-only-token", fetcher);
  const blob = new Blob(["image"],{type:"image/jpeg"});
  expect(await repository.uploadPhoto(blob)).toEqual({id});
  expect(fetcher.mock.calls[0][1]).toMatchObject({method:"POST",body:blob,headers:{authorization:"Bearer test-only-token","content-type":"image/jpeg"}});
  expect(await (await repository.readPhoto(id)).text()).toBe("image");
  expect(fetcher.mock.calls[1][0]).toBe(`https://example.test/v1/stay-photos/${id}`);
  expect(fetcher.mock.calls[1][1]).toMatchObject({cache:"no-store"});
  const failed = new ApiStaysRepository("https://example.test","test-only-token",async () => new Response(null,{status:403}));
  await expect(failed.uploadPhoto(blob)).rejects.toThrow("上傳失敗");
  await expect(failed.readPhoto(id)).rejects.toThrow("讀取失敗");
});

it("keeps fallback visible before an authorized image is available and when offline", () => {
  const html = renderToStaticMarkup(createElement(StayPhoto,{photo:{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},online:false,alt:"photo",fallback:createElement("svg",{"data-fallback":true})}));
  expect(html).toContain("data-fallback");
  expect(html).not.toContain("<img");
});
