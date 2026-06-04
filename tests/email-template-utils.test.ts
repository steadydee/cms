import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmailTemplateBody } from "../src/lib/email-template-utils";

test("email template normalization converts Windows newlines", () => {
  assert.equal(normalizeEmailTemplateBody("Hello\r\n\r\nWorld"), "Hello\n\nWorld");
});

test("email template normalization converts escaped newline sequences", () => {
  assert.equal(normalizeEmailTemplateBody("Hello\\nWorld"), "Hello\nWorld");
  assert.equal(normalizeEmailTemplateBody("Hello\\r\\nWorld"), "Hello\nWorld");
});
