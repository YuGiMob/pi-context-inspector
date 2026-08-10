import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@earendil-works/pi-coding-agent", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@earendil-works/pi-tui", () => ({
  Key: {
    escape: "\x1b",
    enter: "\r",
    backspace: "\x7f",
    down: "\x1b[B",
    up: "\x1b[A",
    home: "\x1b[H",
    end: "\x1b[F",
    pageDown: "\x1b[6~",
    pageUp: "\x1b[5~",
    ctrl: (key: string) => `ctrl-${key}`,
  },
  matchesKey: (data: string, key: any) => {
    if (key === "\x1b") return data === "\x1b";
    if (key === "\r") return data === "\r";
    if (key === "\x7f") return data === "\x7f";
    if (key === "\x1b[B") return data === "\x1b[B";
    if (key === "\x1b[A") return data === "\x1b[A";
    if (key === "\x1b[H") return data === "\x1b[H";
    if (key === "\x1b[F") return data === "\x1b[F";
    if (key === "\x1b[6~") return data === "\x1b[6~";
    if (key === "\x1b[5~") return data === "\x1b[5~";
    if (key === "ctrl-f") return data === "\x06";
    if (key === "ctrl-b") return data === "\x02";
    if (key === "ctrl-d") return data === "\x04";
    if (key === "ctrl-u") return data === "\x15";
    return false;
  },
  visibleWidth: (s: string) => s.length,
  sliceByColumn: (s: string, start: number, length: number) => s.slice(start, start + length),
  wrapTextWithAnsi: (s: string, width: number) => {
    const lines: string[] = [];
    for (let i = 0; i < s.length; i += width) {
      lines.push(s.slice(i, i + width));
    }
    return lines.length > 0 ? lines : [""];
  },
}));

vi.mock("../src/tabbed-overlay.js", () => ({
  CONTENT_HEIGHT: 28,
  TabContent: class {},
}));

import { ScrollableTabContent } from "../src/scrollable-tab-content.js";

function createTheme(): any {
  return {
    fg: vi.fn((_color: string, text: string) => text),
    bg: vi.fn((_color: string, text: string) => text),
    bold: vi.fn((text: string) => text),
  };
}

describe("ScrollableTabContent", () => {
  let theme: ReturnType<typeof createTheme>;
  let content: ScrollableTabContent;

  beforeEach(() => {
    theme = createTheme();
    content = new ScrollableTabContent(
      {
        rawText: "line1\nline2\nline3\nline4\nline5",
        displayLines: ["line1", "line2", "line3", "line4", "line5"],
        theme,
      },
      "TestTab",
    );
  });

  describe("name", () => {
    it("has the provided name", () => {
      expect(content.name).toBe("TestTab");
    });

    it("defaults to empty string", () => {
      const unnamed = new ScrollableTabContent({
        rawText: "test",
        displayLines: ["test"],
        theme,
      });
      expect(unnamed.name).toBe("");
    });
  });

  describe("footerHints", () => {
    it("provides scroll/search/copy hints", () => {
      expect(content.footerHints).toContain("scroll");
      expect(content.footerHints).toContain("search");
      expect(content.footerHints).toContain("copy");
    });
  });

  describe("getAboveContentLine", () => {
    it("returns null when not searching and no matches", () => {
      expect(content.getAboveContentLine(80)).toBeNull();
    });

    it("returns search bar when in search mode", () => {
      (content as any).searchMode = true;
      (content as any).searchQuery = "test";
      const line = content.getAboveContentLine(80);
      expect(line).toContain("/");
      expect(line).toContain("test");
    });

    it("returns match info when matches exist", () => {
      (content as any).searchMatches = [0, 2];
      (content as any).currentMatchIndex = 0;
      (content as any).searchQuery = "line";
      const line = content.getAboveContentLine(80);
      expect(line).toContain("/");
      expect(line).toContain("1/2");
    });

    it("reports zero matches after a committed search with no results", () => {
      (content as any).searchQuery = "zzz";
      (content as any).findMatches();
      const line = content.getAboveContentLine(80);
      expect(line).not.toBeNull();
      expect(line).toContain("0 matches");
    });
  });

  describe("getFooterLeft", () => {
    it("shows scroll position", () => {
      (content as any).visualTotal = 5;
      const footer = content.getFooterLeft();
      expect(footer).toContain("1/5");
      expect(footer).toContain("Top");
    });

    it("shows Bot when at bottom", () => {
      (content as any).visualTotal = 5;
      (content as any).scrollOffset = 4;
      const footer = content.getFooterLeft();
      expect(footer).toContain("Bot");
    });

    it("shows percentage when scrolled", () => {
      (content as any).visualTotal = 100;
      (content as any).scrollOffset = 50;
      const footer = content.getFooterLeft();
      expect(footer).toContain("%");
    });
  });

  describe("handleInput", () => {
    it("scrolls down on j", () => {
      (content as any).visualTotal = 100;
      content.handleInput("j");
      expect((content as any).scrollOffset).toBe(1);
    });

    it("scrolls up on k", () => {
      (content as any).scrollOffset = 5;
      (content as any).visualTotal = 100;
      content.handleInput("k");
      expect((content as any).scrollOffset).toBe(4);
    });

    it("goes to top on g", () => {
      (content as any).scrollOffset = 50;
      content.handleInput("g");
      expect((content as any).scrollOffset).toBe(0);
    });

    it("goes to bottom on G", () => {
      (content as any).visualTotal = 100;
      (content as any).scrollOffset = 0;
      content.handleInput("G");
      expect((content as any).scrollOffset).toBe(72);
    });

    it("enters search mode on /", () => {
      content.handleInput("/");
      expect((content as any).searchMode).toBe(true);
    });

    it("returns false for q (let TabbedOverlay handle it)", () => {
      const result = content.handleInput("q");
      expect(result).toBe(false);
    });

    it("returns false for escape (let TabbedOverlay handle it)", () => {
      const result = content.handleInput("\x1b");
      expect(result).toBe(false);
    });

    it("returns true for consumed keys", () => {
      expect(content.handleInput("j")).toBe(true);
      expect(content.handleInput("k")).toBe(true);
      expect(content.handleInput("g")).toBe(true);
      expect(content.handleInput("G")).toBe(true);
      expect(content.handleInput("/")).toBe(true);
      expect(content.handleInput("n")).toBe(true);
      expect(content.handleInput("N")).toBe(true);
      expect(content.handleInput("y")).toBe(true);
    });
  });

  describe("renderContent", () => {
    it("renders the specified number of lines", () => {
      const lines = content.renderContent(80, 3);
      expect(lines).toHaveLength(3);
    });

    it("renders content lines", () => {
      const lines = content.renderContent(80, 5);
      expect(lines[0]).toBe("line1");
      expect(lines[4]).toBe("line5");
    });

    it("fills remaining space with dim lines", () => {
      const lines = content.renderContent(80, 10);
      expect(lines).toHaveLength(10);
      expect(lines[5]).toBe("~");
    });

    it("highlights current search match", () => {
      (content as any).searchQuery = "line3";
      (content as any).findMatches();
      (content as any).currentMatchIndex = 0;
      content.renderContent(80, 5);
      expect(theme.bg).toHaveBeenCalledWith("selectedBg", "line3");
    });
  });
});
