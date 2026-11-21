import { Elysia } from "elysia";

export const securityHeadersMiddleware = new Elysia({
  name: "security-headers",
}).onRequest(({ set }) => {
  set.headers["x-content-type-options"] = "nosniff";
  set.headers["x-frame-options"] = "DENY";
  set.headers["referrer-policy"] = "no-referrer";
  set.headers["x-xss-protection"] = "0";
});
