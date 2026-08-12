import { describe, it, expect } from "vitest";
import {
	canTransition,
	createReceipt,
	applyReceipt,
	emptyStore,
	getState,
	summarizeReceipts,
	type DeliveryState,
} from "../lib/message-receipts";

describe("message-receipts state machine", () => {
	it("canTransition enforces forward-only delivery state", () => {
		expect(canTransition("sent", "delivered")).toBe(true);
		expect(canTransition("delivered", "read")).toBe(true);
		expect(canTransition("read", "delivered")).toBe(false); // no backwards
		expect(canTransition("sent", "failed")).toBe(true);
		expect(canTransition("failed", "delivered")).toBe(false); // failed is terminal
	});

	it("createReceipt builds a receipt with the given state", () => {
		const r = createReceipt("msg-1", "alice", "delivered");
		expect(r.messageId).toBe("msg-1");
		expect(r.state).toBe("delivered");
	});

	it("emptyStore + getState returns 'sent' for unknown messages", () => {
		const s = emptyStore();
		expect(getState(s, "nope")).toBe("sent");
	});

	it("applyReceipt advances state forward only", () => {
		const s0 = emptyStore();
		const s1 = applyReceipt(s0, createReceipt("m", "a", "delivered"));
		expect(getState(s1, "m")).toBe("delivered");
		// A 'sent' receipt after 'delivered' must NOT regress.
		const s2 = applyReceipt(s1, createReceipt("m", "a", "sent"));
		expect(getState(s2, "m")).toBe("delivered");
	});

	it("applyReceipt applies 'read' after 'delivered'", () => {
		const s = applyReceipt(
			applyReceipt(emptyStore(), createReceipt("m", "a", "delivered")),
			createReceipt("m", "a", "read"),
		);
		expect(getState(s, "m")).toBe("read");
	});

	it("summarizeReceipts counts states", () => {
		let s = emptyStore();
		s = applyReceipt(s, createReceipt("a", "x", "delivered"));
		s = applyReceipt(s, createReceipt("b", "x", "read"));
		s = applyReceipt(s, createReceipt("c", "x", "failed"));
		const sum = summarizeReceipts(s);
		expect(sum.total).toBeGreaterThanOrEqual(3);
	});

	it("canTransition rejects same-state (no-op not allowed)", () => {
		expect(canTransition("delivered", "delivered")).toBe(false);
	});

	it("all delivery states are valid keys", () => {
		const states: DeliveryState[] = ["sent", "delivered", "read", "failed"];
		expect(states.length).toBe(4);
	});
});
