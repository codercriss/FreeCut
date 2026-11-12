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

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Appearance" }));

describe("ThemePicker dropdown (Me → Appearance)", () => {
  it("is closed until opened, then lists Auto / Dark / Light and checks the saved one", () => {
    const off = initTheme();
    render(<ThemePicker />);
    const trigger = screen.getByRole("button", { name: "Appearance" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(screen.queryByRole("listbox")).toBeNull();

    openMenu();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("listbox", { name: "Appearance" });
    const options = menu.querySelectorAll("button");
    expect(options).toHaveLength(3);
    expect(options[0].getAttribute("aria-selected")).toBe("true"); // saved: auto
    expect(options[1].getAttribute("aria-selected")).toBe("false");
    expect(options[2].getAttribute("aria-selected")).toBe("false");
    // the closed button names the current choice
    expect(trigger.textContent).toContain("Auto");
    off();
  });

  it("picks a theme from the menu, switches the live palette, remembers it, and closes", () => {
    const off = initTheme();
    render(<ThemePicker />);
    openMenu();
    fireEvent.click(screen.getByRole("option", { name: /Light/ }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.querySelector('meta[name="color-scheme"]')!.getAttribute("content")).toBe(
      "light",
    );
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute("content")).toBe(
      "#f2f2f5",
    );
    expect(JSON.parse(localStorage.getItem("freecut.prefs") ?? "{}").theme).toBe("light");

    // menu closed again, and the trigger now names the new choice
    expect(screen.queryByRole("listbox")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Appearance" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain("Light");

    openMenu();
    fireEvent.click(screen.getByRole("option", { name: /Dark/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute("content")).toBe(
      "#0f0f10",
    );

    openMenu();
    fireEvent.click(screen.getByRole("option", { name: /Auto/ }));
    expect(document.documentElement.dataset.theme).toBe("auto");
    // auto tells the browser both palettes are fine; the phone bar follows the resolved one
    expect(document.querySelector('meta[name="color-scheme"]')!.getAttribute("content")).toBe(
      "dark light",
    );
    off();
  });

  it("closes on a tap outside and on a scroll underneath, without changing the theme", () => {
    const off = initTheme();
    render(<ThemePicker />);
    openMenu();
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.pointerDown(document.body); // anywhere outside the dropdown
    expect(screen.queryByRole("listbox")).toBeNull();

    openMenu();
    fireEvent.scroll(document.documentElement); // the page under the menu moved
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("auto");
    off();
  });

  it("closes on Escape and puts focus back on the trigger", () => {
    const off = initTheme();
    render(<ThemePicker />);
    const trigger = screen.getByRole("button", { name: "Appearance" });
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
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
    const trigger = await screen.findByRole("button", { name: "Appearance" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: /Light/ }));
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
    const trigger = await screen.findByRole("button", { name: "Appearance" });
    expect(trigger.closest(".hm-side-theme")).toBeTruthy();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: /Dark/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
