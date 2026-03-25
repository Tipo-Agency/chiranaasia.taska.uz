/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Включить runSeed() в dev (localStorage demo) */
  readonly VITE_ENABLE_DEMO_SEED?: string;
  /** Ленивая интеграция Instagram / лидов (будущее) */
  readonly VITE_ENABLE_INSTAGRAM_LEADS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
