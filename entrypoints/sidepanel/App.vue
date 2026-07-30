<script setup lang="ts">
const extensionVersion = chrome.runtime.getManifest().version;
</script>

<template>
  <main class="side-panel">
    <header class="header">
      <div>
        <span class="eyebrow">Chrome Extension</span>

        <h1>Corsair</h1>

        <p class="subtitle">
          HTTP Interceptor
        </p>
      </div>

      <span class="status">
        Inactivo
      </span>
    </header>

    <section class="content">
      <h2>Extensión preparada</h2>

      <p>
        La configuración inicial del Side Panel funciona correctamente.
      </p>

      <dl class="information">
        <div>
          <dt>Versión</dt>
          <dd>{{ extensionVersion }}</dd>
        </div>

        <div>
          <dt>Motor HTTP</dt>
          <dd>Pendiente</dd>
        </div>

        <div>
          <dt>Reglas activas</dt>
          <dd>0</dd>
        </div>
      </dl>
    </section>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(html) {
  color-scheme: dark;
}

:global(body) {
  min-width: 320px;
  margin: 0;
  background: #111827;
  color: #f9fafb;
  font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
}

.side-panel {
  min-height: 100vh;
  padding: 20px;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid #374151;
}

.eyebrow {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 4px 0 0;
  font-size: 28px;
  line-height: 1;
}

.subtitle {
  margin: 6px 0 0;
  color: #9ca3af;
}

.status {
  padding: 5px 9px;
  border: 1px solid #4b5563;
  border-radius: 999px;
  color: #d1d5db;
  font-size: 12px;
}

.content {
  padding-top: 24px;
}

.content h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.content > p {
  margin: 0;
  color: #9ca3af;
  font-size: 14px;
  line-height: 1.5;
}

.information {
  display: grid;
  gap: 1px;
  margin-top: 24px;
  overflow: hidden;
  border: 1px solid #374151;
  border-radius: 8px;
  background: #374151;
}

.information div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  background: #1f2937;
}

.information dt {
  color: #9ca3af;
}

.information dd {
  margin: 0;
  font-weight: 600;
}
</style>