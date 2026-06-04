import assert from "node:assert/strict";
import test from "node:test";
import { getContactStage, getStatusDisplayLabel, isContactedStage } from "../src/lib/partners-ui";

test("not-contacted accounts are researching until a direct contact channel exists", () => {
  assert.equal(getContactStage({ status: "not_contacted" }), "researching");
  assert.equal(getContactStage({ status: "not_contacted", email: "info@example.com" }), "ready");
  assert.equal(getContactStage({
    status: "not_contacted",
    contacts: [{ whatsapp: "+15550001001" }],
  }), "ready");
});

test("relationship statuses map to CRM stages", () => {
  assert.equal(getContactStage({ status: "awaiting_reply" }), "outreach_sent");
  assert.equal(getContactStage({ status: "proposal_sent" }), "in_conversation");
  assert.equal(getContactStage({ status: "active_partner" }), "active_partner");
  assert.equal(getContactStage({ status: "not_interested" }), "dormant");
});

test("contacted stage helper tracks stages with outreach history", () => {
  assert.equal(isContactedStage("researching"), false);
  assert.equal(isContactedStage("ready"), false);
  assert.equal(isContactedStage("outreach_sent"), true);
  assert.equal(isContactedStage("active_partner"), true);
});

test("relationship statuses have operator-facing labels", () => {
  assert.equal(getStatusDisplayLabel("not_contacted"), "Researching");
  assert.equal(getStatusDisplayLabel("awaiting_reply"), "Awaiting Reply");
  assert.equal(getStatusDisplayLabel("active_partner"), "Active Partner");
});
