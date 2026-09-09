import { test } from "node:test";
import assert from "node:assert/strict";
import { needsMe, needsOf } from "./needs.ts";
import { countSuggestions, headOf, parseSuggestion, threadAuthors } from "./matter.ts";

const file = (over: Record<string, unknown>) => ({
  path: "plan.md",
  kind: "file" as const,
  doc: "d1",
  ...over,
});

test("a reviewer who has not approved is asked, in any spelling the header accepts", () => {
  for (const reviewers of ["bob", "@bob", "Bob, sam", "@Bob @sam", "bob@example.com"]) {
    const login = reviewers.includes("@example") ? "bob@example.com" : "BOB";
    const got = needsOf(file({ status: "review", reviewers }), login);
    assert.deepEqual(got.map((n) => n.reason), ["review"], reviewers);
  }
});

test("approving, or a status other than review, clears the ask", () => {
  assert.deepEqual(needsOf(file({ status: "review", reviewers: "bob", approved: "bob" }), "bob"), []);
  assert.deepEqual(needsOf(file({ status: "draft", reviewers: "bob" }), "bob"), []);
  assert.deepEqual(needsOf(file({ status: "review", reviewers: "sam" }), "bob"), []);
});

test("the owner is told when everyone has approved, and only then", () => {
  const partly = file({ status: "review", owner: "alice", reviewers: "bob, sam", approved: "bob" });
  assert.deepEqual(needsOf(partly, "alice"), []);
  const all = file({ status: "review", owner: "alice", reviewers: "bob, sam", approved: "sam, bob" });
  assert.deepEqual(needsOf(all, "alice").map((n) => n.reason), ["approved"]);
  assert.deepEqual(needsOf(file({ ...all, status: "approved" }), "alice"), []);
  // No reviewers at all is not "everyone approved".
  assert.deepEqual(needsOf(file({ status: "review", owner: "alice" }), "alice"), []);
});

test("suggestions reach every owner, with a count", () => {
  const e = file({ status: "draft", owner: "alice, mira", asks: 2 });
  assert.equal(needsOf(e, "alice")[0].label, "2 suggestions");
  assert.equal(needsOf(e, "MIRA")[0].label, "2 suggestions");
  assert.deepEqual(needsOf(e, "bob"), []);
  assert.equal(needsOf(file({ owner: "alice", asks: 1 }), "alice")[0].label, "1 suggestion");
});

test("needsMe walks every workspace and names each", () => {
  const trees = {
    w1: [file({ status: "review", reviewers: "bob" }), { path: "docs", kind: "folder" as const, doc: null }],
    w2: [file({ path: "notes.md", owner: "bob", asks: 1 })],
  };
  const got = needsMe(trees, "bob");
  assert.deepEqual(
    got.map((n) => [n.workspace, n.path, n.reason]),
    [["w1", "plan.md", "review"], ["w2", "notes.md", "asks"]],
  );
  assert.deepEqual(needsMe(trees, null), []);
});

const SUGGEST = "<!--\n@claude suggests:\nThe old line.\n---\nThe new line.\n-->";

test("the head is the four people keys and the suggestion count", () => {
  const md = `---\nstatus: review\nowner: alice\nreviewers: bob\napproved: bob\n---\n\n# T\n\nPara.\n\n${SUGGEST}\n`;
  assert.deepEqual(headOf(md), { status: "review", owner: "alice", reviewers: "bob", approved: "bob", asks: 1 });
  assert.deepEqual(headOf("# No matter\n"), { status: null, owner: null, reviewers: null, approved: null, asks: 0 });
});

test("the suggestion grammar is strict, and a thread never counts as one", () => {
  assert.ok(parseSuggestion("\n@a suggests:\nold\n---\nnew\n"));
  assert.equal(parseSuggestion("@a: is this right?\n@b: yes"), null);
  assert.equal(parseSuggestion("@a suggests:\none\n---\ntwo\n---\nthree"), null);
  assert.equal(parseSuggestion("@a suggests:\n---\nnew"), null);
  assert.equal(countSuggestions(`x\n\n${SUGGEST}\n\n<!-- @a: hi -->\n\n${SUGGEST}`), 2);
});

test("thread authors are the signers of open threads, without the proposers", () => {
  const md = `<!-- @Bob: a point -->\n\n<!--\n@sam: another\n@bob: reply\n-->\n\n${SUGGEST}\n\n<!-- unsigned -->`;
  assert.deepEqual(threadAuthors(md), ["bob", "sam"]);
});
