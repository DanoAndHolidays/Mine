import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const dataUrl = (fileName) => `${import.meta.env.BASE_URL}data/${fileName}`

export const useDrillingStore = defineStore('drillingData', () => {
  // ---- state ----
  const summary = ref(null)
  const experiments = ref([])
  const overallMetrics = ref([])
  const byFileMetrics = ref([])
  const telemetry = ref(null)
  const ringCloud = ref(null)
  const spatialRoadway = ref(null)
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref(null)

  const selectedStress = ref(20)
  const selectedModel = ref('v3')
  const selectedBoreholeId = ref('BH-01')
  const selectedExperimentId = ref(null)

  // ---- actions ----
  async function loadSummary() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const resp = await fetch(dataUrl('dashboard_summary.json'))
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      summary.value = await resp.json()
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function loadExperimentManifest() {
    if (experiments.value.length > 0) return
    try {
      const resp = await fetch(dataUrl('experiment_manifest.csv'))
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const text = await resp.text()
      experiments.value = parseCSV(text)
    } catch (err) {
      console.warn('Failed to load experiment manifest:', err.message)
    }
  }

  async function loadMetrics() {
    if (overallMetrics.value.length > 0) return
    try {
      const [overallResp, byFileResp] = await Promise.all([
        fetch(dataUrl('overall_metrics.csv')),
        fetch(dataUrl('by_file_metrics.csv'))
      ])
      if (overallResp.ok) {
        const text = await overallResp.text()
        overallMetrics.value = parseCSV(text)
      }
      if (byFileResp.ok) {
        const text = await byFileResp.text()
        byFileMetrics.value = parseCSV(text)
      }
    } catch (err) {
      console.warn('Failed to load metrics:', err.message)
    }
  }

  async function loadTelemetry() {
    if (telemetry.value) return
    try {
      const resp = await fetch(dataUrl('drilling_telemetry.json'))
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      telemetry.value = await resp.json()
    } catch (err) {
      error.value = `遥测数据加载失败：${err.message}`
    }
  }

  async function loadRingCloud() {
    if (ringCloud.value) return
    try {
      const resp = await fetch(dataUrl('ring_cloud_v4.json'))
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      ringCloud.value = await resp.json()
      if (!ringCloud.value.boreholes?.some(item => item.id === selectedBoreholeId.value)) {
        selectedBoreholeId.value = ringCloud.value.boreholes?.[0]?.id || null
      }
    } catch (err) {
      error.value = `Vtest4 环形钻孔数据加载失败：${err.message}`
    }
  }

  async function loadSpatialRoadway() {
    if (spatialRoadway.value) return
    try {
      const resp = await fetch(dataUrl('roadway_spatial_v4.json'))
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      spatialRoadway.value = await resp.json()
    } catch (err) {
      error.value = `巷道空间反演数据加载失败：${err.message}`
    }
  }

  async function loadAll() {
    if (loaded.value) return
    await Promise.all([loadSummary(), loadRingCloud(), loadSpatialRoadway()])
    loaded.value = true
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim())
    return lines.slice(1).map(line => {
      const values = line.split(',')
      const obj = {}
      headers.forEach((h, i) => {
        const v = values[i]?.trim()
        obj[h] = isNaN(v) || v === '' ? v : parseFloat(v)
      })
      return obj
    })
  }

  // ---- computed ----
  const activeModel = computed(() => {
    const v4Model = ringCloud.value?.meta?.models?.find(m => m.id === selectedModel.value)
    if (v4Model) {
      return {
        id: v4Model.id,
        name: v4Model.name,
        name_en: v4Model.nameEn,
        damage_accuracy: v4Model.damageAccuracy,
        stress_accuracy: v4Model.stressAccuracy,
        state_accuracy: v4Model.stateAccuracy,
        macro_f1: v4Model.macroF1,
        confidence: v4Model.confidence
      }
    }
    if (!summary.value) return null
    return summary.value.models.find(m => m.id === selectedModel.value) || summary.value.models[0]
  })

  const models = computed(() => (ringCloud.value?.meta?.models || []).map(model => ({
    id: model.id,
    name: model.name,
    name_en: model.nameEn,
    damage_accuracy: model.damageAccuracy,
    stress_accuracy: model.stressAccuracy,
    state_accuracy: model.stateAccuracy,
    macro_f1: model.macroF1,
    confidence: model.confidence
  })))

  const boreholes = computed(() => ringCloud.value?.boreholes || [])
  const activeBorehole = computed(() => (
    boreholes.value.find(item => item.id === selectedBoreholeId.value) || boreholes.value[0] || null
  ))

  const stressLevels = computed(() => {
    if (!summary.value) return []
    return summary.value.dataset.stress_levels_mpa
  })

  const damageLevels = computed(() => {
    if (!summary.value) return []
    return summary.value.dataset.damage_levels
  })

  const experimentStatsByDamage = computed(() => {
    if (!summary.value) return []
    return summary.value.experiment_stats.by_damage
  })

  const experimentStatsByStress = computed(() => {
    if (!summary.value) return []
    return summary.value.experiment_stats.by_stress
  })

  const filteredExperiments = computed(() => {
    if (!experiments.value.length) return []
    return experiments.value.filter(e =>
      e.stress_mpa === selectedStress.value && e.source_type === 'original'
    )
  })

  const stressFileMetrics = computed(() => {
    if (!byFileMetrics.value.length || !summary.value) return []
    const modelMap = { v1: 'advancedV1_multiscale_extratrees', v2: 'advancedV2_cnn_bilstm', v3: 'advancedV3_physics_fusion' }
    const modelName = modelMap[selectedModel.value]
    return byFileMetrics.value.filter(m => m.model === modelName)
  })

  const currentStressAccuracy = computed(() => {
    const files = stressFileMetrics.value
    if (!files.length) return null
    const stressMPa = selectedStress.value
    const matching = files.filter(f => f.source_file.includes(`S${String(stressMPa).padStart(2, '0')}`))
    if (!matching.length) return null
    return {
      damage_acc: (matching.reduce((s, f) => s + f.damage_accuracy, 0) / matching.length * 100).toFixed(1),
      stress_acc: (matching.reduce((s, f) => s + f.stress_accuracy, 0) / matching.length * 100).toFixed(1),
      state_acc: (matching.reduce((s, f) => s + f.state_head_accuracy, 0) / matching.length * 100).toFixed(1)
    }
  })

  // Find representative torque/thrust stats for selected stress
  const currentStressStats = computed(() => {
    if (!summary.value) return null
    const stats = summary.value.experiment_stats.by_stress.find(
      s => s.stress === selectedStress.value
    )
    if (!stats) return null
    // Also get damage-level breakdown
    const damageStats = summary.value.experiment_stats.by_damage
    return { stress: stats, damage: damageStats }
  })

  const currentTelemetrySeries = computed(() => {
    return activeBorehole.value?.samples || []
  })

  return {
    summary, experiments, overallMetrics, byFileMetrics, telemetry, ringCloud, spatialRoadway,
    loaded, loading, error,
    selectedStress, selectedModel, selectedBoreholeId, selectedExperimentId,
    loadSummary, loadExperimentManifest, loadMetrics, loadTelemetry, loadRingCloud, loadSpatialRoadway, loadAll,
    activeModel, models, boreholes, activeBorehole, stressLevels, damageLevels,
    experimentStatsByDamage, experimentStatsByStress,
    filteredExperiments, stressFileMetrics, currentStressAccuracy,
    currentStressStats, currentTelemetrySeries
  }
})
