/// <reference types="vite/client" />
/// <reference types="svelte" />

/** Runes available in .svelte and .svelte.ts files (Svelte 5 compiler transforms these) */
declare const $state: <T>(initial: T) => T;
declare const $derived: <T>(expression: T) => T;
