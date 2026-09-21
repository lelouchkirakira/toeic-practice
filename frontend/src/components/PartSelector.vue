<script setup lang="ts">
import { ref } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'

const emit = defineEmits<{
  start: [part: string, count: number]
}>()

const selectedPart = ref('5')
const selectedCount = ref(10)

const partOptions = [
  { label: 'Part 5 - Incomplete Sentences', value: '5' },
  { label: 'Part 6 - Text Completion', value: '6' },
  { label: 'Part 7 - Reading Comprehension', value: '7' },
  { label: 'Mixed', value: 'mixed' },
  { label: 'Vocabulary - Word Quiz', value: 'vocab' }
]

const countOptions = [
  { label: '5 questions', value: 5 },
  { label: '10 questions', value: 10 },
  { label: '15 questions', value: 15 }
]

function handleStart() {
  emit('start', selectedPart.value, selectedCount.value)
}
</script>

<template>
  <div class="part-selector">
    <h2>Choose Your Practice</h2>

    <div class="selector-row">
      <div class="field">
        <label>Part</label>
        <Select
          v-model="selectedPart"
          :options="partOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
      </div>

      <div class="field">
        <label>Questions</label>
        <Select
          v-model="selectedCount"
          :options="countOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
      </div>
    </div>

    <Button
      label="Start Practice"
      icon="pi pi-play"
      @click="handleStart"
      class="start-btn"
    />
  </div>
</template>

<style scoped>
.part-selector {
  text-align: center;
  padding: 48px 0;
}

.part-selector h2 {
  margin-bottom: 32px;
  font-size: 1.5rem;
}

.selector-row {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 240px;
}

.field label {
  font-weight: 600;
  font-size: 0.875rem;
}

.start-btn {
  min-width: 200px;
}
</style>
