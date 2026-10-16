// The extension reconciles orphan "launch uncertain" rows from the widget refresh tick: throttled,
// only while such a row exists, through the subagent runtime. Display only.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { __test__ } from "../pi-extension/subagents/index.ts";
import { setSubagentRuntime } from "../pi-extension/subagents/runtime-client.ts";
import { presence } from "../pi-extension/subagents/runtime/index.ts";

describe("reconcileUncertainPresence", () => {
  const key = "/fake/presence-reconcile/attempt";
  let calls = 0;

  beforeEach(() => {
    calls = 0;
    setSubagentRuntime({ reconcilePresence: async () => { calls++; return 0; } } as any);
    presence().upsert({
      key, label: "orphan", model: "p/m", thinking: "high", startedAt: 0, state: "launch-uncertain", paneId: "pane-x",
    });
  });
  afterEach(() => {
    presence().remove(key);
    setSubagentRuntime(undefined);
  });

  it("runs at most once per interval while a launch-uncertain row exists", () => {
    const t0 = 10_000_000;
    __test__.reconcileUncertainPresence(t0);
    __test__.reconcileUncertainPresence(t0 + 1_000);
    assert.equal(calls, 1);
    __test__.reconcileUncertainPresence(t0 + 16_000);
    assert.equal(calls, 2);
  });

  it("never asks the runtime when no row is launch-uncertain", () => {
    presence().update(key, { state: "active" });
    __test__.reconcileUncertainPresence(20_000_000);
    assert.equal(calls, 0);
  });
});
