import { afterEach, describe, expect, it, vi } from "vitest";
import { getActivities } from "./api";

const httpClientMocks = vi.hoisted(() => ({
  requestJson: vi.fn()
}));

vi.mock("../../shared/http/client", () => ({
  requestJson: httpClientMocks.requestJson
}));

describe("activities api", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes keyword through the paged activities query string", async () => {
    httpClientMocks.requestJson.mockResolvedValue({
      activities: [],
      status: "success"
    });

    await getActivities({
      keyword: "奖学金",
      page: 2,
      page_size: 20
    });

    expect(httpClientMocks.requestJson).toHaveBeenCalledWith(
      "/activities?page=2&page_size=20&keyword=%E5%A5%96%E5%AD%A6%E9%87%91"
    );
  });
});
