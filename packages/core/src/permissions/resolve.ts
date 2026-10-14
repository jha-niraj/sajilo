import { ROLE_PERMISSIONS } from './index';

/**
 * The permission-resolution ALGORITHM, shared by every app that enforces it.
 *
 * `apps/main` and `apps/services` both have to answer "what can this user do", and they must
 * answer it identically. Two implementations of that question is the duplication most likely to
 * become a security hole: they drift, and whichever is laxer silently becomes the real policy.
 * So the rules live here once, and each app supplies its own database rows.
 *
 * Deliberately takes plain data rather than a db handle - `apps/main` reads through drizzle on
 * Node, the worker reads through neon-http on workerd, and this file has to run in both.
 *
 * The rules themselves are the ones documented in the root CLAUDE.md:
 *
 *  - PRINCIPAL bypasses everything.
 *  - An ASSIGNED school role is authoritative, INCLUDING when its permission list is empty -
 *    that means "no module access". Falling back to the STAFF baseline there would be an
 *    over-grant, and it is a mistake that reads as generosity rather than as a bug.
 *  - A deactivated role grants nothing.
 *  - Only a member with NO school role at all inherits the STAFF baseline.
 */

/** Granted to every authenticated staff member so they always have a landing page. */
export const ALWAYS_ON_PERMISSIONS = ['dashboard:view', 'school:view'] as const;

export interface MemberPermissionInput {
    role: string;
    schoolRoleId: string | null;
    /** The assigned school role, or null when none is assigned or it was not found. */
    schoolRole: { permissions: string[]; isActive: boolean } | null;
    overrides: {
        customPermissions: string[];
        restrictedPermissions: string[];
        overrideDefaults: boolean;
    } | null;
}

export function computeEffectivePermissions(input: MemberPermissionInput): string[] {
    if (input.role === 'PRINCIPAL') {
        return [...(ROLE_PERMISSIONS.PRINCIPAL as unknown as string[])];
    }

    const base: string[] = input.schoolRoleId
        ? (input.schoolRole?.isActive ? (input.schoolRole.permissions ?? []) : [])
        : [...(ROLE_PERMISSIONS.STAFF as unknown as string[])];

    const mp = input.overrides;
    let effective: string[];
    if (mp?.overrideDefaults && mp.customPermissions.length > 0) {
        // "Use exactly this list." Restrictions are not consulted on this branch, so the baseline
        // is unioned rather than made restrictable - nobody can be locked out of their own home.
        effective = [...new Set([...mp.customPermissions, ...ALWAYS_ON_PERMISSIONS])];
    } else {
        /*
         * `ALWAYS_ON_PERMISSIONS` joins the BASE, so an explicit restriction can still take it away.
         *
         * It used to be appended at the very end, after `restrictedPermissions` had been removed,
         * which handed the permission straight back to a member the principal had just taken it
         * from. `school:view` is one of the two, and it is not decorative: it gates the whole
         * School Website section and, through `student-portal-credentials.action.ts`, the list of
         * every student's portal username and login status. A principal who revoked it did not get
         * what they asked for and had no way to tell.
         *
         * A member with no school role still starts from the STAFF baseline, so removing this line
         * takes nothing away from anyone the principal has not deliberately restricted.
         */
        const merged = new Set<string>([...base, ...ALWAYS_ON_PERMISSIONS, ...(mp?.customPermissions ?? [])]);
        (mp?.restrictedPermissions ?? []).forEach((p) => merged.delete(p));
        effective = [...merged];
    }

    return [...new Set(effective)];
}
