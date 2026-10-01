<template>
  <div class="page">
    <h1 class="page-title">{{ title }}</h1>
    <div class="glass-card placeholder">
      <el-empty :description="`${title}模块开发中，敬请期待`" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => route.meta?.title || '')
</script>

<style scoped>
.page {
  padding: 8px 4px 32px;
}

.placeholder {
  padding: 48px 24px;
  margin-top: 20px;
}
</style>
