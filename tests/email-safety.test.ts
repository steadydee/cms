import assert from "node:assert/strict";
import test from "node:test";
import {
  areLiveEmailSendsAllowed,
  assertLiveEmailSendsAllowed,
  getEmailRuntimeLabel,
  isProductionEmailRuntime,
} from "../src/lib/email-safety";

test("email runtime prefers Vercel target over generic production flags", () => {
  assert.equal(getEmailRuntimeLabel({ VERCEL_TARGET_ENV: "test", VERCEL_ENV: "production" }), "test");
  assert.equal(isProductionEmailRuntime({ VERCEL_TARGET_ENV: "test", VERCEL_ENV: "production" }), false);
});

test("live email sends are allowed in production", () => {
  assert.equal(areLiveEmailSendsAllowed({ VERCEL_TARGET_ENV: "production" }), true);
  assert.doesNotThrow(() => assertLiveEmailSendsAllowed({ VERCEL_TARGET_ENV: "production" }));
});

test("live email sends are blocked in test and preview by default", () => {
  assert.equal(areLiveEmailSendsAllowed({ VERCEL_TARGET_ENV: "test" }), false);
  assert.equal(areLiveEmailSendsAllowed({ VERCEL_ENV: "preview" }), false);
  assert.throws(
    () => assertLiveEmailSendsAllowed({ VERCEL_TARGET_ENV: "test" }),
    /External email sending is disabled in test/
  );
});

test("explicit live-send flag can override non-production only when intentional", () => {
  assert.equal(
    areLiveEmailSendsAllowed({
      VERCEL_TARGET_ENV: "test",
      OW_PARTNERS_ALLOW_LIVE_EMAIL_SENDS: "true",
    }),
    true
  );
});
