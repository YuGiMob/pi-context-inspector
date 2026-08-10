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

import { ScrollableBase } from "../src/scrollable-base.js";

class TestScrollable extends ScrollableBase {
  constructor(
    private opts: { rawText: string; displayLines: string[]; theme: any },
  ) {
    super();
  }

  protected get rawText(): string { return this.opts.rawText; }
  protected get displayLines(): string[] { return this.opts.displayLines; }
  protected get theme(): any { return this.opts.theme; }
}

function createTheme() {
  return {
    fg: vi.fn((_color: string, text: string) => text),
    bg: vi.fn((_color: string, text: string) => text),
    bold: vi.fn((text: string) => text),
  };
}

describe("ScrollableBase", () => {
  let base: TestScrollable;
  let theme: ReturnType<typeof createTheme>;

  beforeEach(() => {
    theme = createTheme();
    base = new TestScrollable({
      rawText: "line1\nline2\nline3",
      displayLines: ["line1", "line2", "line3"],
      theme,
    });
  });

  describe("initial state", () => {
    it("starts at scroll offset 0", () => {
      expect((base as any).scrollOffset).toBe(0);
    });

    it("starts with search mode off", () => {
      expect((base as any).searchMode).toBe(false);
    });

    it("starts with empty search query", () => {
      expect((base as any).searchQuery).toBe("");
    });
  });

  describe("buildVisualLines", () => {
    it("builds visual lines for content that fits", () => {
      (base as any).buildVisualLines(80);
      expect((base as any).visualLines).toHaveLength(3);
      expect((base as any).visualTotal).toBe(3);
    });

    it("wraps long lines", () => {
      const longLine = "a".repeat(200);
      const longBase = new TestScrollable({
        rawText: longLine,
        displayLines: [longLine],
        theme,
      });
      (longBase as any).buildVisualLines(80);
      expect((longBase as any).visualTotal).toBeGreaterThan(1);
      const rendered = (longBase as any).visualLines.join("");
      expect(rendered.replace(/[^a]/g, "")).toHaveLength(200);
    });
  });

  describe("handleSearchInput", () => {
    it("returns false when not in search mode", () => {
      expect((base as any).handleSearchInput("x")).toBe(false);
    });

    it("enters search mode and handles printable characters", () => {
      (base as any).searchMode = true;
      const result = (base as any).handleSearchInput("x");
      expect(result).toBe(true);
      expect((base as any).searchQuery).toBe("x");
    });

    it("exits search mode on escape", () => {
      (base as any).searchMode = true;
      (base as any).searchQuery = "test";
      const result = (base as any).handleSearchInput("\x1b");
      expect(result).toBe(true);
      expect((base as any).searchMode).toBe(false);
      expect((base as any).searchQuery).toBe("");
    });

    it("confirms search on enter", () => {
      (base as any).searchMode = true;
      (base as any).searchQuery = "line";
      const result = (base as any).handleSearchInput("\r");
      expect(result).toBe(true);
      expect((base as any).searchMode).toBe(false);
    });

    it("handles backspace in search mode", () => {
      (base as any).searchMode = true;
      (base as any).searchQuery = "test";
      const result = (base as any).handleSearchInput("\x7f");
      expect(result).toBe(true);
      expect((base as any).searchQuery).toBe("tes");
    });

    it("swallows all keys in search mode", () => {
      (base as any).searchMode = true;
      const result = (base as any).handleSearchInput("\x1b");
      expect(result).toBe(true);
    });

    it("clears matches on escape", () => {
      (base as any).searchMode = true;
      (base as any).searchQuery = "line";
      (base as any).searchMatches = [0, 1];
      (base as any).currentMatchIndex = 0;
      (base as any).handleSearchInput("\x1b");
      expect((base as any).searchMatches).toEqual([]);
      expect((base as any).currentMatchIndex).toBe(-1);
    });
  });

  describe("findMatches", () => {
    it("finds matching lines", () => {
      (base as any).searchQuery = "line";
      (base as any).findMatches();
      expect((base as any).searchMatches).toEqual([0, 1, 2]);
    });

    it("returns empty when no matches", () => {
      (base as any).searchQuery = "xyz";
      (base as any).findMatches();
      expect((base as any).searchMatches).toEqual([]);
    });

    it("resets match index when query is empty", () => {
      (base as any).currentMatchIndex = 5;
      (base as any).searchQuery = "";
      (base as any).findMatches();
      expect((base as any).currentMatchIndex).toBe(-1);
    });
  });

  describe("scrollDown / scrollUp", () => {
    it("scrolls down by the given amount", () => {
      (base as any).visualTotal = 100;
      (base as any).scrollDown(5, 90);
      expect((base as any).scrollOffset).toBe(5);
    });

    it("scrolls up by the given amount", () => {
      (base as any).scrollOffset = 50;
      (base as any).scrollUp(10);
      expect((base as any).scrollOffset).toBe(40);
    });

    it("does not scroll below 0", () => {
      (base as any).scrollOffset = 5;
      (base as any).scrollUp(10);
      expect((base as any).scrollOffset).toBe(0);
    });

    it("does not scroll beyond maxOffset", () => {
      (base as any).visualTotal = 100;
      (base as any).scrollOffset = 95;
      (base as any).scrollDown(10, 90);
      expect((base as any).scrollOffset).toBe(90);
    });
  });

  describe("scrollToBottom", () => {
    it("scrolls to the max offset", () => {
      (base as any).visualTotal = 100;
      (base as any).scrollToBottom(70);
      expect((base as any).scrollOffset).toBe(70);
    });
  });

  describe("nextMatch / prevMatch", () => {
    it("navigates to next match", () => {
      (base as any).searchMatches = [0, 5, 10];
      (base as any).currentMatchIndex = 0;
      (base as any).nextMatch();
      expect((base as any).currentMatchIndex).toBe(1);
    });

    it("wraps around on nextMatch", () => {
      (base as any).searchMatches = [0, 5, 10];
      (base as any).currentMatchIndex = 2;
      (base as any).nextMatch();
      expect((base as any).currentMatchIndex).toBe(0);
    });

    it("navigates to previous match", () => {
      (base as any).searchMatches = [0, 5, 10];
      (base as any).currentMatchIndex = 1;
      (base as any).prevMatch();
      expect((base as any).currentMatchIndex).toBe(0);
    });

    it("wraps around on prevMatch", () => {
      (base as any).searchMatches = [0, 5, 10];
      (base as any).currentMatchIndex = 0;
      (base as any).prevMatch();
      expect((base as any).currentMatchIndex).toBe(2);
    });

    it("does nothing when no matches", () => {
      (base as any).searchMatches = [];
      (base as any).currentMatchIndex = -1;
      (base as any).nextMatch();
      expect((base as any).currentMatchIndex).toBe(-1);
    });
  });

  describe("invalidate", () => {
    it("resets visual line cache", () => {
      (base as any).visualLines = ["a", "b"];
      (base as any).visualToLogical = [0, 1];
      (base as any).visualTotal = 2;

      (base as any).invalidate();

      expect((base as any).visualLines).toEqual([]);
      expect((base as any).visualToLogical).toEqual([]);
      expect((base as any).visualTotal).toBe(0);
    });
  });
});
