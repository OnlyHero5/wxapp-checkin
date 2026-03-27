import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setSession } from "../../shared/session/session-store";
import { createActivity, renderActivitiesPage } from "./activities-page-test-helpers";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivities: vi.fn()
}));

vi.mock("../../features/activities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/activities/api")>();
  return {
    ...actual,
    getActivities: activitiesApiMocks.getActivities
  };
});

describe("ActivitiesPage search", () => {
  beforeEach(() => {
    setSession("sess_activities_123");
  });

  afterEach(() => {
    vi.resetAllMocks();
    clearSession();
  });

  it("submits search with the first page and keeps the keyword while loading more", async () => {
    const user = userEvent.setup();
    activitiesApiMocks.getActivities
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_initial_101",
          activity_title: "默认第一页活动"
        })],
        has_more: false,
        page: 1
      })
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_search_101",
          activity_title: "奖学金补录专场"
        })],
        has_more: true,
        page: 1
      })
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_search_202",
          activity_title: "奖学金历史补签"
        })],
        has_more: false,
        page: 2
      });

    renderActivitiesPage();

    expect(await screen.findByText("默认第一页活动")).toBeInTheDocument();
    expect(activitiesApiMocks.getActivities).toHaveBeenNthCalledWith(1, {
      page: 1,
      page_size: 50
    });

    const searchInput = screen.getByPlaceholderText(/搜索活动/i);
    await user.type(searchInput, "奖学金");
    fireEvent.keyDown(searchInput, { code: "Enter", key: "Enter" });

    await waitFor(() => {
      expect(activitiesApiMocks.getActivities).toHaveBeenNthCalledWith(2, {
        keyword: "奖学金",
        page: 1,
        page_size: 50
      });
    });
    expect(await screen.findByText("奖学金补录专场")).toBeInTheDocument();

    await user.click(screen.getByText("加载更多"));

    await waitFor(() => {
      expect(activitiesApiMocks.getActivities).toHaveBeenNthCalledWith(3, {
        keyword: "奖学金",
        page: 2,
        page_size: 50
      });
    });
    expect(await screen.findByText("奖学金历史补签")).toBeInTheDocument();
  });

  it("clears the submitted keyword and reloads the default first page", async () => {
    const user = userEvent.setup();
    activitiesApiMocks.getActivities
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_initial_301",
          activity_title: "默认活动列表"
        })],
        has_more: false,
        page: 1
      })
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_search_301",
          activity_title: "漏加分专场"
        })],
        has_more: false,
        page: 1
      })
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_reset_301",
          activity_title: "恢复默认列表"
        })],
        has_more: false,
        page: 1
      });

    renderActivitiesPage();

    expect(await screen.findByText("默认活动列表")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/搜索活动/i);
    await user.type(searchInput, "漏加分");
    fireEvent.keyDown(searchInput, { code: "Enter", key: "Enter" });

    expect(await screen.findByText("漏加分专场")).toBeInTheDocument();

    await user.clear(searchInput);
    fireEvent.keyDown(searchInput, { code: "Enter", key: "Enter" });

    await waitFor(() => {
      expect(activitiesApiMocks.getActivities).toHaveBeenNthCalledWith(3, {
        page: 1,
        page_size: 50
      });
    });
    expect(await screen.findByText("恢复默认列表")).toBeInTheDocument();
  });
});
