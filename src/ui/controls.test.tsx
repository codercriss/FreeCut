// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "./controls";

describe("Slider (keyboard + a11y — Handover K5)", () => {
  const setup = (value = 50) => {
    const onChange = vi.fn();
    render(<Slider label="Opacity" value={value} onChange={onChange} />);
    return { onChange, el: screen.getByRole("slider", { name: "Opacity" }) };
  };
  it("is focusable and exposes its value to assistive tech", () => {
    const { el } = setup(37);
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute("aria-valuenow")).toBe("37");
    expect(el.getAttribute("aria-valuemin")).toBe("0");
    expect(el.getAttribute("aria-valuemax")).toBe("100");
  });
  it("arrow keys step by 1, Shift+arrow / PageUp/PageDown by 10", () => {
    const { el, onChange } = setup(50);
    fireEvent.keyDown(el, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(51);
    fireEvent.keyDown(el, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith(49);
    fireEvent.keyDown(el, { key: "ArrowRight", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(60);
    fireEvent.keyDown(el, { key: "PageDown" });
    expect(onChange).toHaveBeenLastCalledWith(40);
  });
  it("Home/End jump to the ends, and values clamp", () => {
    const { el, onChange } = setup(98);
    fireEvent.keyDown(el, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.keyDown(el, { key: "ArrowRight", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.keyDown(el, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
  it("ignores unrelated keys", () => {
    const { el, onChange } = setup();
    fireEvent.keyDown(el, { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
