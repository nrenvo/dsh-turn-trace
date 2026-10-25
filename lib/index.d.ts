/**
 * dsh-turn-trace — host entry.
 *
 * The view is client-only: everything it renders comes from the conversation
 * snapshot the browser already holds. This host row exists so the package is a
 * well-formed bundle (the profile mounts it and the client half is loaded from
 * `dsh.client`), and it contributes no service and no RPC.
 */
export declare function apply(): void;