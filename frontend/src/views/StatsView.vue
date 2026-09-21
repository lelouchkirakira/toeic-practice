<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useStats } from '../composables/useStats'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Chart from 'primevue/chart'
import Message from 'primevue/message'

const { overview, history, isLoading, loadStats } = useStats()

onMounted(() => {
  loadStats()
})

const chartData = computed(() => {
  if (!history.value.length) return null

  const sorted = [...history.value].reverse()
  return {
    labels: sorted.map((_, i) => `#${i + 1}`),
    datasets: [
      {
        label: 'Score (%)',
        data: sorted.map(s => s.score),
        fill: false,
        borderColor: '#6366f1',
        backgroundColor: '#6366f1',
        tension: 0.3
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: { stepSize: 20 }
    }
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function partLabel(part: string): string {
  if (part === 'mixed') return 'Mixed'
  if (part === 'vocab') return 'Vocabulary'
  return `Part ${part}`
}

function accuracySeverity(acc: number): 'success' | 'warn' | 'danger' {
  if (acc >= 80) return 'success'
  if (acc >= 60) return 'warn'
  return 'danger'
}
</script>

<template>
  <div class="stats-view">
    <h1>Statistics</h1>

    <div v-if="isLoading" class="loading">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
    </div>

    <Message v-else-if="!overview || overview.total_sessions === 0" severity="info" :closable="false">
      No data yet. Complete a practice session or mock test to see your stats.
    </Message>

    <template v-else>
      <!-- Overview Cards -->
      <div class="stats-grid">
        <Card class="stat-card">
          <template #content>
            <div class="stat-num">{{ overview.total_sessions }}</div>
            <div class="stat-label">Total Sessions</div>
          </template>
        </Card>
        <Card class="stat-card">
          <template #content>
            <div class="stat-num">{{ overview.total_questions }}</div>
            <div class="stat-label">Questions Answered</div>
          </template>
        </Card>
        <Card class="stat-card">
          <template #content>
            <div class="stat-num" :style="{ color: overview.overall_accuracy >= 70 ? 'var(--p-green-500)' : 'var(--p-red-500)' }">
              {{ overview.overall_accuracy }}%
            </div>
            <div class="stat-label">Overall Accuracy</div>
          </template>
        </Card>
      </div>

      <!-- Score Trend -->
      <Card v-if="chartData" class="chart-card">
        <template #title>Score Trend</template>
        <template #content>
          <div class="chart-container">
            <Chart type="line" :data="chartData" :options="chartOptions" />
          </div>
        </template>
      </Card>

      <!-- Part Accuracy -->
      <Card v-if="Object.keys(overview.part_accuracy).length > 0" class="parts-card">
        <template #title>Accuracy by Part</template>
        <template #content>
          <div class="parts-list">
            <div v-for="(acc, part) in overview.part_accuracy" :key="part" class="part-row">
              <span class="part-name">Part {{ part }}</span>
              <div class="part-bar-wrapper">
                <div class="part-bar" :style="{ width: `${acc}%` }" :class="accuracySeverity(acc)"></div>
              </div>
              <Tag :value="`${acc}%`" :severity="accuracySeverity(acc)" />
            </div>
          </div>
        </template>
      </Card>

      <!-- Weak Categories -->
      <Card v-if="overview.weak_categories.length > 0" class="weak-card">
        <template #title>Areas to Improve</template>
        <template #content>
          <div class="weak-list">
            <Tag v-for="cat in overview.weak_categories" :key="cat" :value="cat" severity="warn" class="weak-tag" />
          </div>
        </template>
      </Card>

      <!-- History Table -->
      <Card v-if="history.length > 0" class="history-card">
        <template #title>Recent Sessions</template>
        <template #content>
          <DataTable :value="history" :rows="10" stripedRows size="small">
            <Column header="Date" field="created_at">
              <template #body="{ data }">{{ formatDate(data.created_at) }}</template>
            </Column>
            <Column header="Mode" field="mode">
              <template #body="{ data }">{{ data.mode === 'mock' ? 'Mock Test' : 'Practice' }}</template>
            </Column>
            <Column header="Part" field="part">
              <template #body="{ data }">{{ partLabel(data.part) }}</template>
            </Column>
            <Column header="Score">
              <template #body="{ data }">
                <Tag :value="`${data.score}%`" :severity="accuracySeverity(data.score)" />
              </template>
            </Column>
            <Column header="Questions">
              <template #body="{ data }">{{ data.correct_count }}/{{ data.total_questions }}</template>
            </Column>
            <Column header="Time">
              <template #body="{ data }">{{ formatTime(data.time_spent_seconds) }}</template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.stats-view {
  max-width: 800px;
  margin: 0 auto;
}

.stats-view h1 {
  margin-bottom: 24px;
}

.loading {
  text-align: center;
  padding: 48px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  text-align: center;
}

.stat-num {
  font-size: 2rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  margin-top: 4px;
}

.chart-card,
.parts-card,
.weak-card,
.history-card {
  margin-bottom: 24px;
}

.chart-container {
  height: 240px;
}

.parts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.part-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.part-name {
  min-width: 60px;
  font-weight: 600;
}

.part-bar-wrapper {
  flex: 1;
  height: 8px;
  background: var(--p-surface-200);
  border-radius: 4px;
  overflow: hidden;
}

.part-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.part-bar.success { background: var(--p-green-500); }
.part-bar.warn { background: var(--p-yellow-500); }
.part-bar.danger { background: var(--p-red-500); }

.weak-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.weak-tag {
  font-size: 0.875rem;
}
</style>
