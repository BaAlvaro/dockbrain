# Security Model

DockBrain is designed with **security by default** as a core principle.

## Threat Model

### Identified Threats

| ID | Threat | Severity | Mitigation |
|----|--------|----------|------------|
| T1 | Unauthorized command execution | CRITICAL | Pairing-based authentication with allowlist |
| T2 | Path traversal in file operations | CRITICAL | Strict path validation and safe root directory |
| T3 | SSRF via web sandbox | HIGH | Domain allowlist and private IP blocking |
| T4 | Command injection via LLM prompts | HIGH | No shell execution, structured tool calls |
| T5 | Denial of service (message flooding) | MEDIUM | Rate limiting per user |
| T6 | Secret exposure in logs | HIGH | Automatic redaction of sensitive fields |
| T7 | Remote code execution via malicious tool | CRITICAL | Static tool registry, no dynamic loading |
| T8 | Permission bypass | CRITICAL | Permission checks on every tool invocation |
| T9 | Message replay attacks | MEDIUM | Deduplication with time window |
| T10 | Unauthorized database access | HIGH | File permissions (600), no remote access |

## Authentication

### Pairing Process

1. **Admin generates token** via HTTP API
   - Token is cryptographically random (24 characters)
   - TTL of 1 hour (configurable)
   - Single-use only

2. **User initiates pairing** via Telegram
   - Sends `/pair <token>` command
   - Bot validates token and creates user record

3. **Token is invalidated** after use
   - Marked with `used_at` timestamp
   - Cannot be reused

### Allowlist

Only paired users can interact with DockBrain. Unpaired messages are ignored.

## Authorization

### Permission Model

Permissions are **granular** and **explicit**:

```
user_id + tool_name + action → granted/denied
```

Examples:
- `(1, "reminders", "create")` → granted
- `(1, "files_readonly", "read")` → denied
- `(1, "reminders", "*")` → granted (wildcard)

### Default Permissions

Newly paired users receive minimal permissions:
- `system_info.*` - Read system information
- `reminders.create` - Create reminders
- `reminders.list` - List reminders
- `reminders.delete` - Delete reminders (requires confirmation)

### Granting Permissions

**Only via HTTP API**, authenticated with admin token:

```bash
PUT /api/v1/users/:id/permissions
Authorization: Bearer <ADMIN_API_TOKEN>

{
  "permissions": [...]
}
```

**Users cannot grant themselves permissions.**

### Permission Snapshots

Permissions are **immutable during task execution**:

1. Snapshot created at task start
2. All tool invocations checked against snapshot
3. Permission changes don't affect running tasks

This prevents race conditions and time-of-check-time-of-use vulnerabilities.

## Confirmation Flow

Destructive operations require **explicit confirmation**:

1. Bot sends plan to user
2. User replies "yes" or "no"
3. Task proceeds only if confirmed
4. Timeout after 60 seconds

Operations requiring confirmation:
- Deleting reminders
- Any operation marked with `requires_confirmation: true`

## Audit Logging

**Every action is logged** in the `audit_logs` table:

- User ID
- Task ID
- Event type (e.g., `tool_invoked`, `task_completed`)
- Tool name and action
- Input/output data (redacted)
- Success/failure
- Timestamp

Audit logs are **immutable** (no UPDATE or DELETE).

### Sensitive Data Redaction

Automatic redaction of fields matching:
- `token`, `password`, `secret`, `api_key`, `auth`, `authorization`

Example:
```json
{
  "api_key": "[REDACTED]",
  "username": "john"
}
```

## Tool Security

### files_readonly

**Prevents path traversal:**

1. All paths resolved relative to `SAFE_ROOT_DIR`
2. Normalized with `path.normalize()`
3. Validated to start with safe root
4. Symlinks rejected
5. Null bytes and `../` rejected

**Enforces file type restrictions:**

- Only allowed extensions (`.txt`, `.md`, `.json`, etc.)
- Configurable in `config/default.yaml`

**Enforces size limits:**

- Max file size: 10MB (configurable)
- Checked before reading

### web_sandbox

**Prevents SSRF:**

1. **Domain allowlist**
   - Only specified domains allowed
   - Subdomains supported (e.g., `*.wikipedia.org`)

2. **Private IP blocking**
   - 127.0.0.1, 10.x.x.x, 192.168.x.x, etc.
   - IPv6 private ranges

3. **No redirect following**
   - `redirect: 'manual'`

4. **Timeout enforcement**
   - 5 seconds (configurable)

5. **Size limits**
   - Max response: 5MB (configurable)

### reminders

**User isolation:**

- Users can only view/delete their own reminders
- Enforced in repository layer

**Limits:**

- Max 50 reminders per user (configurable)
- Prevents resource exhaustion

### system_info

**Read-only, non-sensitive information:**

- OS platform
- Node version
- System uptime
- DockBrain version

No credentials, file paths, or user data exposed.

## Rate Limiting

**Per-user rate limits** (default 10 messages/minute):

- Enforced before task creation
- Configurable per user
- In-memory cache + cleanup

**Global queue limit:**

- Max 100 pending tasks
- Prevents memory exhaustion

## Database Security

**File permissions:**

- Database file: `chmod 600` (owner only)
- Log files: `chmod 600`

**No remote access:**

- SQLite local only
- API server binds to `127.0.0.1` by default

**Foreign key constraints:**

- Cascading deletes for data consistency
- Prevents orphaned records

## LLM Security

**No code execution:**

- LLM generates plans, not code
- Tool calls are structured (JSON)
- Validated with Zod schemas

**Input sanitization:**

- Strip dangerous characters
- Limit input length
- Remove script tags, event handlers

**Low temperature:**

- Temperature 0.1 for planning (deterministic)
- Reduces hallucination risk

## Network Security

**HTTP API:**

- Helmet middleware (security headers)
- Bearer token authentication
- Bind to localhost by default

**Telegram:**

- Official SDK (grammY)
- HTTPS communication
- No webhook (polling mode)

## Best Practices

### For Administrators

1. **Keep admin API token secure**
   - Store in `.env`, never commit
   - Rotate periodically
   - Use cryptographically random tokens

2. **Grant minimal permissions**
   - Start with defaults
   - Add permissions as needed
   - Review regularly

3. **Monitor audit logs**
   - Check for suspicious activity
   - Investigate failed tool invocations
   - Track permission changes

4. **Keep allowlists tight**
   - Web domains: only trusted sites
   - File extensions: only necessary types

5. **Regular updates**
   - Update dependencies (`npm update`)
   - Review security advisories
   - Monitor CVEs for Node.js, SQLite

### For Users

1. **Protect pairing tokens**
   - Use immediately after receiving
   - Don't share tokens
   - Report if compromised

2. **Verify bot identity**
   - Check bot username matches
   - Be cautious of impersonators

3. **Review permissions**
   - Ask admin for `/status` check
   - Understand what tools you can use

4. **Report suspicious behavior**
   - Unexpected messages
   - Failed authentications
   - Unusual task results

## Incident Response

### If Pairing Token is Compromised

1. Token expires automatically (1 hour TTL)
2. If used, admin can deactivate user:
   ```bash
   PATCH /api/v1/users/:id
   {"is_active": false}
   ```

### If Admin API Token is Compromised

1. **Immediately rotate token**
   - Update `.env`
   - Restart DockBrain

2. **Audit recent API calls**
   - Check logs for unauthorized access
   - Review permission changes

3. **Review all users and permissions**
   - Deactivate suspicious accounts
   - Reset permissions if needed

### If Database is Compromised

1. **Shut down DockBrain**
   ```bash
   pkill -f dockbrain
   ```

2. **Assess damage**
   - Check audit logs
   - Review permissions
   - Identify affected users

3. **Restore from backup** (if available)

4. **Rotate all credentials**
   - Admin API token
   - Telegram bot token
   - OpenAI API key

5. **Notify affected users**

## Security Updates

**Check for updates regularly:**

```bash
npm audit
npm audit fix
```

**Subscribe to security advisories:**
- Node.js security releases
- npm package advisories
- OpenAI API security notes

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not open a public issue**
2. Contact maintainers privately
3. Provide detailed description and steps to reproduce
4. Allow time for patch before disclosure

## Compliance Notes

DockBrain stores:
- User identifiers (Telegram chat IDs)
- Message content (task inputs)
- Execution logs
- Audit trails

**Data retention:**
- No automatic cleanup
- Admin responsibility to implement data retention policies
- Consider GDPR/privacy regulations for your jurisdiction

**Encryption:**
- Data at rest: Not encrypted by default (SQLite)
- Data in transit: HTTPS for API calls, Telegram uses TLS
- Consider disk encryption for production

**Access control:**
- File system permissions only
- No built-in multi-admin support
- Consider OS-level access controls

## Further Hardening (Optional)

For production deployments, consider:

1. **Run in container**
   - Docker with read-only filesystem
   - Drop capabilities
   - Non-root user

2. **Firewall rules**
   - Block outbound to private IPs
   - Whitelist Telegram API endpoints

3. **Monitoring**
   - Log aggregation (e.g., ELK stack)
   - Alerting on failed authentications
   - Anomaly detection

4. **Database encryption**
   - SQLite encryption extension
   - Or encrypt filesystem

5. **Secrets management**
   - Use vault (HashiCorp Vault, AWS Secrets Manager)
   - Avoid `.env` files in production

6. **Regular penetration testing**
   - Internal security audits
   - Third-party assessments
