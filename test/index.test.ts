import type { SessionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { buildNumberedLines, buildToolsText, buildTokenBreakdown, buildTotalContextText, formatMessageForDisplay } from "../src/index.js";
import { type ContextTokenBreakdown, StatsTabContent } from "../src/stats-tab-content.js";
import { formatTokens } from "../src/utils.js";

const context = {
	messages: [
		{
			role: "user",
			content: [
				{ type: "text", text: "Inspect this" },
				{ type: "image", data: "abc", mimeType: "image/png" },
			],
			timestamp: 1,
		},
		{
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "Need context" },
				{ type: "text", text: "I will inspect it." },
				{ type: "toolCall", id: "tool-1", name: "read", arguments: { path: "AGENT.md" } },
			],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4",
			usage: {
				input: 10,
				output: 5,
				cacheRead: 2,
				cacheWrite: 1,
				totalTokens: 18,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: 2,
		},
		{
			role: "toolResult",
			toolCallId: "tool-1",
			toolName: "read",
			content: [{ type: "text", text: "file contents" }],
			isError: false,
			timestamp: 3,
		},
	],
	thinkingLevel: "off",
	model: { provider: "anthropic", modelId: "claude-sonnet-4" },
} satisfies SessionContext;

const testUsage = {
	input: 1,
	output: 1,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 2,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function messageEntry(id: string, parentId: string | null, message: Extract<SessionEntry, { type: "message" }>["message"]): SessionEntry {
	return { type: "message", id, parentId, timestamp: id, message };
}

const toolBranch: SessionEntry[] = [
	messageEntry("1", null, { role: "user", content: "Hello", timestamp: 1 }),
	messageEntry("2", "1", {
		role: "assistant",
		content: [
			{ type: "text", text: "Hi there" },
			{ type: "toolCall", name: "read", arguments: { path: "/file" }, id: "call-1" },
		],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4",
		usage: testUsage,
		stopReason: "toolUse",
		timestamp: 2,
	}),
	messageEntry("3", "2", {
		role: "toolResult",
		toolCallId: "call-1",
		toolName: "read",
		content: [{ type: "text", text: "file content here" }],
		isError: false,
		timestamp: 3,
	}),
];

describe("formatTokens", () => {
	it("formats token counts with k/M suffixes", () => {
		expect(formatTokens(500)).toBe("500");
		expect(formatTokens(1500)).toBe("2k");
		expect(formatTokens(45_230)).toBe("45k");
		expect(formatTokens(1_500_000)).toBe("1.5M");
		expect(formatTokens(null)).toBe("N/A");
		expect(formatTokens(undefined)).toBe("N/A");
	});
});

describe("StatsTabContent", () => {
	const breakdown: ContextTokenBreakdown = {
		total: 45_000,
		contextWindow: 200_000,
		percent: 22.5,
		reserveTokens: 16_384,
		safeAvailable: 138_616,
		systemPrompt: 12_000,
		systemTools: 8_000,
		tools: 10_000,
		skills: 2_000,
		messages: 12_000,
		other: 1_000,
	};

	const dummyTheme = {
		fg: (_color: string, text: string) => text,
		bg: (_color: string, text: string) => text,
		bold: (text: string) => text,
	} as any;

	it("renders content without errors when breakdown is provided", () => {
		const stats = new StatsTabContent(breakdown, dummyTheme, { name: "claude-opus-4-6" });
		const lines = stats.renderContent(80, 28);
		expect(lines.length).toBe(28);
		const text = lines.join("\n");
		expect(text).toContain("claude-opus-4-6");
		expect(text).toContain("Estimated usage by category");
		expect(text).toContain("System prompt");
		expect(text).toContain("System tools");
		expect(text).toContain("Tools");
		expect(text).toContain("Skills");
		expect(text).toContain("Messages");
		expect(text).toContain("Available");
		expect(text).toContain("Auto-compact buffer");
	});

	it("shows fallback message when no breakdown", () => {
		const stats = new StatsTabContent(null, dummyTheme);
		const lines = stats.renderContent(80, 28);
		const text = lines.join("\n");
		expect(text).toContain("No context usage data available");
	});

	it("getFooterLeft shows usage stats", () => {
		const stats = new StatsTabContent(breakdown, dummyTheme);
		const footer = stats.getFooterLeft();
		expect(footer).toContain("45k");
		expect(footer).toContain("200k");
		expect(footer).toContain("22.5%");
		expect(footer).toContain("139k safe left");
	});

	it("handleInput always returns false (no key consumption)", () => {
		const stats = new StatsTabContent(breakdown, dummyTheme);
		expect(stats.handleInput("q")).toBe(false);
		expect(stats.handleInput("\x1b")).toBe(false);
		expect(stats.handleInput("j")).toBe(false);
	});

	it("renders no reserve grid block when reserve is zero", () => {
		const zeroReserve: ContextTokenBreakdown = { ...breakdown, reserveTokens: 0, safeAvailable: 155_000 };
		const stats = new StatsTabContent(zeroReserve, dummyTheme);
		const text = stats.renderContent(80, 28).join("\n");
		expect(text.split("󰅐").length - 1).toBe(1);
	});
});

describe("context viewer formatting", () => {
	it("formats Pi assistant tool calls and usage fields", () => {
		const lines = formatMessageForDisplay(context.messages[1]!, 1);

		expect(lines).toContain("Model: anthropic/claude-sonnet-4");
		expect(lines).toContain("Tokens: input: 10, output: 5, cache-read: 2, cache-write: 1, total: 18");
		expect(lines).toContain("[Thinking: Need context]");
		expect(lines).toContain('[Tool Call: read({"path":"AGENT.md"})]');
	});

	it("formats tool result messages as top-level messages", () => {
		const lines = formatMessageForDisplay(context.messages[2]!, 2);

		expect(lines).toContain("Role: toolResult");
		expect(lines).toContain("Tool: read");
		expect(lines).toContain("Tool Call ID: tool-1");
		expect(lines).toContain("Error: no");
		expect(lines).toContain("file contents");
	});

	it("builds complete context text with usage and model metadata", () => {
		const text = buildTotalContextText(
			"system prompt",
			context,
			{ tokens: 1000, contextWindow: 2000, percent: 50 },
			{ provider: "anthropic", id: "claude-sonnet-4", contextWindow: 2000 },
		);

		expect(text).toContain("SYSTEM PROMPT");
		expect(text).toContain("system prompt");
		expect(text).toContain("MESSAGES");
		expect(text).toContain("[Image: image/png]");
		expect(text).toContain("CONTEXT USAGE");
		expect(text).toContain("Usage: 1,000 / 2,000 (50.0%)");
	});

	it("formats bash execution messages", () => {
		const lines = formatMessageForDisplay(
			{
				role: "bashExecution",
				command: "ls -la",
				output: "file1\nfile2",
				exitCode: 0,
				cancelled: false,
				truncated: true,
				fullOutputPath: "/tmp/full.log",
				timestamp: 4,
			} satisfies SessionContext["messages"][number],
			3,
		);
		expect(lines).toContain("Role: bashExecution");
		expect(lines).toContain("Command: ls -la");
		expect(lines).toContain("file1");
		expect(lines).toContain("Exit: 0 (truncated)");
		expect(lines).toContain("Full output: /tmp/full.log");
	});

	it("formats branch and compaction summary messages", () => {
		const branchLines = formatMessageForDisplay(
			{
				role: "branchSummary",
				summary: "We explored the file layout",
				fromId: "entry-1",
				timestamp: 5,
			} satisfies SessionContext["messages"][number],
			0,
		);
		expect(branchLines).toContain("Branch from: entry-1");
		expect(branchLines).toContain("We explored the file layout");

		const compactionLines = formatMessageForDisplay(
			{
				role: "compactionSummary",
				summary: "Earlier conversation summary",
				tokensBefore: 5000,
				timestamp: 6,
			} satisfies SessionContext["messages"][number],
			1,
		);
		expect(compactionLines).toContain("Tokens before: 5000");
		expect(compactionLines).toContain("Earlier conversation summary");
	});

	it("formats custom messages with their type", () => {
		const lines = formatMessageForDisplay(
			{
				role: "custom",
				customType: "artifact-index",
				content: "artifact data",
				display: true,
				timestamp: 7,
			} satisfies SessionContext["messages"][number],
			0,
		);
		expect(lines).toContain("Custom type: artifact-index");
		expect(lines).toContain("artifact data");
	});
});

describe("buildNumberedLines", () => {
	const dummyTheme = {
		fg: (_color: string, text: string) => text,
		bg: (_color: string, text: string) => text,
		bold: (text: string) => text,
	} as any;

	it("adds line numbers to each line", () => {
		const lines = buildNumberedLines("hello\nworld", dummyTheme);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("1");
		expect(lines[0]).toContain("hello");
		expect(lines[1]).toContain("2");
		expect(lines[1]).toContain("world");
	});

	it("pads line numbers to equal width", () => {
		const lines = buildNumberedLines("a\nb\nc\nd\ne\nf\ng\nh\ni\nj", dummyTheme);
		expect(lines[0]).toContain(" 1");
		expect(lines[9]).toContain("10");
	});

	it("handles empty text", () => {
		const lines = buildNumberedLines("", dummyTheme);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("1");
	});
});

describe("buildToolsText", () => {
	it("returns fallback for empty tools", () => {
		const text = buildToolsText([]);
		expect(text).toBe("(no active tools)");
	});

	it("formats tool definitions with parameters", () => {
		const tools = [
			{
				name: "read",
				description: "Read a file",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "File path" },
					},
					required: ["path"],
				},
			},
		];
		const text = buildToolsText(tools);
		expect(text).toContain("Tool: read");
		expect(text).toContain("Description: Read a file");
		expect(text).toContain("path");
		expect(text).toContain("string");
	});

	it("formats tools without parameters", () => {
		const tools = [{ name: "simple-tool", description: "A simple tool" }];
		const text = buildToolsText(tools);
		expect(text).toContain("Tool: simple-tool");
		expect(text).toContain("A simple tool");
	});
});

describe("buildTokenBreakdown", () => {
	it("returns null when no usage data", () => {
		const result = buildTokenBreakdown("system", [], [], undefined);
		expect(result).toBeNull();
	});

	it("returns null when tokens is null", () => {
		const result = buildTokenBreakdown("system", [], [], { tokens: null, contextWindow: 200000 } as any);
		expect(result).toBeNull();
	});

	it("returns null when contextWindow is missing", () => {
		const result = buildTokenBreakdown("system", [], [], { tokens: 100 } as any);
		expect(result).toBeNull();
	});

	it("accepts zero tokens as valid usage", () => {
		const result = buildTokenBreakdown("system", [], [], { tokens: 0, contextWindow: 200000 } as any);
		expect(result).not.toBeNull();
		expect(result!.total).toBe(0);
		expect(result!.safeAvailable).toBe(200000 - 16384);
	});

	it("calculates token distribution from branch entries", () => {
		const result = buildTokenBreakdown("system prompt", [], toolBranch, { tokens: 100, contextWindow: 200000 } as any);
		expect(result).not.toBeNull();
		expect(result!.total).toBe(100);
		expect(result!.systemPrompt).toBeGreaterThan(0);
		expect(result!.messages).toBeGreaterThan(0);
		expect(result!.tools).toBeGreaterThan(0);
	});

	it("identifies skill-related tool calls", () => {
		const branch: SessionEntry[] = [
			messageEntry("1", null, {
				role: "assistant",
				content: [
					{ type: "toolCall", name: "read", arguments: { path: ".agents/skills/my-skill/SKILL.md" }, id: "skill-1" },
				],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4",
				usage: testUsage,
				stopReason: "toolUse",
				timestamp: 1,
			}),
			messageEntry("2", "1", {
				role: "toolResult",
				toolCallId: "skill-1",
				toolName: "read",
				content: [{ type: "text", text: "skill content" }],
				isError: false,
				timestamp: 2,
			}),
		];
		const result = buildTokenBreakdown("system", [], branch, { tokens: 50, contextWindow: 200000 } as any);
		expect(result).not.toBeNull();
		expect(result!.skills).toBeGreaterThan(0);
	});

	it("handles compaction entries", () => {
		const branch: SessionEntry[] = [
			{ type: "compaction", id: "1", parentId: null, timestamp: "1", summary: "Previous conversation summary...", firstKeptEntryId: "0", tokensBefore: 1000 },
		];
		const result = buildTokenBreakdown("system", [], branch, { tokens: 30, contextWindow: 200000 } as any);
		expect(result).not.toBeNull();
		expect(result!.messages).toBeGreaterThan(0);
	});

	it("counts thinking and image content in the messages category", () => {
		const plain: SessionEntry[] = [
			messageEntry("1", null, { role: "user", content: "Look at this", timestamp: 1 }),
			messageEntry("2", "1", {
				role: "assistant",
				content: [{ type: "text", text: "Done" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4",
				usage: testUsage,
				stopReason: "stop",
				timestamp: 2,
			}),
		];
		const rich: SessionEntry[] = [
			messageEntry("1", null, {
				role: "user",
				content: [
					{ type: "text", text: "Look at this" },
					{ type: "image", data: "abc", mimeType: "image/png" },
				],
				timestamp: 1,
			}),
			messageEntry("2", "1", {
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "Let me think carefully about this problem" },
					{ type: "text", text: "Done" },
				],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4",
				usage: testUsage,
				stopReason: "stop",
				timestamp: 2,
			}),
		];
		const plainResult = buildTokenBreakdown("system", [], plain, { tokens: 100, contextWindow: 200000 } as any);
		const richResult = buildTokenBreakdown("system", [], rich, { tokens: 100, contextWindow: 200000 } as any);
		expect(richResult!.messages).toBeGreaterThan(plainResult!.messages);
	});

	it("allocates categories so they sum exactly to the reported total", () => {
		const result = buildTokenBreakdown("system prompt", [], toolBranch, { tokens: 100, contextWindow: 200000 } as any);
		const sum = result!.systemPrompt + result!.systemTools + result!.tools + result!.skills + result!.messages + result!.other;
		expect(sum).toBe(100);
	});
});
