// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ IS_IPHONE: true, IS_STANDALONE: false }));
vi.mock("../app/platform", () => platform);

import { StorageTip } from "./MediaPanel";

beforeEach(() => {
  localStorage.clear();
  platform.IS_IPHONE = true;
  platform.IS_STANDALONE = false;
});

describe("StorageTip (Safari may clear a website's saved media after about a week)", () => {
  it("shows on iPhone Safari once there's imported media", () => {
    render(<StorageTip hasImports />);
    expect(screen.getByRole("note").textContent).toMatch(/Add to Home Screen/);
  });
  it("not before the first import", () => {
    render(<StorageTip hasImports={false} />);
    expect(screen.queryByRole("note")).toBeNull();
  });
  it("not in the installed Home Screen app", () => {
    platform.IS_STANDALONE = true;
    render(<StorageTip hasImports />);
    expect(screen.queryByRole("note")).toBeNull();
  });
  it("not on other devices", () => {
    platform.IS_IPHONE = false;
    render(<StorageTip hasImports />);
    expect(screen.queryByRole("note")).toBeNull();
  });
  it("'Got it' hides it for good", () => {
    const { unmount } = render(<StorageTip hasImports />);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("note")).toBeNull();
    unmount();
    render(<StorageTip hasImports />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
