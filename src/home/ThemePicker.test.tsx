// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleProject } from "../model/sample";
import type { BootResult } from "../app/bootstrap";
import App from "../app/App";
import { initTheme } from "../app/theme";
import { ProjectStoreProvider } from "../store/ProjectContext";
import { createProjectStore } from "../store/projectStore";
import { prefsStore } from "../store/prefsStore";
import { ThemePicker } from "./Home";

// jsdom loads no <head> metas from index.html: give applyTheme the two tags it keeps in step.
beforeEach(() => {
  document.head.innerHTML =
    '<meta name="theme-color" content="#0f0f10" /><meta name="color-scheme" content="dark" />';
  document.documentElement.dataset.theme = "auto";
  localStorage.clear();
  prefsStore.setState({ ...prefsStore.getState(), theme: "auto" });
});
afterEach(() => vi.restoreAllMocks());

describe("ThemePicker (Me → Appearance)", () => {
  it("shows Auto / Dark / Light and marks the saved one", () => {
    const off = initTheme();
    render(<ThemePicker />);
    expect(
      screen.getByRole("group", { name: "Appearance" }).querySelectorAll("button"),
    ).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Auto/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Dark/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /Light/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    off();
  });

  it("switches the live palette and remembers the choice", () => {
    const off = initTheme();
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole("button", { name: /Light/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.querySelector('meta[name="color-scheme"]')!.getAttribute("content")).toBe(
      "light",
    );
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute("content")).toBe(
      "#f2f2f5",
    );
    expect(JSON.parse(localStorage.getItem("freecut.prefs") ?? "{}").theme).toBe("light");
    expect(screen.getByRole("button", { name: /Light/ }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Dark/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute("content")).toBe(
      "#0f0f10",
    );

    fireEvent.click(screen.getByRole("button", { name: /Auto/ }));
    expect(document.documentElement.dataset.theme).toBe("auto");
    // auto tells the browser both palettes are fine; the phone bar follows the resolved one
    expect(document.querySelector('meta[name="color-scheme"]')!.getAttribute("content")).toBe(
      "dark light",
    );
    off();
  });
});

describe("ThemePicker in the app (the Me tab)", () => {
  it("is reachable from the Me tab on the phone and switches the whole app", async () => {
    const store = createProjectStore(createSampleProject(1));
    const bootFn = async (): Promise<BootResult> => ({
      source: "created",
      project: store.getProject(),
    });
    render(
      <ProjectStoreProvider store={store}>
        <App layout="mobile" bootFn={bootFn} />
      </ProjectStoreProvider>,
    );
    fireEvent.click((await screen.findAllByRole("button", { name: "Me" }))[0]);
    expect(await screen.findByRole("group", { name: "Appearance" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Light/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(JSON.parse(localStorage.getItem("freecut.prefs") ?? "{}").theme).toBe("light");
  });

  it("is on the desktop sidebar too", async () => {
    const store = createProjectStore(createSampleProject(1));
    const bootFn = async (): Promise<BootResult> => ({
      source: "created",
      project: store.getProject(),
    });
    render(
      <ProjectStoreProvider store={store}>
        <App layout="desktop" bootFn={bootFn} />
      </ProjectStoreProvider>,
    );
    const seg = await screen.findByRole("group", { name: "Appearance" });
    expect(seg.closest(".hm-side-theme")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Dark/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
