# ScoutFlow Security Best Practices & Audit Review

This document serves as a mandatory guide for all subsequent development on ScoutFlow. It outlines critical vulnerabilities identified and remedied during the MVP Pre-Deployment Audit and establishes strict coding rules.

## 1. PostgREST Request Injection

### The Vulnerability
In a typical SQL environment, we intuitively fear SQL injection. In a Supabase environment, the attack vector shifts to **PostgREST Injection**. 
During the audit, user input strings were directly passed into Supabase Javascript SDK filters like `.or()` and `.ilike()`.
For example: `query.or(\`first_name.ilike.%${search}%,last_name.ilike.%${search}%\`)`.

Because the Supabase SDK parses `.or()` and string-based filters using the PostgREST specification, the comma `,` acts as an operator separator. A malicious user could input a search parameter like `foo%,role.eq.admin` generating a query logic bypass.

### Strict Coding Rule: Sanitize All Input
- **NEVER** interpolate raw, unsanitized user strings into `.or()` string clauses or dynamic PostgREST string filters without sanitization.
- **ALWAYS** pass string inputs through our `sanitizePostgrestFilter` utility function (located in `src/api/players.ts`) safely stripping `,`, `(`, `)`, `'`, `"`, `%`, and `\`.
- Where possible, use parameterized object filters rather than string-interpolated query building.

---

## 2. Row Level Security (RLS) Leakage

### The Vulnerability
Supabase's default access control relies heavily on Row Level Security (RLS). Our initial migrations enforced `CREATE POLICY ... FOR SELECT TO authenticated USING (true);`. 
With Vercel deploying a public `Anon Key`, any individual on the internet could technically trigger a generic Supabase User Signup (bypassing any front-end locks), mint themselves a valid JWT, inherently gaining the Postgres `authenticated` role. The `USING (true)` policy would then blindly distribute the entire global database of scouted players, proprietary teams, and notes.

### Strict Coding Rule: Bulletproof Isolation
- **NEVER** use `USING (true)` or `WITH CHECK (true)` unless the table data is explicitly designed to be completely public to the entire internet (e.g., generic public dictionaries/enums).
- **ALWAYS** explicitly map standard user CRUD operations to `auth.uid()`. Example: `USING (added_by = auth.uid())` or `USING (author_id = auth.uid())`.
- **ADMIN OVERRIDES:** Maintain global administrative access by appending our Security Definer checking function: `USING (added_by = auth.uid() OR is_admin())`.

---

## 3. Data Leakage via Client Traces

### The Vulnerability
Extensive `console.error('[Action]', error)` logging existed in the `src/api/*` layer. When Supabase encounters an error, it often rejects the promise with rich stack details. Exposing these errors in the browser console acts as reconnaissance for external actors, revealing internal schema names, SQL constraints, and infrastructure logic.

### Strict Coding Rule: Keep the Console Clean
- **NEVER** indiscriminately dump raw backend errors to the browser console via `console.log`, `console.error`, or `console.table`.
- **ALWAYS** intercept errors gracefully. If debugging trace is needed, do not commit it. Handle the UI resolution seamlessly using standardized fallback toast notifications (e.g., `toast.error(t('toast.error'))`) without exposing the stack frame context.
