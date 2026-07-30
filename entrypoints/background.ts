export default defineBackground(() => {
  console.info('[Corsair] Background service worker iniciado');

  chrome.runtime.onInstalled.addListener(() => {
    console.info('[Corsair] Extensión instalada o actualizada');
  });

  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) {
      console.warn('[Corsair] No se encontró una pestaña válida');
      return;
    }

    try {
      await chrome.sidePanel.open({
        tabId: tab.id,
      });

      console.info('[Corsair] Side Panel abierto', {
        tabId: tab.id,
      });
    } catch (error) {
      console.error('[Corsair] No fue posible abrir el Side Panel', error);
    }
  });
});