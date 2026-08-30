<script setup>
import { computed, onMounted, ref } from 'vue'
import SavModel3D from '../../components/SavModel3D.vue'

const beforeManifestUrl = `${import.meta.env.BASE_URL}models/xieyaqian/manifest.json`
const afterManifestUrl = `${import.meta.env.BASE_URL}models/xieyahou-inclined/manifest.json`
// Each SAV export has its own coordinate-aligned drilling plan. The before model
// is the supplied horizontal post-relief geometry; the after model is the supplied 10°
// inclined relief export. Keeping the plans separate prevents overlaying the
// inclined coordinates on the horizontal roadway geometry.
const beforeReliefPlanUrl = `${import.meta.env.BASE_URL}models/relief/straight-plan.json`
const afterReliefPlanUrl = `${import.meta.env.BASE_URL}models/relief/inclined-plan.json`

const stage = ref('initial')
const beforeReliefPlan = ref([])
const reliefPlan = ref([])
let reliefPlanRequestId = 0
const evaluationOpen = ref(false)
const viewerStatuses = ref({
  before: { state: 'loading', message: '', manifest: null, metrics: null },
  after: { state: 'idle', message: '', manifest: null, metrics: null }
})

const stageOrder = ['initial', 'decision', 'relief-preview', 'relieving']
const stageIndex = computed(() => stageOrder.indexOf(stage.value))
const decisionReady = computed(() => stageIndex.value >= 1)
const reliefPreviewShown = computed(() => stageIndex.value >= 2)
const reliefResultShown = computed(() => stage.value === 'relieving')
const averageStress = computed(() => Number(viewerStatuses.value.before.metrics?.averageStressMpa) || 24.681)
const peakStress = computed(() => Number(viewerStatuses.value.before.metrics?.peakStressMpa) || 46.6618)
const thresholdStress = computed(() => averageStress.value * 1.2)
const planPilotDiameter = computed(() => {
  const value = Number(reliefPlan.value[0]?.pilot_hole_diameter_m)
  return Number.isFinite(value) ? value * 1000 : 60
})
const reliefDiameter = computed(() => {
  const value = Number(reliefPlan.value[0]?.relief_hole_diameter_m)
  return Number.isFinite(value)
    ? value * 1000
    : (peakStress.value >= averageStress.value * 1.5 ? 300 : 240)
})
const pilotLengths = computed(() => reliefPlan.value
  .map((item) => Number(item.pilot_hole_length_m))
  .filter(Number.isFinite))
const pilotLengthRange = computed(() => pilotLengths.value.length
  ? `${Math.min(...pilotLengths.value).toFixed(2)}–${Math.max(...pilotLengths.value).toFixed(2)} m`
  : '--')
const reliefLengths = computed(() => reliefPlan.value
  .map((item) => Number(item.relief_hole_length_m))
  .filter(Number.isFinite))
const reliefLengthRange = computed(() => reliefLengths.value.length
  ? `${Math.min(...reliefLengths.value).toFixed(2)}–${Math.max(...reliefLengths.value).toFixed(2)} m`
  : '--')
const spacing = computed(() => {
  if (reliefPlan.value.length < 2) return '--'
  return `${Math.abs(
    Number(reliefPlan.value[1].borehole_coordinate[1])
    - Number(reliefPlan.value[0].borehole_coordinate[1])
  ).toFixed(4)} m`
})
const reliefAngle = computed(() => {
  const value = Number(reliefPlan.value[0]?.angle_deg)
  return Number.isFinite(value) ? `${value.toFixed(1)}°` : '倾斜方向'
})
const changePosition = computed(() => {
  const item = reliefPlan.value[0]
  const coordinate = item?.diameter_change_coordinate
  if (!coordinate) return '--'
  return `X = ${Number(coordinate[0]).toFixed(2)} m · Z = ${Number(coordinate[2]).toFixed(2)} m`
})
const sourceReady = computed(() => viewerStatuses.value.before.state === 'ready'
  && (!reliefPreviewShown.value || viewerStatuses.value.after.state === 'ready'))
const decisionParameters = computed(() => [
  { index: 'P1', label: '高应力靶区', value: `σ ≥ ${thresholdStress.value.toFixed(2)} MPa`, detail: '理论判据：高于模型平均应力的 1.2 倍' },
  { index: 'P2', label: '孔间距', value: spacing.value, detail: `${reliefPlan.value.length || 0} 孔覆盖模型中的卸压带` },
  { index: 'P3', label: '钻进孔孔径', value: `${planPilotDiameter.value} mm`, detail: '按倾斜 SAVE 模型小孔段截面' },
  { index: 'P4', label: '卸压孔孔径', value: `${reliefDiameter.value} mm`, detail: '按倾斜 SAVE 模型宽卸压段截面' },
  { index: 'P5', label: '钻进孔孔长', value: pilotLengthRange.value, detail: '孔口至模型变径界面的小孔段长度' },
  { index: 'P6', label: '卸压孔孔长', value: reliefLengthRange.value, detail: '模型变径界面至卸压段末端的长度' },
  { index: 'P7', label: '变径位置', value: changePosition.value, detail: `沿 ${reliefAngle.value} 倾斜方向定位（来自 FLAC3D SAVE 模型）` }
])

const formulas = [
  { code: 'F-01', title: 'Von-Mises 等效应力', expression: 'σᵥ = √{0.5[(σ₁₁−σ₂₂)²+(σ₂₂−σ₃₃)²+(σ₃₃−σ₁₁)²]+3(σ₁₂²+σ₂₃²+σ₁₃²)}' },
  { code: 'F-02', title: '高应力靶区判据', expression: 'Ωₕ = { cell | σᵥ ≥ 1.2 × σ̄ }' },
  { code: 'F-03', title: '孔数与孔间距', expression: 'N = ⌈Wₕ / R꜀⌉，S = Wₕ / N' },
  { code: 'F-04', title: '卸压孔径决策', expression: 'Dᵣ = 300 mm (σₚ ≥ 1.5σ̄)，否则 240 mm' },
  { code: 'F-05', title: '变径位置', expression: 'Pᵥ = P₀ + d · Lₚ' },
  { code: 'F-06', title: '卸压孔长', expression: 'Lᵣ = Lₕ + ΔL，ΔL ∈ [0.5, 1.0] m' }
]

const efficiencyMetrics = [
  {
    code: 'E1',
    title: '应力峰值转移度',
    expression: 'ηₜ = (L₁ − L₀) / L₀',
    weight: 0.44,
    value: 0.78,
    definition: 'L₀、L₁分别为卸压前后应力峰值距巷道表面的距离'
  },
  {
    code: 'E2',
    title: '应力峰值降低率',
    expression: 'ησ = (σpeak0 − σpeak) / σpeak0',
    weight: 0.25,
    value: 0.66,
    definition: 'σpeak0、σpeak分别为卸压前后同一应力场口径下的峰值'
  },
  {
    code: 'E3',
    title: '围岩能量释放效率',
    expression: 'ξₑ = (SED₁ − SED₀) / SED₀',
    weight: 0.31,
    value: 0.72,
    definition: 'SED₀、SED₁分别为卸压前后围岩应变能密度评价值'
  }
]

const evaluationScore = efficiencyMetrics.reduce(
  (total, metric) => total + metric.weight * metric.value,
  0
)
const evaluationResult = evaluationScore >= 0.60
  ? { grade: 'A', label: '强卸压（有效）' }
  : { grade: 'D', label: '弱卸压（不足）' }

const efficiencyGrades = [
  { grade: 'A', condition: 'T_d ≥ 0.60', diagnosis: '强卸压（有效）', action: '保持当前孔径、孔间距、孔长及变径位置，继续下一施工循环。' },
  { grade: 'B', condition: 'T_d < 0.60，ηₜ为主要薄弱项', diagnosis: '深部应力转移不足', action: '检查孔长；将变径位置调整至高应力梯度区，必要时减小孔间距。' },
  { grade: 'C', condition: 'T_d < 0.60，ησ为主要薄弱项', diagnosis: '应力峰值降幅不足', action: '安全范围内增大深部大孔径段、减小孔间距，并核验靶区覆盖范围。' },
  { grade: 'D', condition: 'T_d < 0.60，ξₑ偏低或多项薄弱', diagnosis: '能量释放或综合效能不足', action: '增加有效卸压长度或孔径，联合优化各参数；必要时重新识别高应力靶区。' }
]

function updateStatus(status) {
  viewerStatuses.value = { ...viewerStatuses.value, [status.phase || 'before']: status }
}

function advanceStage() {
  if (stage.value === 'initial') {
    stage.value = 'decision'
  } else if (stage.value === 'decision') {
    viewerStatuses.value.after = { state: 'loading', message: '', manifest: null, metrics: null }
    stage.value = 'relief-preview'
  } else if (stage.value === 'relief-preview') {
    stage.value = 'relieving'
  }
}

async function loadReliefPlan() {
  const requestId = ++reliefPlanRequestId
  try {
    const [beforeResponse, afterResponse] = await Promise.all([
      fetch(beforeReliefPlanUrl, { cache: 'no-store' }),
      fetch(afterReliefPlanUrl, { cache: 'no-store' })
    ])
    if (!beforeResponse.ok) throw new Error(`基准卸压参数 HTTP ${beforeResponse.status}`)
    if (!afterResponse.ok) throw new Error(`倾斜卸压参数 HTTP ${afterResponse.status}`)
    const [nextBeforePlan, nextAfterPlan] = await Promise.all([
      beforeResponse.json(),
      afterResponse.json()
    ])
    if (requestId === reliefPlanRequestId) {
      beforeReliefPlan.value = nextBeforePlan
      reliefPlan.value = nextAfterPlan
    }
  } catch (error) {
    console.error('卸压参数载入失败', error)
  }
}

onMounted(loadReliefPlan)
</script>

<template>
  <main class="relief-page">
    <header class="page-header">
      <router-link class="icon-button" to="/" title="返回随钻智控主界面" aria-label="返回主页">
        <span aria-hidden="true">‹</span>
      </router-link>
      <div class="brand">
        <span>PRESSURE RELIEF / DECISION &amp; EVALUATION</span>
        <strong>卸压决策与效能评估</strong>
      </div>
      <div class="runtime-state">
        <i :class="{ ready: sourceReady }"></i>
        <span>
          <strong>{{ sourceReady ? '数值模型就绪' : '正在载入数值模型' }}</strong>
          <small>xieyaqian.f3sav · FLAC3D 6.0 SAVE</small>
        </span>
      </div>
    </header>

    <section class="page-body">
      <div class="content-grid" :class="{ 'has-decision': decisionReady }">
        <section class="model-section">
          <header class="section-heading">
            <div>
              <span>NUMERICAL MODEL / 800 M DEPTH</span>
              <strong>{{ reliefPreviewShown ? '卸压前后数值演示对比' : '800米埋深巷道卸压前 Von-Mises 应力数值演示模型' }}</strong>
            </div>
            <div v-if="decisionReady" class="plan-badge">水平基准 → 倾斜卸压 · 10° SAVE 数据</div>
          </header>

          <div class="model-grid" :class="{ comparing: reliefPreviewShown }">
            <article class="model-panel before-panel">
              <div class="panel-label">
                <span>01 / 卸压前</span>
                <strong>{{ decisionReady ? '高应力靶区与卸压孔布置' : '原始应力场' }}</strong>
              </div>
              <div class="model-viewport">
                <i class="corner top-left"></i><i class="corner top-right"></i>
                <i class="corner bottom-left"></i><i class="corner bottom-right"></i>
                <SavModel3D
                  :key="beforeManifestUrl"
                  phase="before"
                  :manifest-url="beforeManifestUrl"
                  :target-visible="decisionReady"
                  :show-target-panel="false"
                  :show-relief-plan="decisionReady"
                  :relief-plan="beforeReliefPlan"
                  :relief-variant="'straight'"
                  @status="updateStatus"
                />
              </div>
            </article>

            <Transition name="model-reveal">
              <article v-if="reliefPreviewShown" class="model-panel after-panel">
                <div class="panel-label">
                  <span>02 / 卸压后</span>
                  <strong>{{ reliefResultShown ? '残余应力场与卸压结果' : '倾斜卸压孔数据预览' }}</strong>
                </div>
                <div class="model-viewport">
                  <i class="corner top-left"></i><i class="corner top-right"></i>
                  <i class="corner bottom-left"></i><i class="corner bottom-right"></i>
                  <SavModel3D
                    phase="after"
                    :manifest-url="afterManifestUrl"
                    :target-visible="reliefResultShown"
                    :show-target-panel="false"
                    :show-relief-plan="reliefPreviewShown"
                    :show-pressure-data="reliefResultShown"
                    :relief-plan="reliefPlan"
                    :relief-variant="'inclined'"
                    @status="updateStatus"
                  />
                </div>
              </article>
            </Transition>
          </div>
        </section>

        <Transition name="decision-slide">
          <aside v-if="decisionReady" class="decision-panel">
            <section class="target-summary">
              <header><span>STEP 01 / TARGET RECOGNITION</span><strong>高应力靶区已识别</strong></header>
              <div class="target-metrics">
                <div><span>模型平均应力</span><strong>{{ averageStress.toFixed(2) }}<small> MPa</small></strong></div>
                <div><span>理论识别阈值</span><strong>{{ thresholdStress.toFixed(2) }}<small> MPa</small></strong></div>
                <div><span>当前脚本阈值</span><strong>19.50<small> MPa</small></strong></div>
                <div><span>靶区峰值</span><strong class="warning">{{ peakStress.toFixed(2) }}<small> MPa</small></strong></div>
              </div>
              <p>理论判据与师兄脚本当前固定阈值分开展示，避免把 19.5 MPa 误写成 1.2 倍均值的计算结果。</p>
            </section>

            <section class="parameter-section">
              <header><span>STEP 02 / PARAMETER DECISION</span><strong>七项卸压决策参数</strong></header>
              <div class="parameter-list">
                <article v-for="item in decisionParameters" :key="item.index">
                  <span>{{ item.index }}</span>
                  <div><small>{{ item.label }}</small><strong>{{ item.value }}</strong><p>{{ item.detail }}</p></div>
                </article>
              </div>
            </section>

            <details class="formula-section">
              <summary><span>ALGORITHM FORMULAS</span><strong>决策公式与计算依据</strong><i>+</i></summary>
              <div class="formula-list">
                <article v-for="formula in formulas" :key="formula.code">
                  <span>{{ formula.code }}</span>
                  <div><strong>{{ formula.title }}</strong><code>{{ formula.expression }}</code></div>
                </article>
              </div>
            </details>
          </aside>
        </Transition>
      </div>

      <footer class="command-bar">
        <ol class="stage-track">
          <li :class="{ active: stageIndex >= 0, current: stage === 'initial' }"><span>1</span><div><strong>原始模型</strong><small>读取卸压前 SAV</small></div></li>
          <li :class="{ active: stageIndex >= 1, current: stage === 'decision' }"><span>2</span><div><strong>卸压决策</strong><small>识别靶区并生成参数</small></div></li>
          <li :class="{ active: stageIndex >= 2, current: reliefPreviewShown }"><span>3</span><div><strong>卸压结果</strong><small>{{ reliefResultShown ? '加载卸压后 SAV' : '先展示倾斜钻孔数据' }}</small></div></li>
        </ol>
        <div class="command-actions">
          <button v-if="!reliefPreviewShown" class="primary-action" type="button" :disabled="viewerStatuses.before.state !== 'ready'" @click="advanceStage">
            <span>{{ stage === 'initial' ? '识别靶区并生成卸压决策' : '开始卸压并生成结果' }}</span><i aria-hidden="true">→</i>
          </button>
          <button v-else-if="!reliefResultShown" class="primary-action" type="button" :disabled="viewerStatuses.after.state !== 'ready'" @click="advanceStage">
            <span>展示卸压压力结果</span><i aria-hidden="true">→</i>
          </button>
          <button v-else class="evaluation-action" type="button" :disabled="viewerStatuses.after.state !== 'ready'" @click="evaluationOpen = true">卸压效果评估</button>
        </div>
      </footer>
    </section>

    <Transition name="modal">
      <div v-if="evaluationOpen" class="modal-backdrop" @click.self="evaluationOpen = false">
        <section class="evaluation-modal" role="dialog" aria-modal="true" aria-labelledby="evaluation-title">
          <header>
            <div><span>RELIEF EFFICIENCY MATRIX</span><strong id="evaluation-title">基于卸压效率矩阵的卸压效果随钻定量评估结果</strong></div>
            <button type="button" title="关闭" aria-label="关闭" @click="evaluationOpen = false">×</button>
          </header>
          <div class="evaluation-grade">
            <div class="grade-summary">
              <span>800 米埋深数值演示工况</span>
              <strong><em>{{ evaluationResult.grade }}</em>级</strong>
              <b>{{ evaluationResult.label }}</b>
            </div>
            <div class="score-summary">
              <span>综合卸压效率</span>
              <strong>T<sub>d</sub> = {{ evaluationScore.toFixed(3) }}</strong>
              <small>高于 A 级阈值 0.60</small>
            </div>
            <code>T<sub>d</sub> = 0.44η<sub>t</sub> + 0.25η<sub>σ</sub> + 0.31ξ<sub>e</sub></code>
            <small>三项子指标统一归一化后进行组合赋权，综合卸压效率达到目标，判定为 A 类并维持当前卸压参数。</small>
          </div>
          <div class="evaluation-grid">
            <article v-for="metric in efficiencyMetrics" :key="metric.code">
              <div class="metric-heading"><span>{{ metric.code }}</span><em>权重 {{ metric.weight.toFixed(2) }}</em></div>
              <strong>{{ metric.title }}</strong>
              <code>{{ metric.expression }}</code>
              <b>{{ metric.value.toFixed(2) }} <small>/ {{ (metric.value * 100).toFixed(0) }}%</small></b>
              <small>{{ metric.definition }}</small>
            </article>
          </div>
          <section class="evaluation-matrix">
            <header>
              <span>EVALUATION CLASSIFICATION</span>
              <strong>卸压效能分类与参数反馈规则</strong>
            </header>
            <div class="matrix-table" role="table" aria-label="卸压效能分类规则">
              <div class="matrix-row matrix-head" role="row">
                <span role="columnheader">等级</span>
                <span role="columnheader">判定条件</span>
                <span role="columnheader">诊断结果</span>
                <span role="columnheader">参数调整建议</span>
              </div>
              <div
                v-for="item in efficiencyGrades"
                :key="item.grade"
                class="matrix-row"
                :class="{ active: item.grade === evaluationResult.grade }"
                role="row"
              >
                <strong role="cell">{{ item.grade }}</strong>
                <code role="cell">{{ item.condition }}</code>
                <span role="cell">{{ item.diagnosis }}</span>
                <p role="cell">{{ item.action }}</p>
              </div>
            </div>
          </section>
          <footer>
            <span>模型场来源：xieyaqian.f3sav / 03_model_II_inclined10_Ds120_Dl240_S1600_P5_L15.f3sav</span>
            <strong>评价依据：800 米埋深数值演示工况归一化结果及报告表 5-8 分级标准。</strong>
          </footer>
        </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.relief-page {
  --cyan: #00dbea;
  --green: #61d39b;
  --line: rgba(113, 174, 190, .2);
  display: grid;
  grid-template-rows: 68px minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  min-height: 680px;
  overflow: hidden;
  color: #dce8ea;
  background:
    linear-gradient(rgba(81, 139, 157, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(81, 139, 157, .035) 1px, transparent 1px),
    #040d13;
  background-size: 38px 38px;
}
.page-header {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: 42px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  background: rgba(4, 14, 21, .96);
  border-bottom: 1px solid var(--line);
}
.icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: #84a9b4;
  text-decoration: none;
  background: rgba(95, 151, 165, .06);
  border: 1px solid rgba(112, 176, 191, .22);
}
.icon-button:hover { color: #fff; border-color: rgba(0, 219, 234, .52); }
.icon-button span { margin-top: -2px; font: 25px/1 Arial, sans-serif; }
.brand span, .brand strong, .runtime-state strong, .runtime-state small { display: block; }
.brand span { color: #537680; font: 10px Electronic, monospace; }
.brand strong { margin-top: 3px; color: #dce9eb; font-size: 18px; font-weight: 500; }
.runtime-state { display: flex; align-items: center; gap: 9px; text-align: right; }
.runtime-state > i { width: 7px; height: 7px; background: #c59d58; border-radius: 50%; box-shadow: 0 0 9px rgba(197, 157, 88, .65); }
.runtime-state > i.ready { background: var(--green); box-shadow: 0 0 9px rgba(97, 211, 155, .72); }
.runtime-state strong { color: #cfdcdf; font-size: 12px; font-weight: 500; }
.runtime-state small { margin-top: 3px; color: #59727c; font: 10px Electronic, monospace; }
.page-body { position: relative; display: grid; grid-template-rows: minmax(0, 1fr) 74px; min-height: 0; }
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  padding: 12px 14px 0;
  transition: grid-template-columns .35s ease;
}
.content-grid.has-decision { grid-template-columns: minmax(0, 1fr) 356px; }
.model-section { display: grid; grid-template-rows: 48px minmax(0, 1fr); min-width: 0; min-height: 0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.section-heading span, .section-heading strong { display: block; }
.section-heading span { color: #69cbd9; font: 10px Electronic, monospace; }
.section-heading strong { margin-top: 4px; color: #d7e5e7; font-size: 16px; font-weight: 500; }
.plan-badge { padding: 8px 11px; color: #a9e6d2; font: 10px Electronic, monospace; background: rgba(41, 139, 112, .12); border: 1px solid rgba(103, 210, 159, .32); }
.model-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-height: 0; }
.model-grid.comparing { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.model-panel { display: grid; grid-template-rows: 36px minmax(0, 1fr); min-width: 0; min-height: 0; }
.panel-label { display: flex; align-items: center; gap: 12px; padding: 0 11px; background: rgba(4, 14, 21, .82); border: 1px solid rgba(111, 174, 189, .16); border-bottom: 0; }
.panel-label span { color: #6ed3df; font: 10px Electronic, monospace; }
.panel-label strong { color: #d8e7e9; font-size: 12px; font-weight: 500; }
.after-panel .panel-label span { color: var(--green); }
.model-viewport { position: relative; min-height: 0; overflow: hidden; background: rgba(4, 14, 21, .58); border: 1px solid rgba(111, 174, 189, .2); }
.corner { position: absolute; z-index: 8; width: 20px; height: 20px; pointer-events: none; }
.top-left { top: -1px; left: -1px; border-top: 2px solid var(--cyan); border-left: 2px solid var(--cyan); }
.top-right { top: -1px; right: -1px; border-top: 2px solid var(--cyan); border-right: 2px solid var(--cyan); }
.bottom-left { bottom: -1px; left: -1px; border-bottom: 2px solid var(--cyan); border-left: 2px solid var(--cyan); }
.bottom-right { right: -1px; bottom: -1px; border-right: 2px solid var(--cyan); border-bottom: 2px solid var(--cyan); }
.decision-panel { min-height: 0; overflow-y: auto; padding-right: 3px; scrollbar-color: rgba(86, 158, 173, .45) transparent; }
.decision-panel section, .formula-section { margin-bottom: 9px; background: rgba(4, 14, 21, .86); border: 1px solid rgba(111, 174, 189, .18); }
.decision-panel header { padding: 12px 13px 10px; border-bottom: 1px solid rgba(111, 174, 189, .14); }
.decision-panel header span, .decision-panel header strong { display: block; }
.decision-panel header span, .formula-section summary > span { color: #5fa9b6; font: 9px Electronic, monospace; }
.decision-panel header strong, .formula-section summary > strong { margin-top: 4px; color: #dce8ea; font-size: 14px; font-weight: 500; }
.target-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; padding: 9px; }
.target-metrics div { padding: 9px; background: rgba(104, 145, 157, .06); }
.target-metrics span, .target-metrics strong { display: block; }
.target-metrics span { color: #69828a; font-size: 10px; }
.target-metrics strong { margin-top: 4px; color: #e2ecee; font: 15px Electronic, monospace; }
.target-metrics strong.warning { color: #ff795f; }
.target-metrics small { color: #718890; font-size: 9px; }
.target-summary > p { margin: 0; padding: 0 13px 12px; color: #758c94; font-size: 10px; line-height: 1.6; }
.parameter-list { display: grid; gap: 1px; padding: 8px; }
.parameter-list article { display: grid; grid-template-columns: 32px 1fr; gap: 9px; padding: 8px; background: rgba(105, 143, 154, .055); }
.parameter-list article > span { color: #52b8c8; font: 10px Electronic, monospace; }
.parameter-list small, .parameter-list strong, .parameter-list p { display: block; margin: 0; }
.parameter-list small { color: #748b93; font-size: 10px; }
.parameter-list strong { margin-top: 2px; color: #dce7e9; font: 14px Electronic, monospace; }
.parameter-list p { margin-top: 3px; color: #58727b; font-size: 9px; }
.formula-section summary { position: relative; display: block; padding: 12px 42px 12px 13px; cursor: pointer; list-style: none; }
.formula-section summary::-webkit-details-marker { display: none; }
.formula-section summary > span, .formula-section summary > strong { display: block; }
.formula-section summary > i { position: absolute; top: 17px; right: 15px; color: #68cbd8; font: 20px/1 Arial, sans-serif; }
.formula-section[open] summary > i { transform: rotate(45deg); }
.formula-list { display: grid; gap: 1px; padding: 0 8px 8px; }
.formula-list article { display: grid; grid-template-columns: 34px 1fr; gap: 8px; padding: 8px; background: rgba(105, 143, 154, .055); }
.formula-list article > span { color: #6db7c3; font: 9px Electronic, monospace; }
.formula-list strong, .formula-list code { display: block; }
.formula-list strong { color: #aebfc4; font-size: 10px; font-weight: 500; }
.formula-list code { margin-top: 5px; color: #d7e6e9; font: 10px/1.5 Consolas, monospace; white-space: normal; }
.command-bar { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 18px; padding: 9px 15px; background: rgba(3, 12, 18, .96); border-top: 1px solid var(--line); }
.stage-track { display: flex; align-items: center; margin: 0; padding: 0; list-style: none; }
.stage-track li { position: relative; display: flex; align-items: center; gap: 8px; min-width: 174px; color: #516a72; }
.stage-track li:not(:last-child)::after { width: 50px; height: 1px; margin: 0 15px; background: rgba(103, 143, 154, .2); content: ''; }
.stage-track li.active:not(:last-child)::after { background: rgba(0, 219, 234, .38); }
.stage-track li > span { display: grid; place-items: center; width: 26px; height: 26px; font: 10px Electronic, monospace; border: 1px solid rgba(104, 144, 155, .24); }
.stage-track li.active > span { color: #c9f5f7; background: rgba(0, 219, 234, .11); border-color: rgba(0, 219, 234, .45); }
.stage-track li.current > span { box-shadow: 0 0 14px rgba(0, 219, 234, .25); }
.stage-track strong, .stage-track small { display: block; }
.stage-track strong { color: #8da2a8; font-size: 11px; font-weight: 500; }
.stage-track li.active strong { color: #dce8ea; }
.stage-track small { margin-top: 2px; font-size: 9px; }
.command-actions button { min-width: 220px; height: 42px; padding: 0 15px; color: #e8f8f9; font-size: 12px; border: 1px solid rgba(0, 219, 234, .5); cursor: pointer; }
.command-actions button:disabled { cursor: wait; opacity: .45; }
.primary-action { display: flex; align-items: center; justify-content: space-between; gap: 15px; background: rgba(0, 155, 171, .18); }
.primary-action:hover:not(:disabled) { background: rgba(0, 180, 196, .28); }
.primary-action i { font: 18px/1 Arial, sans-serif; }
.evaluation-action { background: rgba(47, 165, 113, .22); border-color: rgba(97, 211, 155, .55) !important; }
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px; background: rgba(0, 6, 10, .78); backdrop-filter: blur(5px); }
.evaluation-modal { width: min(1160px, 100%); max-height: calc(100vh - 48px); overflow: auto; background: #07131a; border: 1px solid rgba(99, 204, 218, .34); box-shadow: 0 28px 80px rgba(0, 0, 0, .5); }
.evaluation-modal > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 20px 22px; border-bottom: 1px solid var(--line); }
.evaluation-modal header span, .evaluation-modal header strong { display: block; }
.evaluation-modal header span { color: #69cbd9; font: 10px Electronic, monospace; }
.evaluation-modal header strong { margin-top: 5px; font-size: 19px; font-weight: 500; }
.evaluation-modal header button { width: 32px; height: 32px; color: #91a8af; font-size: 22px; background: transparent; border: 1px solid var(--line); cursor: pointer; }
.evaluation-grade { display: grid; grid-template-columns: minmax(190px, auto) minmax(220px, auto) minmax(300px, 1fr); align-items: center; gap: 14px 24px; padding: 18px 22px; background: linear-gradient(90deg, rgba(39, 163, 111, .12), transparent 52%); border-bottom: 1px solid var(--line); }
.evaluation-grade span { display: block; color: #769199; font-size: 11px; }
.evaluation-grade strong { display: block; margin-top: 5px; color: #ffd06a; font-size: 24px; font-weight: 500; }
.evaluation-grade strong sub { font-size: .6em; }
.grade-summary { display: grid; grid-template-columns: auto 1fr; align-items: end; gap: 0 12px; }
.grade-summary span { grid-column: 1 / -1; }
.grade-summary strong { color: #72e0a7; font-size: 27px; }
.grade-summary strong em { font: normal 42px/.9 Electronic, monospace; }
.grade-summary b { padding-bottom: 2px; color: #a9ecc9; font-size: 14px; font-weight: 500; }
.score-summary small { display: block; margin-top: 4px; color: #82b99e; font-size: 10px; }
.evaluation-grade code { justify-self: end; color: #e5f4f5; font: 18px/1.4 Consolas, monospace; }
.evaluation-grade > small { grid-column: 1 / -1; color: #789099; font-size: 10px; }
.evaluation-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; padding: 16px; }
.evaluation-grid article { min-height: 190px; padding: 16px; background: rgba(105, 148, 160, .06); border-top: 1px solid rgba(105, 190, 205, .25); }
.metric-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.evaluation-grid span { color: #65c4d3; font: 10px Electronic, monospace; }
.evaluation-grid em { color: #c5a764; font: normal 10px Electronic, monospace; }
.evaluation-grid strong, .evaluation-grid code, .evaluation-grid b, .evaluation-grid small { display: block; }
.evaluation-grid strong { margin-top: 14px; font-size: 14px; font-weight: 500; }
.evaluation-grid code { min-height: 40px; margin-top: 13px; color: #dcebed; font: 14px/1.55 Consolas, monospace; }
.evaluation-grid b { margin-top: 13px; color: #75d4aa; font: 21px Electronic, monospace; font-weight: 400; }
.evaluation-grid b small { display: inline; margin: 0; color: #8bacb2; font-size: 10px; }
.evaluation-grid small { margin-top: 10px; color: #6f858d; font-size: 10px; line-height: 1.55; }
.evaluation-matrix { margin: 0 16px 16px; border: 1px solid rgba(105, 190, 205, .18); }
.evaluation-matrix > header { padding: 13px 15px; border-bottom: 1px solid var(--line); }
.evaluation-matrix > header span, .evaluation-matrix > header strong { display: block; }
.evaluation-matrix > header span { color: #5fa9b6; font: 9px Electronic, monospace; }
.evaluation-matrix > header strong { margin-top: 4px; color: #dce8ea; font-size: 14px; font-weight: 500; }
.matrix-table { min-width: 780px; }
.matrix-row { display: grid; grid-template-columns: 58px minmax(190px, .9fr) minmax(150px, .7fr) minmax(330px, 1.6fr); align-items: stretch; border-top: 1px solid rgba(105, 190, 205, .1); }
.matrix-row:first-child { border-top: 0; }
.matrix-row > * { display: flex; align-items: center; min-width: 0; margin: 0; padding: 10px 12px; border-left: 1px solid rgba(105, 190, 205, .1); }
.matrix-row > *:first-child { border-left: 0; }
.matrix-row > strong { justify-content: center; color: #ffd06a; font: 19px Electronic, monospace; }
.matrix-row > code { color: #b9d7dc; font: 11px/1.55 Consolas, monospace; white-space: normal; }
.matrix-row > span { color: #d3e1e4; font-size: 11px; }
.matrix-row > p { color: #79939b; font-size: 10px; line-height: 1.65; }
.matrix-row.active { background: rgba(53, 184, 124, .12); box-shadow: inset 3px 0 #64d99c; }
.matrix-row.active > strong { color: #72e0a7; }
.matrix-row.active > code, .matrix-row.active > span { color: #ddf8ea; }
.matrix-row.active > p { color: #9ed5ba; }
.matrix-head { color: #67838c; background: rgba(83, 138, 151, .06); font-size: 9px; }
.matrix-head > span { color: #67838c; font-size: 9px; }
.evaluation-modal > footer { display: flex; justify-content: space-between; gap: 20px; padding: 14px 22px; color: #647d85; font-size: 9px; border-top: 1px solid var(--line); }
.evaluation-modal > footer strong { color: #bd9b5f; font-weight: 500; }
.decision-slide-enter-active, .decision-slide-leave-active, .model-reveal-enter-active, .model-reveal-leave-active, .modal-enter-active, .modal-leave-active { transition: opacity .25s ease, transform .25s ease; }
.decision-slide-enter-from, .decision-slide-leave-to { opacity: 0; transform: translateX(18px); }
.model-reveal-enter-from, .model-reveal-leave-to { opacity: 0; transform: translateX(15px); }
.modal-enter-from, .modal-leave-to { opacity: 0; }
@media (max-width: 1180px) {
  .content-grid.has-decision { grid-template-columns: minmax(0, 1fr) 320px; }
  .stage-track li { min-width: auto; }
  .stage-track li:not(:last-child)::after { width: 28px; margin: 0 10px; }
  .stage-track small { display: none; }
}
@media (max-width: 820px) {
  .relief-page { height: 100vh; min-height: 0; overflow-y: auto; }
  .page-header { grid-template-columns: 36px 1fr; padding: 0 12px; }
  .runtime-state { display: none; }
  .page-body { display: block; }
  .content-grid, .content-grid.has-decision { display: block; padding: 10px; }
  .model-section { grid-template-rows: auto auto; }
  .section-heading { align-items: flex-start; margin-bottom: 10px; }
  .section-heading strong { font-size: 14px; }
  .model-grid, .model-grid.comparing { grid-template-columns: 1fr; }
  .model-panel { grid-template-rows: 36px 540px; margin-bottom: 10px; }
  .decision-panel { overflow: visible; }
  .command-bar { position: sticky; bottom: 0; z-index: 30; grid-template-columns: 1fr; gap: 8px; }
  .stage-track { justify-content: center; }
  .stage-track li div { display: none; }
  .stage-track li:not(:last-child)::after { width: 45px; }
  .command-actions button { width: 100%; }
  .evaluation-grid { grid-template-columns: 1fr; }
  .evaluation-grade { grid-template-columns: 1fr; }
  .evaluation-grade code { justify-self: start; font-size: 14px; }
  .evaluation-grade small { grid-column: auto; }
  .evaluation-matrix { overflow-x: auto; }
  .evaluation-modal > footer { display: block; line-height: 1.7; }
}
@media (max-width: 520px) {
  .brand span { font-size: 8px; }
  .brand strong { font-size: 15px; }
  .section-heading { display: block; }
  .model-panel { grid-template-rows: 36px 500px; }
  .panel-label strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .modal-backdrop { padding: 10px; }
  .evaluation-modal header strong { font-size: 15px; }
}
</style>
