/**
 * GURUKUL - School Management System
 * Role-Based Access Control (RBAC) Configuration
 * 
 * This file defines permissions and access controls for different roles.
 * All permission checks should reference this configuration.
 */

// ===========================================
// ROLE DEFINITIONS
// ===========================================

export const ROLES = {
    PRINCIPAL: 'PRINCIPAL',
    ADMIN: 'ADMIN',
    TEACHER: 'TEACHER',
    ACCOUNTANT: 'ACCOUNTANT',
    STAFF: 'STAFF',
    PARENT: 'PARENT',
    STUDENT: 'STUDENT',
} as const;

export type Role = keyof typeof ROLES;

// ===========================================
// PERMISSION DEFINITIONS
// ===========================================

export const PERMISSIONS = {
    // School Management
    'school:view': 'View school information',
    'school:edit': 'Edit school settings',
    'school:invite': 'Send invitations',
    'school:remove_member': 'Remove members',
    'school:view_activity': 'View activity logs',
    'school:manage_permissions': 'Manage user permissions',
    'school:approve_join_requests': 'Approve join requests',
    // The school's OWN subscription - not the `billing:*` permissions, which are about charging
    // parents. Putting the school on a paid plan spends the school's money, so it cannot ride on
    // "is signed in", which is all the checkout flow used to require.
    'school:manage_subscription': 'Change the school subscription plan and pay',
    /*
     * Handing out the credits the school already owns - WITHOUT the ability to buy more.
     *
     * A principal cannot always be there, and until now the only way to let somebody else allocate
     * credits was `school:manage_subscription`, which also carries top-up, purchase and the plan
     * itself. Spending the school's money and distributing what it has already bought are two
     * different acts, and a school should be able to delegate the second without the first.
     */
    'credits:manage': 'Give out and take back school credits, and answer credit requests',

    // Staff Management
    'staff:manage': 'Manage staff (overview, leaves, appraisals, documents, certificates)',
    'staff:delete_permanent': 'Permanently erase a former staff member and their personal data (cannot be undone)',

    // Student Management
    'students:view': 'View student list',
    'students:view_details': 'View student details',
    'students:create': 'Add new students',
    'students:edit': 'Edit student details',
    'students:delete': 'Remove (archive) students - restorable',
    'students:delete_permanent': 'Permanently erase a student and their personal data (cannot be undone)',
    'students:promote': 'Promote students to the next class',
    'students:transfer_certificate': 'Generate transfer certificates',
    'students:view_reports': 'View student reports',
    'students:view_health': 'View student health & medical info',
    'students:view_sensitive': 'Reveal full ID numbers (citizenship, birth certificate) and see caste, ethnicity, religion and disability',
    'students:view_billing': 'View student billing on the profile',

    // Attendance
    'attendance:view': 'View attendance records',
    'attendance:mark': 'Mark attendance',
    'attendance:bulk_mark': 'Mark bulk attendance',
    'attendance:edit': 'Edit past attendance',
    'attendance:reports': 'Generate attendance reports',

    // Assignments & Lesson Plans
    'assignments:manage': 'Create assignments and lesson plans',

    // Billing & Fees
    'billing:view': 'View bills and fees',
    'billing:create': 'Create new bills',
    'billing:edit': 'Edit bills',
    'billing:delete': 'Delete bills',
    'billing:collect_payment': 'Collect payments',
    'billing:refund': 'Process refunds',
    'billing:bulk_create': 'Create bulk bills',
    'billing:reports': 'Generate billing reports',
    'billing:manage_fee_structure': 'Manage fee structures',

    // Examinations
    'exams:view': 'View exams and schedules',
    'exams:create': 'Create exams',
    'exams:edit': 'Edit exams',
    'exams:delete': 'Delete exams',
    'exams:schedule': 'Schedule exams',
    'exams:enter_marks': 'Enter marks',
    'exams:edit_marks': 'Edit marks',
    'exams:approve_marks': 'Approve marks',
    'exams:publish_results': 'Publish results',
    'exams:generate_question_paper': 'Generate question papers',
    'exams:delete_question_paper': 'Delete question papers',
    // Deliberately SEPARATE from generating papers. Writing questions and rewriting a paper's
    // history are different powers: restoring an old version replaces every question on a paper
    // other people may already be teaching towards, and it is the one action that can undo
    // somebody else's reviewed work in a single click. A school decides who gets it.
    'exams:manage_question_paper_versions': 'Restore earlier versions of a question paper',
    'exams:view_analytics': 'View exam analytics',
    // Unscoped access: holders see EVERY class's exams/papers/results in the school. Without it, a
    // user is scoped to the classes they class-teach + subjects they teach (teacherClassAssignments).
    'exams:view_all': 'View all classes exams (not just assigned)',

    // Reports
    'reports:view': 'View reports',
    'reports:generate': 'Generate reports',
    'reports:approve': 'Approve reports',
    'reports:publish': 'Publish reports',
    'reports:send': 'Send reports to parents',

    // Teachers
    'teachers:view': 'View teacher list',
    'teachers:manage': 'Manage teachers',
    'teachers:view_schedule': 'View teacher schedules',
    'teachers:edit_schedule': 'Edit teacher schedules',
    'teachers:approve_leave': 'Approve teacher leave',

    // Timetable & Scheduling (the class period timetable: builder + calendar view)
    'timetable:view': 'View the class timetable and calendar',
    'timetable:edit': 'Build and edit the class timetable (assign periods, publish versions)',

    // Lesson Plan 2.0 (the teaching spine: yearly plan, blueprints, delivery). Scope for the
    // "view/adapt/log" abilities comes from teacherClassAssignments (own classes/subjects), NOT a
    // role name; "view_all"/"view_pacing" are unscoped, and "author/publish/edit_baseline" are
    // school-level acts. See srs/lessonplan/10.
    'lessonplan:view': 'View schemes and blueprints for your own classes/subjects',
    'lessonplan:view_all': 'View every subject and class lesson plan (not just assigned)',
    'lessonplan:author_scheme': 'Create, edit and regenerate a yearly scheme of work',
    'lessonplan:publish_scheme': 'Publish a scheme (make it visible to teachers/students)',
    'lessonplan:generate_blueprints': 'Generate a unit\'s lesson blueprints (spends credits)',
    'lessonplan:adapt': 'Adapt a blueprint for a class-section you teach',
    // The everyday right: change a lesson plan you own or were handed - its pages, its
    // pictures, its questions, its videos. Twenty-one server actions have required this
    // string since the paged plan shipped; it was never added here, so it was in nobody's
    // effective list and every non-PRINCIPAL was refused while the UI showed the controls
    // enabled. Granted to TEACHER and STAFF by default, because writing a plan and then
    // being unable to touch it is not a permission model, it is a bug.
    'lessonplan:edit': 'Edit a lesson plan you own or were handed (pages, pictures, questions)',
    'lessonplan:edit_baseline': 'Change the school baseline blueprint for all sections',
    'lessonplan:log': 'Record lesson delivery (the one-tap log)',
    'lessonplan:view_pacing': 'View the syllabus-health / pacing board across subjects',
    'lessonplan:assign': 'Hand a lesson plan to another teacher to teach',
    'lessonplan:manage_registers': 'Open and close teaching registers, and countersign a teacher\'s sheet',
    'departments:view_all': 'See every department, and the documents inside them',

    // Announcements & Communication
    'announcements:view': 'View announcements',
    'announcements:create': 'Create announcements',
    'announcements:edit': 'Edit announcements',
    'announcements:delete': 'Delete announcements',
    'communication:send_sms': 'Send SMS',
    'communication:send_email': 'Send emails',

    // Dashboard & Analytics
    'dashboard:view': 'View dashboard',
    'dashboard:analytics': 'View analytics',
    'dashboard:financial': 'View financial overview',

    // Finance
    /*
     * Every write in `actions/finance/` was gated on `dashboard:financial`, which this catalogue
     * calls "View financial overview" - so granting a member the finance DASHBOARD also let them
     * generate the month's payroll, cancel a paid salary, approve a budget, dispose a fixed asset,
     * run depreciation, delete a vendor or an expense, and lock or reopen an accounting period.
     * Eighty call sites, one permission, no way for a principal to grant the reading without the
     * spending.
     */
    'finance:manage': 'Record and approve finance entries: expenses, income, vendors, assets, budgets',
    /*
     * Payroll is separated from the rest because salary is the one figure in a school that every
     * member has a personal stake in. A bookkeeper who records expenses should not thereby be able
     * to generate, hold or cancel anyone's pay.
     */
    'finance:payroll': 'Generate and pay salaries, and manage payroll and tax settings',
    /*
     * Closing a month freezes the numbers behind it and reopening un-freezes them. Both sat on the
     * same permission, so whoever could close a period could quietly reopen it and amend what it
     * held - the one place in the module where segregation of duties genuinely matters.
     */
    'finance:close_period': 'Lock and reopen accounting periods',

    // Settings
    'settings:view': 'View settings',
    'settings:edit': 'Edit settings',
    'school:export_all': "Export the school's data (any module, with uploaded files) - holds every student's and staff member's records",

    // Saathi memory (plan/main/saathi/school-memory.md). Confirming, editing and archiving what
    // Saathi remembers for the WHOLE school. Reading is not a permission of its own: each school
    // memory carries the permission it needs (a fees rule is shown only to people who can read
    // fees), and a person's own preferences are always theirs to manage.
    'memory:manage': 'Confirm, edit and archive what Saathi remembers for the school',

    // Document Vault
    'vault:view_policy': 'View policy documents',
    'vault:upload': 'Upload documents to vault',
    'vault:delete': 'Delete vault documents',

    // ID Cards
    'id_cards:view': 'View and print ID cards',
    'id_cards:manage': 'Manage ID card templates and settings',

    // School Pulse
    'pulse:view': 'View School Pulse monitors',
    'pulse:manage': 'Create and configure Pulse monitors',

    // Continuous assessment (the foundation grades - see plan/main/continuous-assessment/)
    //
    // `publish_reports` is deliberately SEPARATE from `confirm`. Doc 05 §7: a member confirming a
    // judgement about a child is not the same act as sending it to that child's parent, and a school
    // that wants one person to do the second is not asking for anything unusual.
    'assessment:view': 'View continuous assessment records and evidence',
    'assessment:record': 'Record observations for a class',
    'assessment:confirm': 'Confirm term judgements',
    'assessment:manage_framework': 'Adopt, extend or author the school assessment framework and rules',
    'assessment:publish_reports': 'Publish assessment reports to parents',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ===========================================
// ROLE-PERMISSION MAPPINGS
// ===========================================

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    PRINCIPAL: [
        // Full access to everything
        ...Object.keys(PERMISSIONS) as Permission[],
    ],

    ADMIN: [
        ...Object.keys(PERMISSIONS) as Permission[],
    ],

    TEACHER: [
        // School (view only)
        'school:view',

        // Students (limited)
        'students:view',
        'students:view_details',
        'students:view_reports',

        // Attendance (for their classes)
        'attendance:view',
        'attendance:mark',
        'attendance:bulk_mark',
        'attendance:reports',

        // Exams (for their subjects)
        'exams:view',
        'exams:enter_marks',
        'exams:generate_question_paper',
        'exams:delete_question_paper',
        'exams:view_analytics',

        // Reports
        'reports:view',
        'reports:generate',

        // Timetable (view their class schedule)
        'timetable:view',

        // Lesson Plan (for their own classes/subjects - scope from teacherClassAssignments)
        'lessonplan:view',
        'lessonplan:edit',
        'lessonplan:adapt',
        'lessonplan:log',
        'lessonplan:generate_blueprints',

        /*
         * Homework, quizzes and in-class activities.
         *
         * `assignments:manage` was in the catalogue, enforced on `/assignments` and on the home
         * widget, and in NO role's list - PRINCIPAL and ADMIN hold it only through their
         * `...Object.keys(PERMISSIONS)` spread. So the module was invisible and unreachable to
         * every teacher in every school, which is the one person it exists for. The comment in
         * `lib/navigation.ts` noting that "no role default grants that" was written when someone
         * hit this from the lesson-plan side and routed around it instead of fixing it.
         */
        'assignments:manage',

        // Announcements
        'announcements:view',
        'announcements:create',

        // Dashboard
        'dashboard:view',

        // School Pulse (view only)
        'pulse:view',
    ],

    ACCOUNTANT: [
        // School
        'school:view',

        // Students (view only for billing)
        'students:view',
        'students:view_details',
        'students:view_billing',

        // Full billing access
        'billing:view',
        'billing:create',
        'billing:edit',
        'billing:delete',
        'billing:collect_payment',
        'billing:refund',
        'billing:bulk_create',
        'billing:reports',
        'billing:manage_fee_structure',

        // Announcements (view only)
        'announcements:view',

        // Chasing fees means writing to families, and that is what this permission is for. Without
        // it the reminder actions - now correctly gated on sending rather than on bill creation -
        // would refuse the one person whose job they are.
        'communication:send_email',

        // Dashboard with financial focus
        'dashboard:view',
        'dashboard:financial',

        // The finance module's writes. Separated from the dashboard READ above so a principal can
        // grant somebody the overview without also granting payroll and period close.
        'finance:manage',
        'finance:payroll',
        'finance:close_period',

        // ID Cards
        'id_cards:view',

        // School Pulse (view only)
        'pulse:view',
    ],

    STAFF: [
        // Basic access
        'school:view',
        'students:view',
        'announcements:view',
        'dashboard:view',
        'timetable:view',
        // Every teaching member can view their own lesson plans, adapt them, and log delivery.
        // Scope (which classes/subjects) is enforced by teacherClassAssignments, not this role -
        // a staff member with no assignments simply has an empty scope and sees nothing to act on.
        'lessonplan:view',
        'lessonplan:edit',
        'lessonplan:adapt',
        'lessonplan:log',
        // ── The two jobs that DEFINE teaching, added 2026-09-22 ──
        //
        // A register and a homework pile. Neither was in this baseline, which meant a school that
        // had not yet built a custom school role had teachers who could not mark attendance or set
        // work - and no Attendance, Marking or Homework tile on their Deck. Niraj hit exactly
        // that: *"I don't think there is a panel for the rest things as well."* There was; the
        // baseline just could not see it.
        //
        // Granting these to STAFF means every staff member holds them, including the accountant
        // and the receptionist, and that is deliberate rather than sloppy: SCOPE, not permission,
        // is what decides whose register it is. `getTeacherAttendanceOverview` returns the
        // caller's OWN timetable slots and `assignments` resolve through `teacherClassAssignments`
        // - so a receptionist with these permissions opens an empty panel, exactly as a teacher
        // with no classes does. It is the same argument the lesson-plan pair above already makes.
        //
        // The alternative - every school must configure a role before any teacher can take a
        // register - is worse, and it is the state that produced the report.
        'attendance:view',
        'attendance:mark',
        'assignments:manage',
        // Continuous assessment mirrors the lesson-plan pair above, and for the same reason: a
        // member teaching the foundation grades records their own daily observations of their own
        // class, exactly as they log their own lesson delivery. Scope is enforced by
        // teacherClassAssignments, not by this list.
        //
        // `confirm`, `manage_framework` and `publish_reports` are deliberately NOT here. Confirming
        // a term judgement, changing how every child in the school is graded, and sending a report
        // to a parent are all decisions a school should have to grant on purpose.
        'assessment:view',
        'assessment:record',
    ],

    PARENT: [
        // View their child's information
        'students:view_details',
        'students:view_reports',
        'attendance:view',
        'billing:view',
        'exams:view',
        'reports:view',
        'announcements:view',
    ],

    STUDENT: [
        // View their own information
        'attendance:view',
        'exams:view',
        'reports:view',
        'announcements:view',
    ],
};

// ===========================================
// PERMISSION CHECK UTILITIES
// ===========================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
    return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
    return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: Role): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get permission description
 */
export function getPermissionDescription(permission: Permission): string {
    return PERMISSIONS[permission] || permission;
}

// ===========================================
// PERMISSION CATEGORIES
// ===========================================

export const PERMISSION_CATEGORIES = {
    'School Management': [
        'school:view',
        'school:edit',
        'school:invite',
        'school:remove_member',
        'school:view_activity',
        'school:manage_permissions',
        'school:approve_join_requests',
        'school:manage_subscription',
    ],
    'Staff Management': [
        'staff:manage',
        'staff:delete_permanent',
    ],
    'Student Management': [
        'students:view',
        'students:view_details',
        'students:create',
        'students:edit',
        'students:delete',
        'students:delete_permanent',
        'students:promote',
        'students:view_reports',
        'students:view_health',
        'students:view_sensitive',
        'students:view_billing',
    ],
    'Attendance': [
        'attendance:view',
        'attendance:mark',
        'attendance:bulk_mark',
        'attendance:edit',
        'attendance:reports',
    ],
    'Billing & Fees': [
        'billing:view',
        'billing:create',
        'billing:edit',
        'billing:delete',
        'billing:collect_payment',
        'billing:refund',
        'billing:bulk_create',
        'billing:reports',
        'billing:manage_fee_structure',
    ],
    'Examinations': [
        'exams:view',
        'exams:create',
        'exams:edit',
        'exams:delete',
        'exams:schedule',
        'exams:enter_marks',
        'exams:edit_marks',
        'exams:approve_marks',
        'exams:publish_results',
        'exams:generate_question_paper',
        'exams:delete_question_paper',
        'exams:manage_question_paper_versions',
        'exams:view_analytics',
    ],
    'Lesson Plan': [
        'lessonplan:view',
        'lessonplan:edit',
        'lessonplan:view_all',
        'lessonplan:author_scheme',
        'lessonplan:publish_scheme',
        'lessonplan:generate_blueprints',
        'lessonplan:adapt',
        'lessonplan:edit_baseline',
        'lessonplan:log',
        'lessonplan:view_pacing',
        'lessonplan:assign',
        'lessonplan:manage_registers',
        'departments:view_all',
    ],
    'Reports': [
        'reports:view',
        'reports:generate',
        'reports:approve',
        'reports:publish',
        'reports:send',
    ],
    'Teachers': [
        'teachers:view',
        'teachers:manage',
        'teachers:view_schedule',
        'teachers:edit_schedule',
        'teachers:approve_leave',
    ],
    'Timetable & Scheduling': [
        'timetable:view',
        'timetable:edit',
    ],
    'Announcements & Communication': [
        'announcements:view',
        'announcements:create',
        'announcements:edit',
        'announcements:delete',
        'communication:send_sms',
        'communication:send_email',
    ],
    'Dashboard & Analytics': [
        'dashboard:view',
        'dashboard:analytics',
        'dashboard:financial',
    ],
    'Finance': [
        'finance:manage',
        'finance:payroll',
        'finance:close_period',
    ],
    'Credits': [
        'credits:manage',
    ],
    'Settings': [
        'settings:view',
        'settings:edit',
        'school:export_all',
    ],
    'Saathi Memory': [
        'memory:manage',
    ],
    'Document Vault': [
        'vault:view_policy',
        'vault:upload',
        'vault:delete',
    ],
    'ID Cards': [
        'id_cards:view',
        'id_cards:manage',
    ],
} as const;

/**
 * Streamlined groups for the permissions UI (member overrides).
 * Full definitions remain in PERMISSIONS / PERMISSION_CATEGORIES for reference.
 */
export const PERMISSION_UI_GROUPS: Record<string, Permission[]> = {
    'School & administration': [
        'school:view',
        'school:edit',
        'school:invite',
        'school:remove_member',
        'school:view_activity',
        'school:manage_permissions',
        'school:approve_join_requests',
        'school:manage_subscription',
        'timetable:view',
        'timetable:edit',
    ],
    'Students & attendance': [
        'students:view',
        'students:view_details',
        'students:create',
        'students:edit',
        'students:delete',
        'students:promote',
        'students:view_reports',
        'attendance:view',
        'attendance:mark',
        'attendance:bulk_mark',
        'attendance:edit',
        'attendance:reports',
    ],
    'Examinations & reports': [
        'exams:view',
        'exams:create',
        'exams:edit',
        'exams:delete',
        'exams:schedule',
        'exams:enter_marks',
        'exams:edit_marks',
        'exams:approve_marks',
        'exams:publish_results',
        'exams:generate_question_paper',
        'exams:delete_question_paper',
        'exams:manage_question_paper_versions',
        'exams:view_analytics',
        'reports:view',
        'reports:generate',
        'reports:approve',
        'reports:publish',
        'reports:send',
    ],
    'Lesson plan': [
        'lessonplan:view',
        'lessonplan:edit',
        'lessonplan:view_all',
        'lessonplan:author_scheme',
        'lessonplan:publish_scheme',
        'lessonplan:generate_blueprints',
        'lessonplan:adapt',
        'lessonplan:edit_baseline',
        'lessonplan:log',
        'lessonplan:view_pacing',
        'lessonplan:assign',
        'lessonplan:manage_registers',
        'departments:view_all',
    ],
    'Billing, dashboard & settings': [
        'billing:view',
        'billing:create',
        'billing:edit',
        'billing:delete',
        'billing:collect_payment',
        'billing:refund',
        'billing:bulk_create',
        'billing:reports',
        'billing:manage_fee_structure',
        'dashboard:view',
        'dashboard:analytics',
        'dashboard:financial',
        'finance:manage',
        'finance:payroll',
        'finance:close_period',
        'announcements:view',
        'announcements:create',
        'announcements:edit',
        'announcements:delete',
        'settings:view',
        'settings:edit',
    ],
    'Saathi Memory': [
        'memory:manage',
    ],
    'Document Vault': [
        'vault:view_policy',
        'vault:upload',
        'vault:delete',
    ],
    'ID Cards': [
        'id_cards:view',
        'id_cards:manage',
    ],
    'Continuous Assessment': [
        'assessment:view',
        'assessment:record',
        'assessment:confirm',
        'assessment:manage_framework',
        'assessment:publish_reports',
    ],
};

// ===========================================
// ROLE DISPLAY INFO
// ===========================================

export const ROLE_INFO: Record<Role, { label: string; description: string; color: string }> = {
    PRINCIPAL: {
        label: 'Principal',
        description: 'Full access to all school features and settings',
        color: 'bg-neutral-500',
    },
    ADMIN: {
        label: 'Administrator',
        description: 'Same capabilities as principal unless restricted',
        color: 'bg-neutral-500',
    },
    TEACHER: {
        label: 'Teacher',
        description: 'Access to class management, attendance, and exams',
        color: 'bg-emerald-500',
    },
    ACCOUNTANT: {
        label: 'Accountant',
        description: 'Full access to billing, fees, and financial reports',
        color: 'bg-[#EDE8D0]',
    },
    STAFF: {
        label: 'Staff Member',
        description: 'Capabilities determined by their assigned role (Admin, Teacher, Accountant, Support)',
        color: 'bg-neutral-500',
    },
    PARENT: {
        label: 'Parent',
        description: 'View access to child\'s information and reports',
        color: 'bg-teal-500',
    },
    STUDENT: {
        label: 'Student',
        description: 'View access to own academic information',
        color: 'bg-rose-500',
    },
};

// ===========================================
// INVITE ROLES (Roles that can be invited)
// ===========================================

// All invited members receive the STAFF base role; their SchoolRole determines actual permissions.
export const INVITABLE_ROLES: Role[] = ['STAFF'];
// ===========================================
// ROLE PERMISSION NORMALISATION
// ===========================================

/**
 * Permissions every school role gets whether or not anyone asked for them, so that the holder
 * can at least sign in and reach a dashboard instead of landing on a permission wall.
 */
export const ALWAYS_ON_PERMISSIONS: Permission[] = ['dashboard:view', 'school:view'];

/**
 * The exact set that will be STORED for a role, given a proposed list.
 *
 * Two things happen here and both are invisible to the caller, which is why this has to be
 * shared rather than reimplemented: anything not in the catalogue is DROPPED, and the always-on
 * pair is ADDED. A UI or an agent that previews the raw proposal is therefore showing a different
 * set from the one about to be written - and for a role, the set IS the security decision being
 * approved.
 *
 * It used to be a private function inside `roles.action.ts`. It moved here the moment a second
 * caller needed it (the Saathi role tool's preview), because a second copy of "what gets stored"
 * is the duplication that ends with the preview and the write disagreeing.
 */
export function normalizeRolePermissions(proposed: string[] | undefined): {
    /** What will actually be stored, deduplicated. */
    permissions: Permission[];
    /** Of the always-on pair, the ones the caller did not ask for. Show these - they are written. */
    autoAdded: Permission[];
    /** Names the caller sent that are not real permissions. Show these - they are NOT written. */
    rejected: string[];
} {
    const valid = new Set(Object.keys(PERMISSIONS));
    const kept = new Set<Permission>(ALWAYS_ON_PERMISSIONS);
    const rejected: string[] = [];
    const asked = new Set<string>();

    for (const p of proposed ?? []) {
        asked.add(p);
        if (valid.has(p)) kept.add(p as Permission);
        else rejected.push(p);
    }

    return {
        permissions: [...kept],
        autoAdded: ALWAYS_ON_PERMISSIONS.filter((p) => !asked.has(p)),
        rejected,
    };
}
