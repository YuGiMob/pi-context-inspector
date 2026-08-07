import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@earendil-works/pi-coding-agent", () => ({}));

vi.mock("@earendil-works/pi-tui", () => ({
  Key: {
    tab: "\t",
    escape: "\x1b",
    shift: (key: string) => `shift-${key}`,
  },
  matchesKey: (data: string, key: any) => {
    if (key === "\t") return data === "\t";
    if (key === "shift-tab") return data === "\x1b[Z";
    if (key === "\x1b") return data === "\x1b";
    return false;
  },
  visibleWidth: (s: string) => s.length,
}));

import { TabbedOverlay } from "../src/tabbed-overlay.js";

function createMockTab(name: string) {
  return {
    name,
    getAboveContentLine: vi.fn((_innerWidth: number) => null),
    renderContent: vi.fn((_innerWidth: number, _height: number): string[] => []),
    getFooterLeft: vi.fn(() => ""),
    footerHints: "",
    handleInput: vi.fn((_data: string) => false),
    invalidate: vi.fn(),
  };
}

function createTheme(): any {
  return {
    fg: vi.fn((_color: string, text: string) => text),
    bg: vi.fn((_color: string, text: string) => text),
    bold: vi.fn((text: string) => text),
  };
}

describe("TabbedOverlay", () => {
  let theme: ReturnType<typeof createTheme>;
  let tab1: ReturnType<typeof createMockTab>;
  let tab2: ReturnType<typeof createMockTab>;
  let done: any;
  let overlay: TabbedOverlay;

  beforeEach(() => {
    theme = createTheme();
    tab1 = createMockTab("Tab1");
    tab2 = createMockTab("Tab2");
    done = vi.fn();
    overlay = new TabbedOverlay({
      title: "Test Overlay",
      subtitle: "subtitle",
      tabs: [tab1, tab2],
      theme,
      done,
    });
  });

  describe("handleInput", () => {
    it("switches to next tab on Tab", () => {
      overlay.handleInput("\t");
      expect((overlay as any).activeTabIndex).toBe(1);
    });

    it("switches to previous tab on Shift+Tab", () => {
      (overlay as any).activeTabIndex = 1;
      overlay.handleInput("\x1b[Z");
      expect((overlay as any).activeTabIndex).toBe(0);
    });

    it("wraps around on Tab from last tab", () => {
      (overlay as any).activeTabIndex = 1;
      overlay.handleInput("\t");
      expect((overlay as any).activeTabIndex).toBe(0);
    });

    it("wraps around on Shift+Tab from first tab", () => {
      overlay.handleInput("\x1b[Z");
      expect((overlay as any).activeTabIndex).toBe(1);
    });

    it("delegates to active tab first", () => {
      tab1.handleInput.mockReturnValue(true);
      overlay.handleInput("j");
      expect(tab1.handleInput).toHaveBeenCalledWith("j");
    });

    it("closes on escape when tab does not consume it", () => {
      overlay.handleInput("\x1b");
      expect(done).toHaveBeenCalled();
    });

    it("closes on q when tab does not consume it", () => {
      overlay.handleInput("q");
      expect(done).toHaveBeenCalled();
    });

    it("does not close when tab consumes escape", () => {
      tab1.handleInput.mockReturnValue(true);
      overlay.handleInput("\x1b");
      expect(done).not.toHaveBeenCalled();
    });

    it("does not close when tab consumes q", () => {
      tab1.handleInput.mockReturnValue(true);
      overlay.handleInput("q");
      expect(done).not.toHaveBeenCalled();
    });
  });

  describe("render", () => {
    it("renders the overlay with borders", () => {
      tab1.renderContent.mockReturnValue(["line1", "line2"]);
      const lines = overlay.render(80);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toContain("╭");
      expect(lines[lines.length - 1]).toContain("╰");
    });

    it("shows the title", () => {
      const lines = overlay.render(80);
      const titleLine = lines[1];
      expect(titleLine).toContain("Test Overlay");
    });

    it("shows tab names in the tab bar", () => {
      const lines = overlay.render(80);
      const tabBarLine = lines[2];
      expect(tabBarLine).toContain("Tab1");
      expect(tabBarLine).toContain("Tab2");
    });

    it("highlights the active tab", () => {
      overlay.render(80);
      expect(theme.fg).toHaveBeenCalledWith("accent", expect.stringContaining("Tab1"));
    });

    it("renders content from active tab", () => {
      overlay.render(80);
      expect(tab1.renderContent).toHaveBeenCalled();
    });

    it("shows footer with hints", () => {
      const lines = overlay.render(80);
      const footerLine = lines[lines.length - 2];
      expect(footerLine).toContain("q close");
    });
  });

  describe("invalidate", () => {
    it("invalidates all tabs", () => {
      overlay.invalidate();
      expect(tab1.invalidate).toHaveBeenCalled();
      expect(tab2.invalidate).toHaveBeenCalled();
    });
  });

  describe("single tab", () => {
    it("does not show Tab switch hint with one tab", () => {
      const singleOverlay = new TabbedOverlay({
        title: "Single",
        subtitle: "",
        tabs: [tab1],
        theme,
        done,
      });
      const lines = singleOverlay.render(80);
      const footerLine = lines[lines.length - 2];
      expect(footerLine).not.toContain("Tab switch");
    });
  });
});
