/**
 * dsh-turn-trace — structural contracts for the browser half.
 *
 * Mirrors the 0.2.1 client contracts this view reads: the `chat` view target
 * snapshot (`ChatSnapshot`), its node wrapper, and the standard slot props.
 * Declared locally because those types come from the host application, not
 * from this package's node_modules.
 */

/** Resolved placement of one chat node. */
export type NodeLocation =
  | { readonly kind: 'session' }
  | { readonly kind: 'turn'; readonly turn: { readonly turn: number; readonly start?: { readonly time?: number } } }
  | { readonly kind: 'step'; readonly turn: { readonly turn: number }; readonly step: { readonly turn: number; readonly step: number } }
  | { readonly kind: 'unresolved' }

/** One rendered chat node; `data` is the business payload keyed by `kind`. */
export interface ChatNodeLike {
  readonly key: string
  readonly kind: string
  readonly data: unknown
  readonly location?: NodeLocation
}

/** Token counts as reported on an assistant message. */
export interface UsageLike {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
}

/** Timing recorded on the durable assistant message. */
export interface AssistantTimingLike {
  readonly stepStartTime: number | null
  readonly firstTokenTime?: number | null
  readonly completedTime: number
}

/** The durable assistant message carried by `AssistantChatData.finalNode`. */
export interface AssistantFinalNodeLike {
  readonly timing?: AssistantTimingLike
  readonly usage?: UsageLike
  readonly requestConfig?: { readonly provider?: string; readonly model?: string }
  /** Provider-reported identity of the completed request. */
  readonly providerMetadata?: { readonly provider?: string; readonly model?: string }
  /** Pre-0.2 shape of the same identity. */
  readonly provenance?: { readonly provider?: string; readonly model?: string }
}

/** Payload of the `assistant-step` chat node (one model call = one step). */
export interface AssistantDataLike {
  readonly status?: 'running' | 'settled' | 'interrupted'
  readonly turn: number
  readonly step: number
  readonly time: number
  readonly usage?: UsageLike
  readonly finalNode?: AssistantFinalNodeLike
}

/** Settled tool result payload. */
export interface ToolResultLike {
  readonly kind: 'tool-result'
  readonly callId?: string
  readonly name?: string
  readonly time: number
  readonly callTime: number | null
  readonly call: { readonly name: string; readonly argsRaw: string } | null
  /** Result blocks; text is extracted for the row's preview. */
  readonly content?: readonly unknown[]
  readonly isError: boolean
  readonly error?: { readonly name: string; readonly code: string; readonly reason?: string }
}

/** Still-running tool call payload. */
export interface RunningToolLike {
  readonly callId: string
  readonly name: string
  readonly turn: number
  readonly step: number
  readonly time: number
  readonly argsRaw?: string
}

/** Payload of the `tool-call` chat node. */
export interface ToolDataLike {
  readonly root: ToolResultLike | RunningToolLike
}

/** Payload of a `user` chat node. */
export interface UserDataLike {
  readonly time: number
  readonly content?: readonly { readonly type?: string; readonly text?: string }[]
}

/** The slice of the `chat` view target this view reads. */
export interface ChatSnapshotLike {
  readonly order: readonly string[]
  readonly nodes: { get(key: string): ChatNodeLike | undefined }
}

/** The slice of the conversation shell snapshot this view reads. */
export interface ConversationSnapshotLike {
  readonly views: { get(target: string): unknown }
}

/**
 * Props the slot framework hands a `conversation.view` entry.
 *
 * `useConversation` is guaranteed by the standard kit; `useChat` is the chat
 * plugin's own target hook and is preferred when present because it subscribes
 * to the chat target directly.
 */
/** The host locale runtime surface this view needs. */
export interface LocaleServiceLike {
  readonly bind: (ns: string) => (key: string, params?: Record<string, string | number>) => string
  readonly register: (ns: string, dicts: Record<string, Record<string, string>>) => () => void
  readonly getSnapshot: () => { readonly active: string; readonly revision: number }
  readonly subscribe: (fn: () => void) => () => void
}

/** Minimal shape of the per-session model directory store. */
export interface ModelStoreLike {
  subscribe: (fn: () => void) => () => void
  getSnapshot: () => { current?: { model?: string } | null }
}

/** Minimal shape of the `modelDirectories` service. */
export interface ModelDirectoriesLike {
  directoryFor: (sessionId: string) => { store?: ModelStoreLike } | undefined
}

export interface ConversationViewPropsLike {
  readonly sessionId: string
  /** Translate function seated by the slot when the entry declares a locale namespace. */
  readonly t?: (key: string, params?: Record<string, string | number>) => string
  /** Resolved lazily: the locale runtime often registers after this plugin. */
  readonly getLocale?: () => LocaleServiceLike | undefined
  /** Idempotent dictionary registration, called from render as a safety net. */
  readonly ensureDictionaries?: () => void
  /** Legacy direct handle. */
  readonly locale?: {
    readonly bind: (ns: string) => (key: string, params?: Record<string, string | number>) => string
    readonly getSnapshot: () => { readonly active: string; readonly revision: number }
    readonly subscribe: (fn: () => void) => () => void
  }
  /** Pull one older page of session history into the chat window. */
  readonly loadOlder?: () => Promise<void>
  /** Session-level hook from the standard kit (history window state). */
  readonly useSession?: <T>(select: (snapshot: { hasMore: boolean; loadingOlder: boolean }) => T) => T
  readonly useChat?: <T>(select: (snapshot: ChatSnapshotLike) => T) => T
  readonly useConversation?: <T>(select: (snapshot: ConversationSnapshotLike) => T) => T
  /** Injected by apply(); resolved lazily because the service may register after us. */
  readonly modelDirectories?: () => ModelDirectoriesLike | undefined
  readonly [key: string]: unknown
}
