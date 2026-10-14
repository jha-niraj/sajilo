/** The thing an op points at is gone (deleted on another phone): retrying won't help. */
export class NotFoundError extends Error {
    constructor(what: string) {
        super(`${what} not found`)
        this.name = "NotFoundError"
    }
}
