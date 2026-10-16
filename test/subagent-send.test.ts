// subagent_send / socket send: a working child is steered in its current run, an idle one gets a new task.
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { __test__ } from "../pi-extension/subagents/index.ts";
import { setSubagentRuntime } from "../pi-extension/subagents/runtime-client.ts";

describe("sendToRunningSubagent", () => {
  const handle = { taskId: "t1", protocolDir: "/fake/p" } as any;
  const calls: string[] = [];
  const running = () => ({ id: "a", name: "A", handle }) as any;
  const fakeRuntime = (kind: string) =>
    ({
      observe: async () => ({ kind, requests: [] }),
      steer: async (_h: unknown, prompt: string) => { calls.push(`steer:${prompt}`); return { steerId: "s" }; },
      dispatch: async (h: any, input: { taskId: string; prompt: string }) => {
        calls.push(`dispatch:${input.prompt}`);
        return { ...h, taskId: input.taskId };
      },
    }) as any;

  afterEach(() => {
    calls.length = 0;
    setSubagentRuntime(undefined);
  });

  it("steers a working (active) child in its current task, keeping the handle", async () => {
    setSubagentRuntime(fakeRuntime("active"));
    const agent = running();
    const result = await __test__.sendToRunningSubagent(agent, "also X");
    assert.deepEqual(calls, ["steer:also X"]);
    assert.equal(result.mode, "steer");
    assert.equal(result.taskId, "t1");
    assert.equal(agent.handle, handle);
  });

  it("starts a new task on a settled child and keeps the handle dispatch returns", async () => {
    setSubagentRuntime(fakeRuntime("settled"));
    const agent = running();
    const result = await __test__.sendToRunningSubagent(agent, "next", "t2");
    assert.deepEqual(calls, ["dispatch:next"]);
    assert.equal(result.mode, "task");
    assert.equal(agent.handle.taskId, "t2");
  });

  it("does not steer a child that has not started its task: the runtime refuses the dispatch", async () => {
    const runtime = fakeRuntime("starting");
    runtime.dispatch = async () => { throw new Error("Previous task is not demonstrably settled"); };
    setSubagentRuntime(runtime);
    await assert.rejects(__test__.sendToRunningSubagent(running(), "x"), /not demonstrably settled/);
    assert.deepEqual(calls, []);
  });

  it("rejects an empty message and a missing handle", async () => {
    setSubagentRuntime(fakeRuntime("active"));
    await assert.rejects(__test__.sendToRunningSubagent(running(), "   "), /non-empty/);
    await assert.rejects(__test__.sendToRunningSubagent({ id: "a", name: "A" } as any, "x"), /no active handle/);
  });
});
