// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importStore } from "../media/importStore";
import { ImportToast } from "./ImportToast";

beforeEach(() => importStore.setState({ running: false, items: [], summary: null }));
afterEach(() => vi.useRealTimers());

describe("ImportToast", () => {
  it("is invisible when idle", () => {
    const { container } = render(<ImportToast />);
    expect(container.firstChild).toBeNull();
  });

  it("shows progress with the current file name", () => {
    render(<ImportToast />);
    act(() =>
      importStore.setState({
        running: true,
        summary: null,
        items: [
          { key: "0", name: "a.mp4", state: "done" },
          { key: "1", name: "IMG_0042.MOV", state: "working" },
          { key: "2", name: "c.png", state: "queued" },
        ],
      }),
    );
    expect(screen.getByRole("status").textContent).toContain("Importing 2 of 3 — IMG_0042.MOV");
  });

  it("a clean result fades away by itself", () => {
    vi.useFakeTimers();
    render(<ImportToast />);
    act(() =>
      importStore.setState({
        running: false,
        items: [],
        summary: { added: 2, failed: [], warnings: [] },
      }),
    );
    expect(screen.getByRole("status").textContent).toContain("Added 2 files to the library.");
    act(() => void vi.advanceTimersByTime(4100));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("problems stay on screen, name each file, and need dismissing", () => {
    vi.useFakeTimers();
    render(<ImportToast />);
    act(() =>
      importStore.setState({
        running: false,
        items: [],
        summary: {
          added: 1,
          failed: [
            { name: "broken.mp4", message: "This browser can’t play this video format." },
            { name: "notes.txt", message: "Not a video, audio or photo file." },
          ],
          warnings: [],
        },
      }),
    );
    act(() => void vi.advanceTimersByTime(10000));
    const t = screen.getByRole("status");
    expect(t.textContent).toContain("Added 1 file to the library.");
    expect(t.textContent).toContain("broken.mp4");
    expect(t.textContent).toContain("Not a video, audio or photo file.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a missing preview picture is shown as a warning and keeps the box on screen", () => {
    vi.useFakeTimers();
    render(<ImportToast />);
    act(() =>
      importStore.setState({
        running: false,
        items: [],
        summary: {
          added: 1,
          failed: [],
          warnings: [
            {
              name: "IMG_1.MOV",
              message:
                "No preview picture could be made (play() refused). Open its ⋯ menu → Create thumbnail to try again.",
            },
          ],
        },
      }),
    );
    act(() => void vi.advanceTimersByTime(10000));
    const t = screen.getByRole("status");
    expect(t.textContent).toContain("Added 1 file to the library.");
    expect(t.textContent).toContain("IMG_1.MOV");
    expect(t.textContent).toContain("Create thumbnail");
  });

  it("says so when nothing was imported", () => {
    render(<ImportToast />);
    act(() =>
      importStore.setState({
        running: false,
        items: [],
        summary: { added: 0, failed: [{ name: "x", message: "m" }], warnings: [] },
      }),
    );
    expect(screen.getByRole("status").textContent).toContain("Nothing was imported.");
  });

  it("can't be dismissed while an import is running", () => {
    act(() => importStore.setState({ running: true, items: [], summary: null }));
    render(<ImportToast />);
    act(() => void importStore.setState((s) => s));
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
