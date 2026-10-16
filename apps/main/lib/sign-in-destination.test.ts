import { describe, expect, it } from "vitest"
import { HOME_AFTER_SIGN_IN, signInDestination } from "./sign-in-destination"

describe("signInDestination", () => {
    it("defaults to Munshi", () => {
        expect(signInDestination("")).toBe(HOME_AFTER_SIGN_IN)
        expect(signInDestination("?other=1")).toBe(HOME_AFTER_SIGN_IN)
    })
    it("keeps a same-site app path with its query", () => {
        expect(signInDestination("?returnTo=%2Ftoday")).toBe("/today")
        expect(signInDestination("?returnTo=%2Fcustomers%2Fabc%3Ffrom%3Dtoday")).toBe("/customers/abc?from=today")
    })
    it("refuses other sites and odd paths", () => {
        for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com"]) {
            expect(signInDestination(`?returnTo=${encodeURIComponent(bad)}`)).toBe(HOME_AFTER_SIGN_IN)
        }
        expect(signInDestination(`?returnTo=${encodeURIComponent("/\r\nx")}`)).toBe(HOME_AFTER_SIGN_IN)
    })
    it("never lands on the auth pages or the API", () => {
        for (const p of ["/", "/login", "/signup", "/api/auth/sign-out", "/_next/static/x.js"]) {
            expect(signInDestination(`?returnTo=${encodeURIComponent(p)}`)).toBe(HOME_AFTER_SIGN_IN)
        }
    })
})
