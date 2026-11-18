import { expect, it, vi } from "vitest";
import { saveStayPhoto, type PendingStayPhoto } from "./saveStayPhoto";
import { FakeStaysRepository } from "./fakeStaysRepository";

const input = { name: "測試住宿", city: "維也納", address: "測試地址", startDate: "2027-02-05", endDate: "2027-02-08", checkin: "15:00", checkout: "11:00", photo: null };
const photo = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const file = new Blob(["test"], { type: "image/jpeg" });
function setup(removed = true) {
  const repository = Object.assign(new FakeStaysRepository(), {
    uploadPhoto: vi.fn(async () => photo), removePhoto: vi.fn(async () => removed),
  });
  const pending: { current: PendingStayPhoto | null } = { current: null };
  return { repository, pending };
}
it("only uploads when saving a selected file, and waits for upload before saving", async () => {
  const { repository, pending } = setup();
  const save = vi.fn(async () => undefined);
  await saveStayPhoto(input, null, pending, repository, save);
  expect(repository.uploadPhoto).not.toHaveBeenCalled();
  await saveStayPhoto(input, file, pending, repository, save);
  expect(save).toHaveBeenLastCalledWith({ ...input, photo });
  expect(repository.uploadPhoto.mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[1]);
  expect(repository.removePhoto).not.toHaveBeenCalled();
});
it("cleans a failed save without discarding the selected Blob, and uploads again on retry", async () => {
  const { repository, pending } = setup();
  const failure = Object.assign(new Error("save failed"), { code: "VALIDATION_FAILED" });
  await expect(saveStayPhoto(input, file, pending, repository, async () => { throw failure; })).rejects.toBe(failure);
  expect(repository.removePhoto).toHaveBeenCalledWith(photo.id);
  expect(pending.current).toBeNull();
  await saveStayPhoto(input, file, pending, repository, async () => undefined);
  expect(repository.uploadPhoto).toHaveBeenCalledTimes(2);
});
it.each(["referenced", "unavailable"])("keeps the same photo for ambiguous retries when cleanup is %s", async (mode) => {
  const { repository, pending } = setup(false);
  if (mode === "unavailable") repository.removePhoto.mockRejectedValue(new Error("network"));
  const failure = Object.assign(new Error("save rejected"), { code: "VERSION_CONFLICT" });
  await expect(saveStayPhoto(input, file, pending, repository, async () => { throw failure; })).rejects.toBe(failure);
  expect(pending.current?.photo).toEqual(photo);
  await saveStayPhoto(input, file, pending, repository, async () => undefined);
  expect(repository.uploadPhoto).toHaveBeenCalledTimes(1);
});
it("does not clean or change the photo ID after a lost mutation response", async () => {
  const { repository, pending } = setup();
  const failure = Object.assign(new Error("lost response"), { code: "EXTERNAL_SERVICE_UNAVAILABLE" });
  await expect(saveStayPhoto(input, file, pending, repository, async () => { throw failure; })).rejects.toBe(failure);
  expect(repository.removePhoto).not.toHaveBeenCalled();
  await saveStayPhoto(input, file, pending, repository, async () => undefined);
  expect(repository.uploadPhoto).toHaveBeenCalledTimes(1);
});
it("does not save or clean up when upload fails", async () => {
  const { repository, pending } = setup();
  repository.uploadPhoto.mockRejectedValue(new Error("upload failed"));
  const save = vi.fn(async () => undefined);
  await expect(saveStayPhoto(input, file, pending, repository, save)).rejects.toThrow("upload failed");
  expect(save).not.toHaveBeenCalled();
  expect(repository.removePhoto).not.toHaveBeenCalled();
});
