import assert from "node:assert/strict";
import test from "node:test";

test("全ルートにセキュリティヘッダーを設定する", async () => {
  const { default: nextConfig } = await import("../next.config.mjs");
  const routes = await nextConfig.headers();

  assert.equal(routes.length, 1);
  assert.equal(routes[0].source, "/:path*");

  const headers = new Map(
    routes[0].headers.map(({ key, value }) => [key.toLowerCase(), value])
  );
  const csp = headers.get("content-security-policy");

  assert.ok(csp?.includes("default-src 'self'"));
  assert.ok(csp?.includes("frame-ancestors 'none'"));
  assert.ok(csp?.includes("object-src 'none'"));
  assert.ok(csp?.includes("form-action 'self'"));
  assert.ok(csp?.includes("script-src 'self' 'unsafe-inline'"));
  assert.ok(!csp?.includes("'unsafe-eval'"));
  assert.ok(csp?.includes("connect-src 'self'"));
  assert.ok(csp?.includes("img-src 'self' blob: data:"));
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("referrer-policy"), "no-referrer");
  assert.equal(
    headers.get("permissions-policy"),
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()"
  );
  assert.equal(headers.get("strict-transport-security"), "max-age=31536000");
});
