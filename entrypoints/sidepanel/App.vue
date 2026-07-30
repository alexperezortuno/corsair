<script setup lang="ts">
import {computed, onMounted, reactive, ref,} from 'vue';

import {useRulesStore,} from '@/stores/rules.store';

import {createDefaultMatchCondition, createDefaultRule,} from '@/lib/rules/domain/rule.factory';

import {DebuggerRuntimeClient,} from '@/lib/debugger/runtime/debugger.client';

import type {
  BodyModification,
  BodyModificationMode,
  HeaderModification,
  InterceptionRule,
  MatchType,
} from '@/lib/rules/domain/rule.types';

type TargetField =
    | 'url'
    | 'domain';

interface RuleFormState {
  id: string | null;
  name: string;
  priority: string;
  targetField: TargetField;
  matchType: MatchType;
  pattern: string;
  caseSensitive: boolean;
  statusCode: string;
  statusText: string;
  responseHeaders: string;
  bodyMode: BodyModificationMode;
  bodyStaticValue: string;
  bodySearch: string;
  bodyReplacement: string;
}

interface LogEntry {
  id: string;
  time: string;
  message: string;
}

const rulesStore = useRulesStore();
const savingRule = ref(false);

const attachedTabId = ref<number | null>(null);
const attaching = ref(false);
const attachError = ref<string | null>(null);

const logs = ref<LogEntry[]>([]);

const showNewRule = ref(true);
const showSavedRules = ref(true);
const showActivityLog = ref(true);
const version = ref<string | null>(null);

const form = reactive<RuleFormState>(
    createDefaultFormState(),
);

const isEditing = computed(() =>
    form.id !== null,
);

const isAttached = computed(() =>
    attachedTabId.value !== null,
);

const canSubmit = computed(() =>
    form.name.trim().length > 0 &&
    form.pattern.trim().length > 0,
);

const matchTypeOptions: MatchType[] = [
  'contains',
  'exact',
  'wildcard',
  'regex',
];

const bodyModeOptions: BodyModificationMode[] = [
  'none',
  'static',
  'text-replace',
  'regex-replace',
  'full-replacement',
];

const debuggerClient =
    new DebuggerRuntimeClient();

let serviceWorkerPort:
    | chrome.runtime.Port
    | null = null;

onMounted(async () => {
  getVersion();
  openServiceWorkerPort();

  await rulesStore.loadRules();
  await autoAttachDebugger();

  chrome.runtime.onMessage.addListener(
      handleRuntimeMessage,
  );
});

function openServiceWorkerPort(): void {
  try {
    serviceWorkerPort =
        chrome.runtime.connect({
          name: 'corsair.sidepanel',
        });

    serviceWorkerPort.onDisconnect.addListener(
        () => {
          serviceWorkerPort = null;
          addLog(
              'Service worker port disconnected',
          );
        },
    );

    addLog(
        'Service worker port opened',
    );
  } catch (cause) {
    const error =
        cause instanceof Error
            ? cause.message
            : String(cause);

    addLog(
        `Failed to open service worker port: ${error}`,
    );
  }
}

async function autoAttachDebugger(): Promise<void> {
  if (attaching.value || isAttached.value) {
    return;
  }

  attaching.value = true;
  attachError.value = null;

  try {
    const [activeTab] =
        await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

    addLog(
        `Active tab: ${activeTab?.id ?? 'unknown'} (${activeTab?.url ?? 'no url'})`,
    );

    if (!activeTab?.id) {
      attachError.value =
          'No active tab found';
      addLog(attachError.value);
      return;
    }

    const validation =
        validateTabForDebugger(activeTab);

    if (!validation.valid) {
      attachError.value = validation.reason;
      addLog(
          `${attachError.value}: ${activeTab.url}`,
      );
      return;
    }

    addLog(
        `Attaching debugger to tab ${activeTab.id}...`,
    );

    await debuggerClient.attachToTab(
        activeTab.id,
    );

    attachedTabId.value = activeTab.id;
    attachError.value = null;
    addLog(
        `Debugger attached to tab ${activeTab.id}`,
    );
  } catch (cause) {
    const error =
        cause instanceof Error
            ? cause.message
            : String(cause);

    attachError.value = formatAttachError(error);
    addLog(`Attach failed: ${error}`);
  } finally {
    attaching.value = false;
  }
}

async function runDiagnostics(): Promise<void> {
  if (attaching.value) {
    return;
  }

  attaching.value = true;
  attachError.value = null;

  try {
    const [activeTab] =
        await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

    if (!activeTab?.id) {
      addLog('Diagnostics: no active tab');
      return;
    }

    const validation =
        validateTabForDebugger(activeTab);

    if (!validation.valid) {
      addLog(
          `Diagnostics: ${validation.reason}`,
      );
      return;
    }

    addLog(
        `Diagnostics: attaching to tab ${activeTab.id}...`,
    );

    await debuggerClient.attachToTab(
        activeTab.id,
    );

    addLog(
        'Diagnostics: attach succeeded',
    );

    const attached =
        await debuggerClient.isAttachedToTab(
            activeTab.id,
        );

    addLog(
        `Diagnostics: isAttached=${attached}`,
    );

    await debuggerClient.detachFromTab(
        activeTab.id,
    );

    addLog('Diagnostics: detached');
  } catch (cause) {
    const error =
        cause instanceof Error
            ? cause.message
            : String(cause);

    addLog(`Diagnostics failed: ${error}`);
  } finally {
    attaching.value = false;
  }
}

function validateTabForDebugger(
    tab: chrome.tabs.Tab,
): { valid: true } | { valid: false; reason: string } {
  const url = tab.url ?? '';

  const unsupportedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'devtools://',
    'about:',
    'edge://',
    'file://',
    'view-source:',
  ];

  for (const prefix of unsupportedPrefixes) {
    if (url.startsWith(prefix)) {
      return {
        valid: false,
        reason: `Cannot attach to ${prefix} pages`,
      };
    }
  }

  if (!url) {
    return {
      valid: false,
      reason: 'Tab has no URL yet',
    };
  }

  return {valid: true};
}

function formatAttachError(error: string): string {
  if (
      error.includes(
          'Debugger is not attached',
      )
  ) {
    return 'Attach failed: Chrome lost the debugger session. Close DevTools, reload the page, and try again.';
  }

  if (
      error.includes(
          'Cannot access a chrome',
      )
  ) {
    return 'Attach failed: cannot debug internal Chrome pages.';
  }

  if (
      error.includes(
          'Another debugger',
      )
  ) {
    return 'Attach failed: another debugger (DevTools) is already attached to this tab.';
  }

  return `Attach failed: ${error}`;
}

async function detachDebugger(): Promise<void> {
  if (!attachedTabId.value) {
    return;
  }

  try {
    await debuggerClient.detachFromTab(
        attachedTabId.value,
    );

    addLog(
        `Debugger detached from tab ${attachedTabId.value}`,
    );
  } catch (cause) {
    const error =
        cause instanceof Error
            ? cause.message
            : String(cause);

    addLog(`Detach failed: ${error}`);
  } finally {
    attachedTabId.value = null;
  }
}

async function handleSaveRule(): Promise<void> {
  if (!canSubmit.value || savingRule.value) {
    return;
  }

  savingRule.value = true;

  try {
    const statusCode =
        parseStatusCode(form.statusCode);

    const baseRule = isEditing.value
        ? (rulesStore.rules.find(
            (rule) => rule.id === form.id,
        ) ?? createDefaultRule())
        : createDefaultRule();

    const condition = {
      type: form.matchType,
      pattern: form.pattern.trim(),
      caseSensitive: form.caseSensitive,
    };

    const rule: InterceptionRule = {
      ...baseRule,

      name: form.name.trim(),
      priority: Number(form.priority) || 0,

      target: {
        ...baseRule.target,
        url:
            form.targetField === 'url'
                ? condition
                : undefined,
        domain:
            form.targetField === 'domain'
                ? condition
                : undefined,
        path: undefined,
      },

      request: {
        ...baseRule.request,
        enabled: false,
      },

      response: {
        ...baseRule.response,
        enabled: true,
        statusCode,
        statusText:
            form.statusText.trim() || undefined,
        headers:
            parseHeaders(
                form.responseHeaders,
            ),
        body:
            buildBodyModification(form),
      },
    };

    await rulesStore.saveRule(rule);
    addLog(
        isEditing.value
            ? `Rule updated: ${rule.name}`
            : `Rule created: ${rule.name}`,
    );
    resetForm();
  } finally {
    savingRule.value = false;
  }
}

function startEditRule(
    rule: InterceptionRule,
): void {
  const targetField = rule.target.url
      ? 'url'
      : 'domain';

  const condition =
      rule.target.url ??
      rule.target.domain ??
      createDefaultMatchCondition();

  const body = rule.response.body;

  form.id = rule.id;
  form.name = rule.name;
  form.priority = String(rule.priority);
  form.targetField = targetField;
  form.matchType = condition.type;
  form.pattern = condition.pattern;
  form.caseSensitive = condition.caseSensitive;
  form.statusCode =
      rule.response.statusCode?.toString() ?? '';
  form.statusText = rule.response.statusText ?? '';
  form.responseHeaders =
      formatHeaders(rule.response.headers);
  form.bodyMode = body?.mode ?? 'none';
  form.bodyStaticValue =
      body?.mode === 'static'
          ? body.staticValue ?? ''
          : '';
  form.bodySearch =
      body?.mode === 'text-replace' ||
      body?.mode === 'regex-replace'
          ? body.search ?? ''
          : '';
  form.bodyReplacement =
      body?.mode === 'text-replace' ||
      body?.mode === 'regex-replace' ||
      body?.mode === 'full-replacement'
          ? body.replacement ?? ''
          : '';

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

async function handleToggleRule(
    rule: InterceptionRule,
): Promise<void> {
  await rulesStore.toggleRule(
      rule.id,
      !rule.enabled,
  );

  addLog(
      `${rule.enabled ? 'Disabled' : 'Enabled'} rule: ${rule.name}`,
  );
}

async function handleDeleteRule(
    ruleId: string,
): Promise<void> {
  const rule = rulesStore.rules.find(
      (candidate) => candidate.id === ruleId,
  );

  await rulesStore.deleteRule(ruleId);

  addLog(
      `Deleted rule: ${rule?.name ?? ruleId}`,
  );

  if (form.id === ruleId) {
    resetForm();
  }
}

function resetForm(): void {
  Object.assign(form, createDefaultFormState());
}

function parseStatusCode(
    value: string,
): number | undefined {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return undefined;
  }

  const statusCode = Number(normalizedValue);

  if (!Number.isInteger(statusCode)) {
    throw new Error(
        'Status code must be an integer',
    );
  }

  return statusCode;
}

function parseHeaders(
    input: string,
): HeaderModification[] {
  const lines = input
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const headers: HeaderModification[] = [];

  for (const line of lines) {
    const separator = line.indexOf(':');

    if (separator === -1) {
      continue;
    }

    const name = line
        .slice(0, separator)
        .trim();

    const value = line
        .slice(separator + 1)
        .trim();

    if (!name) {
      continue;
    }

    headers.push({
      operation: 'set' as const,
      name,
      value,
    });
  }

  return headers;
}

function formatHeaders(
    headers: HeaderModification[],
): string {
  return headers
      .map((header) =>
          `${header.name}: ${header.value ?? ''}`,
      )
      .join('\n');
}

function buildBodyModification(
    state: RuleFormState,
): BodyModification {
  switch (state.bodyMode) {
    case 'none':
      return {
        mode: 'none',
      };

    case 'static':
      return {
        mode: 'static',
        staticValue: state.bodyStaticValue,
      };

    case 'full-replacement':
      return {
        mode: 'full-replacement',
        replacement:
        state.bodyReplacement,
      };

    case 'text-replace':
      return {
        mode: 'text-replace',
        search: state.bodySearch,
        replacement:
        state.bodyReplacement,
      };

    case 'regex-replace':
      return {
        mode: 'regex-replace',
        search: state.bodySearch,
        replacement:
        state.bodyReplacement,
      };
  }
}

function targetSummary(
    rule: InterceptionRule,
): string {
  const urlCondition = rule.target.url;

  if (urlCondition?.pattern.trim()) {
    return `URL (${urlCondition.type}): ${urlCondition.pattern}`;
  }

  const domainCondition = rule.target.domain;

  if (domainCondition?.pattern.trim()) {
    return `Domain (${domainCondition.type}): ${domainCondition.pattern}`;
  }

  return 'No target';
}

function addLog(message: string): void {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString(),
    message,
  };

  logs.value.unshift(entry);

  if (logs.value.length > 50) {
    logs.value.pop();
  }
}

function clearLogs(): void {
  logs.value = [];
}

function toggleNewRule(): void {
  showNewRule.value = !showNewRule.value;
}

function toggleSavedRules(): void {
  showSavedRules.value = !showSavedRules.value;
}

function toggleActivityLog(): void {
  showActivityLog.value = !showActivityLog.value;
}

function handleRuntimeMessage(
    message: unknown,
): void {
  if (!isNetworkLogMessage(message)) {
    return;
  }

  const payload = message.payload;

  if (payload.type === 'responseModified') {
    addLog(
        `Modified ${payload.url} → ${payload.statusCode} (${payload.matchedRules} rule(s))`,
    );
  }

  if (payload.type === 'responseAborted') {
    addLog(
        `Aborted ${payload.url} (${payload.matchedRules} rule(s))`,
    );
  }
}

function isNetworkLogMessage(
    message: unknown,
): message is {
  type: string;
  payload: {
    type: string;
    url: string;
    statusCode: number;
    matchedRules: number;
  };
} {
  return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as Record<string, unknown>).type ===
      'network.log'
  );
}

function createDefaultFormState(): RuleFormState {
  return {
    id: null,
    name: 'Modify response',
    priority: '100',
    targetField: 'url',
    matchType: 'contains',
    pattern: '',
    caseSensitive: false,
    statusCode: '',
    statusText: '',
    responseHeaders: '',
    bodyMode: 'none',
    bodyStaticValue: '',
    bodySearch: '',
    bodyReplacement: '',
  };
}

function getVersion(): void {
  version.value = chrome.runtime.getManifest().version;
}
</script>

<template>
  <main class="page">
    <header class="header">
      <div class="header-top">
        <div>
          <h1>Corsair Interceptor</h1>

          <p>
            Create rules by URL or domain to modify responses.
          </p>
        </div>

        <div class="status">
          <span
              v-if="attaching"
              class="badge warning"
          >
            Attaching…
          </span>

          <span
              v-else-if="isAttached"
              class="badge success"
          >
            Attached
          </span>

          <span
              v-else
              class="badge danger"
          >
            Detached
          </span>
        </div>
      </div>

      <p
          v-if="attachError"
          class="error"
      >
        {{ attachError }}
      </p>

      <div class="header-actions">
        <button
            type="button"
            :disabled="attaching || isAttached"
            @click="autoAttachDebugger"
        >
          Attach
        </button>

        <button
            type="button"
            class="secondary"
            :disabled="!isAttached"
            @click="detachDebugger"
        >
          Detach
        </button>

        <button
            type="button"
            class="secondary"
            :disabled="attaching"
            @click="runDiagnostics"
        >
          Diagnostics
        </button>
      </div>
    </header>

    <section class="panel">
      <div
          class="panel-header"
          @click="toggleNewRule"
      >
        <h2>
          {{ isEditing ? 'Edit rule' : 'New rule' }}
        </h2>

        <span
            class="chevron"
            :class="{ expanded: showNewRule }"
        >▼</span>
      </div>

      <div
          v-if="showNewRule"
          class="panel-content"
      >
        <form @submit.prevent="handleSaveRule">
          <label>
            Name

            <input
                v-model="form.name"
                type="text"
                required
            >
          </label>

          <label>
            Priority

            <input
                v-model="form.priority"
                type="number"
                min="0"
                step="1"
            >
          </label>

          <label>
            Intercept by

            <select v-model="form.targetField">
              <option value="url">URL</option>

              <option value="domain">Domain</option>
            </select>
          </label>

          <label>
            Match type

            <select v-model="form.matchType">
              <option
                  v-for="option in matchTypeOptions"
                  :key="option"
                  :value="option"
              >
                {{ option }}
              </option>
            </select>
          </label>

          <label>
            Pattern

            <input
                v-model="form.pattern"
                type="text"
                placeholder="e.g. api.example.com/users"
                required
            >
          </label>

          <label class="checkbox">
            <input
                v-model="form.caseSensitive"
                type="checkbox"
            >

            Case sensitive
          </label>

          <label>
            Status code (optional)

            <input
                v-model="form.statusCode"
                type="number"
                placeholder="200"
            >
          </label>

          <label>
            Status text (optional)

            <input
                v-model="form.statusText"
                type="text"
                placeholder="OK"
            >
          </label>

          <label>
            Response headers (one per line)

            <textarea
                v-model="form.responseHeaders"
                rows="3"
                placeholder="x-debug: enabled"
            />
          </label>

          <label>
            Body mode

            <select v-model="form.bodyMode">
              <option
                  v-for="mode in bodyModeOptions"
                  :key="mode"
                  :value="mode"
              >
                {{ mode }}
              </option>
            </select>
          </label>

          <label v-if="form.bodyMode === 'static'">
            Static body

            <textarea
                v-model="form.bodyStaticValue"
                rows="4"
            />
          </label>

          <label
              v-if="form.bodyMode === 'text-replace' || form.bodyMode === 'regex-replace'"
          >
            Search

            <input
                v-model="form.bodySearch"
                type="text"
            >
          </label>

          <label
              v-if="form.bodyMode === 'text-replace' || form.bodyMode === 'regex-replace' || form.bodyMode === 'full-replacement'"
          >
            Replacement

            <textarea
                v-model="form.bodyReplacement"
                rows="4"
            />
          </label>

          <div class="actions">
            <button
                type="submit"
                :disabled="!canSubmit || savingRule"
            >
              {{ savingRule ? 'Saving...' : (isEditing ? 'Update rule' : 'Save rule') }}
            </button>

            <button
                v-if="isEditing"
                type="button"
                class="secondary"
                @click="resetForm"
            >
              Cancel
            </button>

            <button
                v-else
                type="button"
                class="secondary"
                @click="resetForm"
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </section>

    <p v-if="rulesStore.loading">Loading rules...</p>

    <p
        v-if="rulesStore.error"
        class="error"
    >
      {{ rulesStore.error }}
    </p>

    <section class="panel">
      <div
          class="panel-header"
          @click="toggleSavedRules"
      >
        <h2>Saved rules</h2>

        <span
            class="chevron"
            :class="{ expanded: showSavedRules }"
        >▼</span>
      </div>

      <template v-if="showSavedRules">
        <p>
          Total: {{ rulesStore.rules.length }} · Active: {{ rulesStore.activeRulesCount }}
        </p>

        <ul
            v-if="rulesStore.rules.length > 0"
            class="rules"
        >
          <li
              v-for="rule in rulesStore.rules"
              :key="rule.id"
          >
            <div class="rule-data">
              <strong>{{ rule.name }}</strong>

              <span>{{ targetSummary(rule) }}</span>
            </div>

            <div class="rule-actions">
              <button
                  type="button"
                  class="secondary"
                  @click="startEditRule(rule)"
              >
                Edit
              </button>

              <button
                  type="button"
                  class="secondary"
                  @click="handleToggleRule(rule)"
              >
                {{ rule.enabled ? 'Disable' : 'Enable' }}
              </button>

              <button
                  type="button"
                  class="danger"
                  @click="handleDeleteRule(rule.id)"
              >
                Delete
              </button>
            </div>
          </li>
        </ul>

        <p v-else>No rules created yet.</p>
      </template>
    </section>

    <section class="panel log-panel">
      <div
          class="panel-header"
          @click="toggleActivityLog"
      >
        <h2>Activity log</h2>

        <span
            class="chevron"
            :class="{ expanded: showActivityLog }"
        >▼</span>
      </div>

      <template v-if="showActivityLog">
        <button
            v-if="logs.length > 0"
            type="button"
            class="secondary small"
            @click="clearLogs"
        >
          Clear log
        </button>

        <ul
            v-if="logs.length > 0"
            class="logs"
        >
          <li
              v-for="log in logs"
              :key="log.id"
          >
            <span class="log-time">{{ log.time }}</span>

            <span class="log-message">{{ log.message }}</span>
          </li>
        </ul>

        <p
            v-else
            class="empty-log"
        >
          No activity yet.
        </p>
      </template>
    </section>

    <div class="version">v{{ version }}</div>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  background: #111827;
  color: #f9fafb;
  font-family: Inter,
  system-ui,
  sans-serif;
}

.page {
  min-width: 360px;
  min-height: 100vh;
  padding: 18px;
  display: grid;
  gap: 16px;
  align-items: start;
  align-content: start;
  grid-auto-rows: max-content;
}

.header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.header h1 {
  margin: 0;
}

.header p {
  margin: 8px 0 0;
  color: #9ca3af;
}

.header-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.status {
  flex-shrink: 0;
}

.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.badge.success {
  background: #064e3b;
  color: #34d399;
}

.badge.warning {
  background: #78350f;
  color: #fbbf24;
}

.badge.danger {
  background: #450a0a;
  color: #f87171;
}

.panel {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 10px;
  padding: 14px;
}

.panel h2 {
  margin: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.panel-header h2 {
  margin: 0;
}

.panel-content {
  margin-top: 12px;
}

.chevron {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.2s ease;
  display: inline-block;
}

.chevron.expanded {
  transform: rotate(180deg);
}

button.small {
  padding: 6px 10px;
  font-size: 12px;
  width: auto;
}

form {
  display: grid;
  gap: 10px;
}

label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

input,
select,
textarea,
button {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #4b5563;
  padding: 10px;
  background: #111827;
  color: #f9fafb;
  font: inherit;
}

.checkbox {
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
}

.checkbox input {
  width: auto;
}

button {
  cursor: pointer;
  background: #10b981;
  border-color: #10b981;
  font-weight: 700;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.secondary {
  background: #1f2937;
}

.danger {
  background: #991b1b;
  border-color: #991b1b;
}

.actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.rules {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.rules li {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid #374151;
  border-radius: 8px;
}

.rule-data {
  display: grid;
  gap: 4px;
}

.rule-data span {
  color: #9ca3af;
  font-size: 12px;
}

.rule-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.error {
  color: #fca5a5;
  margin: 8px 0 0;
}

.log-panel {
  max-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-panel h2 {
  flex-shrink: 0;
}

.logs {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: grid;
  gap: 6px;
}

.logs li {
  display: grid;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #111827;
  font-size: 12px;
}

.log-time {
  color: #9ca3af;
  font-size: 11px;
}

.log-message {
  word-break: break-word;
}

.empty-log {
  color: #9ca3af;
  font-size: 13px;
}

.version {
  margin-top: auto;
  color: #6b7280;
  font-size: 12px;
  text-align: center;
}
</style>
