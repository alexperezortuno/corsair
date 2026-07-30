<script setup lang="ts">
import {onMounted} from 'vue';
import {useRulesStore} from "@/stores/rules.store";
import {getApplicationContainer,} from '@/lib/bootstrap/application-container';

import {TOKENS,} from '@/lib/core/tokens';

import {
  createPipelineDemoRule,
  createPipelineDemoTransaction,
} from '@/lib/interceptor/application/interception-pipeline.demo';

import type {
  InterceptionService,
} from '@/lib/interceptor/application/interception.service';

import type {
  DebuggerService,
} from '@/lib/debugger/application/debugger.service';

const rulesStore = useRulesStore();

onMounted(async () => {
  await rulesStore.loadRules();
});

async function handleCreateRule(): Promise<void> {
  await rulesStore.createRule();
}

const container = getApplicationContainer();

const interceptionService =
    container.resolve<InterceptionService>(
        TOKENS.interceptionService,
    );

const debuggerService =
    container.resolve<DebuggerService>(
        TOKENS.debuggerService,
    );

async function handleTestPipeline(): Promise<void> {
  const transaction =
      createPipelineDemoTransaction();

  const demoRule =
      createPipelineDemoRule();

  await rulesStore.saveRule(demoRule);

  const result =
      await interceptionService.intercept(
          transaction,
      );

  console.info(
      '[Corsair] Resultado de InterceptionService',
      result,
  );
}

async function handleTestDebugger(): Promise<void> {
  const session =
      await debuggerService.attachToTab(999);

  console.info(
      '[Corsair] Debugger temporal conectado',
      session,
  );

  const attached =
      await debuggerService.isAttachedToTab(999);

  console.info(
      '[Corsair] Estado del debugger',
      {
        attached,
      },
  );

  await debuggerService.detachFromTab(999);
}
</script>

<template>
  <main class="page">
    <header class="header">
      <div>
        <span class="eyebrow">
          Corsair
        </span>

        <h1>HTTP Interceptor</h1>
      </div>

      <button
          type="button"
          @click="handleTestDebugger"
      >
        Probar debugger
      </button>

      <button
          type="button"
          @click="handleTestPipeline"
      >
        Probar pipeline
      </button>

      <button
          type="button"
          @click="handleCreateRule"
      >
        Nueva regla
      </button>
    </header>

    <section class="summary">
      <article>
        <span>Total de reglas</span>
        <strong>{{ rulesStore.rules.length }}</strong>
      </article>

      <article>
        <span>Reglas activas</span>
        <strong>{{ rulesStore.activeRulesCount }}</strong>
      </article>
    </section>

    <p v-if="rulesStore.loading">
      Cargando reglas...
    </p>

    <p
        v-if="rulesStore.error"
        class="error"
    >
      {{ rulesStore.error }}
    </p>

    <section v-if="rulesStore.rules.length > 0">
      <h2>Reglas</h2>

      <ul class="rules">
        <li
            v-for="rule in rulesStore.rules"
            :key="rule.id"
        >
          <div>
            <strong>{{ rule.name }}</strong>

            <span>
              Prioridad: {{ rule.priority }}
            </span>
          </div>

          <span>
            {{ rule.enabled ? 'Activa' : 'Inactiva' }}
          </span>
        </li>
      </ul>
    </section>

    <section
        v-else-if="!rulesStore.loading"
        class="empty"
    >
      <h2>No hay reglas</h2>

      <p>
        Crea la primera regla para verificar el almacenamiento.
      </p>
    </section>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  min-width: 320px;
  margin: 0;
  background: #111827;
  color: #f9fafb;
  font-family: Inter,
  system-ui,
  sans-serif;
}

button {
  padding: 9px 14px;
  border: 0;
  border-radius: 7px;
  background: #f9fafb;
  color: #111827;
  font-weight: 700;
  cursor: pointer;
}

.page {
  min-height: 100vh;
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 24px;
}

.summary article {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid #374151;
  border-radius: 8px;
  background: #1f2937;
}

.summary span {
  color: #9ca3af;
  font-size: 13px;
}

.summary strong {
  font-size: 24px;
}

.rules {
  display: grid;
  gap: 8px;
  padding: 0;
  list-style: none;
}

.rules li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border: 1px solid #374151;
  border-radius: 8px;
  background: #1f2937;
}

.rules li div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rules li span {
  color: #9ca3af;
  font-size: 12px;
}

.empty {
  margin-top: 24px;
  padding: 24px;
  border: 1px dashed #4b5563;
  border-radius: 8px;
  text-align: center;
}

.error {
  color: #fca5a5;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>