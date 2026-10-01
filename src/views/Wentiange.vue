<template>
  <div class="wentiange-panel">
    <p class="panel-subtitle">宏观研判 · 政策解读 · 市场问答</p>
    <WentiangeChat />
  </div>
</template>

<script setup>
import WentiangeChat from '../components/WentiangeChat.vue'
</script>

<style scoped>
.wentiange-panel {
  padding: 0 0 8px;
}

.panel-subtitle {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--muted);
}
</style>
