// Always pass a prefetch kind: AUTO = the route's shell down to its loading.tsx (a few kB),
// FULL = the page rendered with its data. (16.3 defaults to AUTO; Next 15 defaulted to FULL.)
export { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types"
