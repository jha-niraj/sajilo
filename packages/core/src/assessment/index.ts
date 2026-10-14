/**
 * The shared contract for continuous assessment.
 *
 * Read by `apps/admin` (which AUTHORS a country framework, its rating scale and its default rules)
 * and by `apps/main` (which APPLIES a school's). One definition of how a judgement is computed, for
 * the same reason the permission catalogue moved here: two copies of a rule disagree eventually, and
 * whichever half is laxer becomes the real policy.
 *
 * Everything here is pure - no database, no `server-only`, no framework imports - so it runs in a
 * server action, in the admin app, and in a unit test unchanged.
 */
export * from './rating-scale';
export * from './grade-scale';
export * from './rules';
export * from './rollup';
