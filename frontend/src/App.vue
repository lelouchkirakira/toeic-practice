<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import Menubar from 'primevue/menubar'
import { computed } from 'vue'

const router = useRouter()
const route = useRoute()

const items = computed(() => [
  {
    label: 'Practice',
    icon: 'pi pi-pencil',
    command: () => router.push('/'),
    class: route.path === '/' ? 'p-menuitem-active' : ''
  },
  {
    label: 'Mock Test',
    icon: 'pi pi-clock',
    command: () => router.push('/mock-test'),
    class: route.path === '/mock-test' ? 'p-menuitem-active' : ''
  },
  {
    label: 'Vocabulary',
    icon: 'pi pi-book',
    command: () => router.push('/vocabulary'),
    class: route.path === '/vocabulary' ? 'p-menuitem-active' : ''
  },
  {
    label: 'Stats',
    icon: 'pi pi-chart-bar',
    command: () => router.push('/stats'),
    class: route.path === '/stats' ? 'p-menuitem-active' : ''
  }
])
</script>

<template>
  <Toast />
  <ConfirmDialog />
  <header>
    <Menubar :model="items">
      <template #start>
        <span class="app-title">TOEIC Practice</span>
      </template>
    </Menubar>
  </header>
  <main class="container">
    <router-view />
  </main>
</template>

<style scoped>
.app-title {
  font-weight: 700;
  font-size: 1.125rem;
  margin-right: 24px;
}
</style>
