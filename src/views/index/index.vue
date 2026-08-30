<template>
  <main class="digital-twin-screen">
    <div class="ambient-grid"></div>
    <header class="top-header">
      <div class="system-brand">
        <div class="brand-mark"><span></span><span></span><span></span></div>
        <div>
          <strong>SZIC</strong>
          <small>WHILE-DRILLING INTELLIGENCE</small>
        </div>
      </div>
      <div class="title-block">
        <p><i></i> INTELLIGENT SENSING &amp; PRESSURE-RELIEF DECISION <i></i></p>
        <h1><span>随钻智控</span><small>基于随钻参数的深部强扰动围岩状态精细感知与智能卸压决策平台</small></h1>
        <div class="title-rule"><span></span></div>
      </div>
      <div class="system-state">
        <div class="clock"><strong>{{ clockTime }}</strong><small>{{ clockDate }}</small></div>
        <div class="online"><i></i><span>双源数据已接入<br><small>VTEST4 / FITTING</small></span></div>
        <button class="import-data-trigger" type="button" @click="openImportModal">
          <span class="import-trigger-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3v11m0-11L8 7m4-4 4 4M5 13v6h14v-6" /></svg>
          </span>
          <span><strong>导入数据</strong><small>IMPORT DATA</small></span>
        </button>
        <router-link class="relief-entry" to="/detail" title="进入卸压决策">
          <span class="relief-entry-icon" aria-hidden="true">→</span>
          <span><strong>进入卸压决策</strong><small>RELIEF DECISION</small></span>
        </router-link>
      </div>
    </header>

    <section class="dashboard-body">
      <aside class="side-column left-column">
        <!-- Panel 01: 实验数据集概览 -->
        <section class="panel overview-panel">
          <PanelTitle code="01" title="数据集概况" sub="DATASET OVERVIEW" />
          <div class="project-name">
            <span class="project-icon">井</span>
            <div>
              <strong>随钻智控 · Vtest4 感知数据</strong>
              <small>11 钻孔 · 3 模型 · 连续时序拟合</small>
            </div>
            <em v-if="store.ringCloud">{{ telemetrySampleCount }} 点映射</em>
          </div>
          <div class="overview-grid">
            <div><span>环向钻孔</span><strong>{{ store.ringCloud?.meta.boreholeCount || '--' }}<small> 孔</small></strong></div>
            <div><span>原始测点</span><strong>{{ ((store.ringCloud?.meta.rawRows || 0) / 10000).toFixed(2) }}<small> 万</small></strong></div>
            <div><span>拟合分组</span><strong>{{ store.ringCloud?.meta.fitGroupCount || '--' }}<small> 组</small></strong></div>
            <div><span>钻深范围</span><strong>0–125<small> cm</small></strong></div>
          </div>
          <div class="relief-status" :class="{ available: reliefInfo.available }">
            <i></i><span>泄压模型</span><strong>{{ reliefInfo.available ? '已接入' : '未检出显式数据' }}</strong>
            <small>S99 为 10–40 MPa 变应力特殊孔</small>
          </div>
        </section>

        <!-- Panel 02: 钻进参数统计 -->
        <section class="panel load-panel">
          <PanelTitle code="02" title="钻进参数统计" sub="DRILLING PARAMETERS" />
          <div class="load-kpis">
            <div class="load-row" v-for="item in drillingKpis" :key="item.label">
              <div class="kpi-icon" :class="item.tone">{{ item.icon }}</div>
              <div class="kpi-data">
                <span>{{ item.label }} <small>{{ item.sub }}</small></span>
                <strong>{{ item.value }}<em>{{ item.unit }}</em></strong>
              </div>
              <div class="mini-bars">
                <i v-for="n in 8" :key="n" :class="{ on: n <= item.level }"></i>
              </div>
            </div>
          </div>
        </section>

        <!-- Panel 03: 扭矩-推力随深度趋势 -->
        <section class="panel trend-panel">
          <PanelTitle code="03" title="钻进参数趋势" sub="DRILLING TREND" />
          <div class="chart-head">
            <span>{{ currentSample?.actualState || '读取数据中' }} · 样本 #{{ currentSample?.sample ?? '--' }}</span>
            <strong>当前 {{ formatValue(currentSample?.torque, 1) }} N·m</strong>
          </div>
          <svg class="trend-chart" viewBox="0 0 280 102" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#1ccfff" stop-opacity=".42" />
                <stop offset="1" stop-color="#1ccfff" stop-opacity="0" />
              </linearGradient>
              <filter id="lineGlow"><feGaussianBlur stdDeviation="1.8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g class="chart-grid"><line v-for="y in [18,42,66,90]" :key="y" x1="0" :y1="y" x2="280" :y2="y" /></g>
            <polygon :points="trendArea" fill="url(#areaGradient)" />
            <polyline :points="trendPoints" fill="none" stroke="#42dcff" stroke-width="2" filter="url(#lineGlow)" />
            <line v-if="trendCurrent" :x1="trendCurrent.x" y1="10" :x2="trendCurrent.x" y2="96" class="cursor-line" />
            <circle v-if="trendCurrent" :cx="trendCurrent.x" :cy="trendCurrent.y" r="3.5" fill="#061326" stroke="#ffb22b" stroke-width="2" />
          </svg>
          <div class="chart-axis">
            <span>0 cm</span><span>40 cm</span><span>80 cm</span><span>125 cm</span>
          </div>
        </section>
      </aside>

      <section class="center-stage">
        <div class="scene-heading">
          <div>
            <span class="live-dot"></span>
            <p>多钻孔联合拟合双场 <small>MULTI-BOREHOLE STRESS / DAMAGE FIELDS</small></p>
          </div>
          <div class="fit-method"><span>径向线性插值</span><i></i><span>环向周期 RBF</span></div>
        </div>
        <div class="scene-frame dual-scene-frame">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div class="dual-cloud-grid">
            <article class="cloud-pane stress-cloud-pane">
              <RockCloud3D
                compact
                :progress="cloudProgress"
                metric="stress"
                :slice="slice"
                :auto-rotate="autoRotate"
                :view-mode="viewMode"
                :playing="playing"
                :speed="evolutionSpeed"
                :model-id="store.selectedModel"
                :boreholes="store.boreholes"
                :spatial-groups="store.spatialRoadway?.groups || []"
                :selected-borehole-id="store.selectedBoreholeId"
                :selected-group-id="selectedSectionId"
                :max-depth="store.ringCloud?.meta.depthRangeCm?.[1] || 125"
                @sample="cloudSample = $event"
                @select="store.selectedBoreholeId = $event"
                @slice-select="selectAnalysisSlice"
              />
              <div class="cloud-legend pane-legend stress-legend">
                <div class="legend-title"><span>{{ stressMetric.label }}</span><small>{{ stressMetric.unit }}</small></div>
                <div class="legend-scale stress-scale"></div>
                <div class="legend-labels"><span v-for="tick in stressMetric.ticks" :key="tick">{{ tick }}</span></div>
              </div>
              <div class="pane-readout stress-readout"><span>σ</span><strong>{{ formatValue(currentSpatialSample?.stressMpa ?? currentPrediction?.stress, 1) }}</strong><em>MPa</em></div>
            </article>
            <article class="cloud-pane damage-cloud-pane">
              <RockCloud3D
                compact
                :progress="cloudProgress"
                metric="damage"
                :slice="slice"
                :auto-rotate="autoRotate"
                :view-mode="viewMode"
                :playing="playing"
                :speed="evolutionSpeed"
                :model-id="store.selectedModel"
                :boreholes="store.boreholes"
                :spatial-groups="store.spatialRoadway?.groups || []"
                :selected-borehole-id="store.selectedBoreholeId"
                :selected-group-id="selectedSectionId"
                :max-depth="store.ringCloud?.meta.depthRangeCm?.[1] || 125"
                @select="store.selectedBoreholeId = $event"
                @slice-select="selectAnalysisSlice"
              />
              <div class="cloud-legend pane-legend damage-legend">
                <div class="legend-title"><span>{{ damageMetric.label }}</span><small>{{ damageMetric.unit }}</small></div>
                <div class="legend-scale damage-scale"></div>
                <div class="legend-labels"><span v-for="tick in damageMetric.ticks" :key="tick">{{ tick }}</span></div>
              </div>
              <div class="pane-readout damage-readout"><span>D</span><strong>{{ formatValue(currentSpatialSample?.damagePct ?? currentPrediction?.damage, 0) }}</strong><em>%</em></div>
            </article>
          </div>
          <div class="scene-data-strip">
            <div><span>当前断面 / 钻孔</span><strong>{{ selectedSectionId }}组 X={{ formatSigned(selectedSpatialGroup?.longitudinalM) }}m · {{ selectedSpatialBorehole?.id || '--' }}</strong></div>
            <div><span>径向分析深度</span><strong>{{ analysisDepth.toFixed(1) }} cm</strong></div>
            <div><span>实测 / 反演应力</span><strong>{{ formatValue(currentSpatialSample?.trueStressMpa, 0) }} / {{ formatValue(currentSpatialSample?.stressMpa, 0) }} MPa</strong></div>
            <div><span>反演损伤 / 置信度</span><strong>{{ formatValue(currentSpatialSample?.damagePct, 0) }}% / {{ formatValue((currentSpatialSample?.confidence || 0) * 100, 1) }}%</strong></div>
          </div>
        </div>
        <div class="scene-controls">
          <div class="control-row primary">
            <div class="view-switch">
              <button v-for="view in views" :key="view.key" :class="{ active: viewMode === view.key }" @click="viewMode = view.key">
                <span>{{ view.icon }}</span>{{ view.label }}
              </button>
            </div>
            <div class="model-select-inline">
              <button v-for="m in store.models" :key="m.id"
                :class="{ active: store.selectedModel === m.id }"
                @click="store.selectedModel = m.id">{{ m.id.toUpperCase() }}</button>
            </div>
            <div class="section-group-select">
              <button v-for="group in spatialGroups" :key="group.id"
                :class="{ active: selectedSectionId === group.id }"
                :title="`${group.label} · 巷道纵向 ${formatSigned(group.longitudinalM)} m · ${group.boreholeCount} 孔`"
                @click="selectSectionGroup(group.id)">
                <b>{{ group.id }}</b><span>{{ formatSigned(group.longitudinalM) }}m</span>
              </button>
            </div>
          </div>
          <div class="control-row borehole-row">
            <div class="active-group-summary">
              <b>{{ selectedSectionId }}组</b>
              <span>X={{ formatSigned(selectedSpatialGroup?.longitudinalM) }}m</span>
              <em>{{ selectedGroupBoreholes.length }}孔</em>
            </div>
            <div class="borehole-select-inline">
              <button v-for="hole in selectedGroupBoreholes" :key="hole.id"
                :class="{ active: selectedSpatialBorehole?.id === hole.id }"
                :title="`${hole.id} · ${hole.sourceFile}`"
                @click="selectSpatialBorehole(hole)">{{ hole.id.slice(-2) }}</button>
            </div>
          </div>
          <div class="control-row sub">
            <label class="slice-control">
              <span>分析切面</span>
              <input v-model.number="slice" type="range" min="0" max="100" step="0.1" @input="pinAnalysisSlice" />
              <em>{{ analysisDepth.toFixed(1) }}cm</em>
            </label>
            <button
              class="follow-toggle"
              :class="{ active: !analysisPinned }"
              :title="analysisPinned ? '恢复演进并让分析面跟随当前钻进面' : '锁定当前分析面，钻进继续演进'"
              @click="toggleFollowCurrentSlice"
            >{{ analysisPinned ? '跟随当前' : '停止跟随' }}</button>
            <button
              class="rotate-toggle"
              :class="{ active: autoRotate }"
              :title="autoRotate ? '立即停止两张云图自动旋转' : '启动两张云图自动旋转'"
              @click="toggleAutoRotate"
            ><i>{{ autoRotate ? 'Ⅱ' : '↻' }}</i>{{ autoRotate ? '停止旋转' : '开始旋转' }}</button>
          </div>
        </div>
      </section>

      <aside class="side-column right-column">
        <!-- Panel 04: 模型反演精度 -->
        <section class="panel damage-panel">
          <PanelTitle code="04" title="模型反演精度" sub="MODEL ACCURACY" />
          <div class="damage-viz">
            <div class="accuracy-gauges">
              <div class="gauge-ring damage-gauge" :style="{ '--pct': activeModel?.damage_accuracy * 100 }">
                <span>{{ ((activeModel?.damage_accuracy || 0) * 100).toFixed(1) }}%</span>
                <small>损伤</small>
              </div>
              <div class="gauge-ring stress-gauge" :style="{ '--pct': activeModel?.stress_accuracy * 100 }">
                <span>{{ ((activeModel?.stress_accuracy || 0) * 100).toFixed(1) }}%</span>
                <small>应力</small>
              </div>
              <div class="gauge-ring state-gauge" :style="{ '--pct': activeModel?.macro_f1 * 100 }">
                <span>{{ ((activeModel?.macro_f1 || 0) * 100).toFixed(1) }}%</span>
                <small>宏F1</small>
              </div>
            </div>
          </div>
          <div class="zone-legend">
            <div><i class="plastic-color"></i><span>损伤准确率</span><strong>{{ ((activeModel?.damage_accuracy || 0) * 100).toFixed(1) }}%</strong></div>
            <div><i class="damage-color"></i><span>应力准确率</span><strong>{{ ((activeModel?.stress_accuracy || 0) * 100).toFixed(1) }}%</strong></div>
            <div><i class="elastic-color"></i><span>状态宏 F1</span><strong>{{ ((activeModel?.macro_f1 || 0) * 100).toFixed(1) }}%</strong></div>
          </div>
        </section>

        <!-- Panel 05: 模型对比 -->
        <section class="panel sensor-panel">
          <PanelTitle code="05" title="三模型性能对比" sub="MODEL COMPARISON" />
          <div class="sensor-head"><span>模型</span><span>损伤Acc</span><span>应力Acc</span><span>宏F1</span></div>
          <div class="sensor-item" v-for="m in store.models" :key="m.id"
            :class="{ active: store.selectedModel === m.id }"
            @click="store.selectedModel = m.id">
            <span><i :class="store.selectedModel === m.id ? 'active' : ''"></i>{{ m.name_en }}</span>
            <strong>{{ (m.damage_accuracy * 100).toFixed(1) }}%</strong>
            <em :class="m.stress_accuracy > 0.8 ? 'good' : 'normal'">{{ (m.stress_accuracy * 100).toFixed(1) }}%</em>
            <b>{{ (m.macro_f1 * 100).toFixed(1) }}%</b>
          </div>
        </section>

        <!-- Panel 06: 关键发现 -->
        <section class="panel warning-panel" :class="riskLevel.className">
          <div class="warning-signal"><span></span><i>!</i></div>
          <div class="warning-copy">
            <small>KEY FINDINGS</small>
            <strong>{{ currentFinding.title }}</strong>
            <p>{{ currentFinding.message }}</p>
          </div>
          <div class="risk-score"><strong>{{ findingIndex + 1 }}</strong><span>/ {{ findings.length }}</span></div>
        </section>
      </aside>
    </section>

    <footer class="evolution-footer">
      <div class="evolution-title">
        <button class="play-button" :class="{ paused: !playing }" :title="playing ? '暂停并锁定当前分析面' : '继续自动演进'" @click="togglePlay">
          <span>{{ playing ? 'Ⅱ' : '▶' }}</span>
          <em>{{ playing ? '暂停分析' : '继续演进' }}</em>
        </button>
        <div>
          <strong>钻进时空演进</strong>
          <small>SPATIOTEMPORAL EVOLUTION</small>
        </div>
      </div>
      <div class="timeline-wrap">
        <div class="timeline-labels">
          <span>D80</span><span>D60</span><span>D40</span><span>D20</span><span>D0</span>
        </div>
        <input v-model.number="evolutionProgress" class="evolution-range" type="range" min="0" max="100" step="0.05"
          @input="onProgressInput" />
        <div class="timeline-points">
          <i v-for="n in 5" :key="n" :class="{ passed: evolutionProgress >= (n - 1) * 25 }"></i>
        </div>
        <div class="timeline-sub">
          <span>当前演进 {{ liveDepth.toFixed(2) }} cm · 分析面 {{ analysisDepth.toFixed(1) }} cm</span>
          <span class="speed-control">
            速度
            <button v-for="s in speedOptions" :key="s.val" :class="{ active: evolutionSpeed === s.val }"
              @click="evolutionSpeed = s.val">{{ s.label }}</button>
          </span>
          <span>损伤 {{ currentDamageLabel }}</span>
        </div>
      </div>
      <div class="progress-readout">
        <span>径向钻进深度</span>
        <strong>{{ liveDepth.toFixed(1) }}<em>cm</em></strong>
        <small>样本 #{{ currentSample?.sample ?? '--' }} · {{ currentPrediction?.state || '--' }}</small>
      </div>
      <div class="data-provenance">SOURCE · {{ store.ringCloud?.meta.sources?.join(' + ') || 'LOADING' }} · {{ store.ringCloud?.meta.fittingMethod || '' }}</div>
    </footer>

    <Transition name="import-modal">
      <div v-if="importModalOpen" class="import-modal-backdrop" @mousedown.self="closeImportModal">
        <section class="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
          <i class="dialog-corner tl"></i><i class="dialog-corner tr"></i><i class="dialog-corner bl"></i><i class="dialog-corner br"></i>
          <header class="import-dialog-header">
            <div class="dialog-index"><span>07</span><small>DATA ACCESS</small></div>
            <div>
              <p>DATA INGESTION CONSOLE</p>
              <h2 id="import-dialog-title">导入实验数据</h2>
            </div>
            <div class="dialog-status"><i></i><span>本地安全模式<small>LOCAL SANDBOX</small></span></div>
            <button class="dialog-close" type="button" aria-label="关闭导入数据弹窗" @click="closeImportModal">×</button>
          </header>

          <div class="import-steps" :class="{ processing: importStatus === 'processing', success: importStatus === 'success' }">
            <div class="active"><span>01</span><p>选择数据源<small>SELECT SOURCE</small></p></div>
            <i></i>
            <div :class="{ active: selectedImportFile }"><span>02</span><p>字段配置<small>FIELD MAPPING</small></p></div>
            <i></i>
            <div :class="{ active: importStatus !== 'idle' }"><span>03</span><p>校验接入<small>VALIDATE</small></p></div>
          </div>

          <div class="import-dialog-body">
            <div class="import-source-column">
              <div
                class="file-drop-zone"
                :class="{ dragging: isDraggingFile, filled: selectedImportFile }"
                @click="fileInput?.click()"
                @dragover.prevent="isDraggingFile = true"
                @dragleave.prevent="isDraggingFile = false"
                @drop.prevent="handleFileDrop"
              >
                <input ref="fileInput" type="file" accept=".csv,.xlsx,.json" @change="handleFileChange" />
                <div class="drop-visual">
                  <svg viewBox="0 0 48 48"><path d="M14 39h22a8 8 0 0 0 1-15.9A13 13 0 0 0 12.4 19 10 10 0 0 0 14 39Z"/><path d="M24 31V17m0 0-6 6m6-6 6 6"/></svg>
                  <i></i><i></i><i></i>
                </div>
                <template v-if="!selectedImportFile">
                  <strong>拖拽数据文件至此处</strong>
                  <p>或点击浏览本地文件</p>
                  <button type="button" tabindex="-1">选择数据文件</button>
                </template>
                <template v-else>
                  <strong>{{ selectedImportFile.name }}</strong>
                  <p>{{ selectedImportFile.size }} · 等待接入</p>
                  <button type="button" tabindex="-1">更换文件</button>
                </template>
              </div>
              <div class="format-support">
                <span>支持格式</span>
                <b>CSV</b><b>XLSX</b><b>JSON</b>
                <em>单文件 ≤ 50 MB</em>
              </div>
              <button v-if="!selectedImportFile" class="demo-file-button" type="button" @click="useDemoFile">
                <span>◎</span><p>载入示例数据<small>VTEST_S60 · 12,480 RECORDS</small></p><em>→</em>
              </button>
              <div v-else class="file-validation-card">
                <span class="validation-icon">✓</span>
                <p><strong>文件格式校验通过</strong><small>检测到 12,480 条记录 · 9 个字段</small></p>
                <em>READY</em>
              </div>
            </div>

            <div class="import-config-column">
              <div class="config-heading"><span>接入配置</span><small>INGESTION SETTINGS</small></div>
              <label class="config-field">
                <span>数据类型<small>DATA TYPE</small></span>
                <select v-model="importConfig.dataType"><option>随钻时序数据</option><option>模型预测结果</option><option>钻孔空间信息</option></select>
              </label>
              <label class="config-field">
                <span>目标数据集<small>TARGET DATASET</small></span>
                <select v-model="importConfig.dataset"><option>Vtest4 感知数据</option><option>新建实验数据集</option></select>
              </label>
              <div class="field-mapping">
                <div class="mapping-head"><span>字段映射预览</span><small>AUTO MATCHED</small></div>
                <div><code>depth_cm</code><i>→</i><span>钻进深度</span><em>cm</em></div>
                <div><code>torque_nm</code><i>→</i><span>钻进扭矩</span><em>N·m</em></div>
                <div><code>stress_mpa</code><i>→</i><span>孔内应力</span><em>MPa</em></div>
                <button type="button">查看全部 9 个字段 <span>↗</span></button>
              </div>
              <label class="switch-setting">
                <span><strong>首行作为字段名称</strong><small>自动识别 CSV / XLSX 表头</small></span>
                <input v-model="importConfig.useHeader" type="checkbox" /><i></i>
              </label>
            </div>
          </div>

          <div v-if="importStatus !== 'idle'" class="import-progress" :class="importStatus">
            <div><span>{{ importStatus === 'success' ? '数据预检完成' : importStage }}</span><strong>{{ importProgress }}%</strong></div>
            <i><b :style="{ width: `${importProgress}%` }"></b></i>
            <p>{{ importStatus === 'success' ? '演示导入已完成，当前看板数据保持不变' : '正在构建数据索引与字段映射，请稍候…' }}</p>
          </div>

          <footer class="import-dialog-footer">
            <div class="demo-notice"><span>i</span><p>当前为功能展示模式<small>不会覆盖或写入现有数据</small></p></div>
            <button class="cancel-import" type="button" @click="closeImportModal">取消</button>
            <button class="confirm-import" type="button" :disabled="!selectedImportFile || importStatus === 'processing'" @click="simulateImport">
              <span v-if="importStatus === 'processing'" class="button-spinner"></span>
              <span v-else-if="importStatus === 'success'">✓</span>
              <span v-else>↥</span>
              {{ importStatus === 'processing' ? '正在接入' : importStatus === 'success' ? '预检完成' : '开始导入' }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </main>
</template>

<script setup>
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue'
import RockCloud3D from '@/components/RockCloud3D.vue'
import { useDrillingStore } from '@/stores/drillingData.js'

const PanelTitle = defineComponent({
  props: ['code', 'title', 'sub'],
  setup(props) {
    return () => h('div', { class: 'panel-title' }, [
      h('span', props.code),
      h('div', [h('strong', props.title), h('small', props.sub)]),
      h('i')
    ])
  }
})

const store = useDrillingStore()

// ---- view state ----
const slice = ref(0)
const analysisPinned = ref(false)
const autoRotate = ref(true)
const viewMode = ref('cloud')
const selectedSectionId = ref('B')
const now = ref(new Date())
const cloudSample = ref({ borehole: null, sample: null })
const findingIndex = ref(0)
const findingTimer = ref(null)

// ---- import data showcase ----
const importModalOpen = ref(false)
const fileInput = ref(null)
const selectedImportFile = ref(null)
const isDraggingFile = ref(false)
const importStatus = ref('idle')
const importProgress = ref(0)
const importStage = ref('正在校验数据结构')
const importTimer = ref(null)
const importConfig = ref({
  dataType: '随钻时序数据',
  dataset: 'Vtest4 感知数据',
  useHeader: true
})

function openImportModal() {
  importModalOpen.value = true
}

function closeImportModal() {
  if (importStatus.value === 'processing') return
  importModalOpen.value = false
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function selectImportFile(file) {
  if (!file) return
  selectedImportFile.value = { name: file.name, size: formatFileSize(file.size) }
  importStatus.value = 'idle'
  importProgress.value = 0
}

function handleFileChange(event) {
  selectImportFile(event.target.files?.[0])
  event.target.value = ''
}

function handleFileDrop(event) {
  isDraggingFile.value = false
  selectImportFile(event.dataTransfer?.files?.[0])
}

function useDemoFile() {
  selectedImportFile.value = { name: 'VTEST_S60_drilling.csv', size: '1.8 MB' }
  importStatus.value = 'idle'
  importProgress.value = 0
}

function stopImportSimulation() {
  if (importTimer.value) {
    window.clearInterval(importTimer.value)
    importTimer.value = null
  }
}

function simulateImport() {
  if (!selectedImportFile.value || importStatus.value === 'processing') return
  stopImportSimulation()
  importStatus.value = 'processing'
  importProgress.value = 6
  importStage.value = '正在校验数据结构'
  importTimer.value = window.setInterval(() => {
    const next = Math.min(100, importProgress.value + Math.ceil(Math.random() * 8))
    importProgress.value = next
    if (next >= 72) importStage.value = '正在构建字段映射'
    else if (next >= 38) importStage.value = '正在扫描数据记录'
    if (next >= 100) {
      stopImportSimulation()
      importStatus.value = 'success'
    }
  }, 160)
}

function handleImportKeydown(event) {
  if (event.key === 'Escape' && importModalOpen.value) closeImportModal()
}

// ---- evolution state ----
const evolutionProgress = ref(0)
const playing = ref(true)
const evolutionSpeed = ref(2) // 1=慢, 2=中, 3=快
const speedOptions = [
  { val: 1, label: '0.5x' },
  { val: 2, label: '1x' },
  { val: 3, label: '2x' }
]

// Auto-advance evolution
const evolutionTimer = ref(null)

function startEvolution() {
  stopEvolution()
  evolutionTimer.value = window.setInterval(() => {
    if (!playing.value) return
    const step = 0.08 * evolutionSpeed.value
    evolutionProgress.value = evolutionProgress.value >= 100 ? 0 : Number((evolutionProgress.value + step).toFixed(2))
    if (!analysisPinned.value) slice.value = evolutionProgress.value
  }, 80)
}

function stopEvolution() {
  if (evolutionTimer.value) {
    window.clearInterval(evolutionTimer.value)
    evolutionTimer.value = null
  }
}

function togglePlay() {
  if (playing.value) {
    playing.value = false
    analysisPinned.value = true
    slice.value = evolutionProgress.value
    return
  }
  playing.value = true
  analysisPinned.value = false
  slice.value = evolutionProgress.value
}

function onProgressInput() {
  playing.value = false
  analysisPinned.value = true
  slice.value = evolutionProgress.value
}

function pinAnalysisSlice() {
  playing.value = false
  analysisPinned.value = true
}

function selectAnalysisSlice(value) {
  playing.value = false
  slice.value = Number(value.toFixed(2))
  analysisPinned.value = true
}

function toggleFollowCurrentSlice() {
  if (!analysisPinned.value) {
    analysisPinned.value = true
    slice.value = evolutionProgress.value
    return
  }
  playing.value = true
  analysisPinned.value = false
  slice.value = evolutionProgress.value
}

function toggleAutoRotate() {
  autoRotate.value = !autoRotate.value
}

const telemetrySeries = computed(() => store.currentTelemetrySeries)
const telemetryIndex = computed(() => {
  const lastIndex = Math.max(telemetrySeries.value.length - 1, 0)
  return Math.min(Math.round((slice.value / 100) * lastIndex), lastIndex)
})
const currentSample = computed(() => telemetrySeries.value[telemetryIndex.value] || null)
const currentPrediction = computed(() => currentSample.value?.predictions?.[store.selectedModel] || null)
const analysisDepth = computed(() => Number(currentSample.value?.depth || slice.value / 100 * 125))
const liveDepth = computed(() => evolutionProgress.value / 100 * Number(store.ringCloud?.meta?.depthRangeCm?.[1] || 125))
const currentDamageLabel = computed(() => `D${currentSample.value?.actualDamage ?? '--'}`)

const stressMetric = { label: '反演应力', unit: 'MPa', ticks: ['40', '32', '24', '16', '8', '0'] }
const damageMetric = { label: '反演损伤', unit: '%', ticks: ['80', '64', '48', '32', '16', '0'] }

const views = [
  { key: 'cloud', label: '三维围岩', icon: '▱' },
  { key: 'section', label: '分析切面', icon: '◫' },
  { key: 'iso', label: '场点分布', icon: '∴' }
]

// ---- computed from store ----
const activeModel = computed(() => store.activeModel)
const activeModelName = computed(() => activeModel.value?.name_en || '--')
const spatialGroups = computed(() => (store.spatialRoadway?.groups || []).slice().sort((a, b) => a.longitudinalM - b.longitudinalM))
const selectedSpatialGroup = computed(() => spatialGroups.value.find(group => group.id === selectedSectionId.value) || spatialGroups.value[0] || null)
const selectedGroupBoreholes = computed(() => selectedSpatialGroup.value?.boreholes || [])
const selectedHoleNumber = computed(() => Number(store.selectedBoreholeId?.match(/(\d+)$/)?.[1] || 1))
const selectedSpatialBorehole = computed(() => (
  selectedGroupBoreholes.value.find(hole => Number(hole.id.match(/(\d+)$/)?.[1]) === selectedHoleNumber.value)
  || selectedGroupBoreholes.value[0]
  || null
))
const currentSpatialSample = computed(() => {
  const samples = selectedSpatialBorehole.value?.samples || []
  if (!samples.length) return null
  const index = Math.min(Math.round((slice.value / 100) * (samples.length - 1)), samples.length - 1)
  return samples[index]
})
const reliefInfo = computed(() => store.ringCloud?.meta?.reliefModel || { available: false })
const telemetrySampleCount = computed(() => Number(store.ringCloud?.meta?.rawRows || 0))

function formatValue(value, digits = 1) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : '--'
}

function formatSigned(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '--'
  return number > 0 ? `+${number.toFixed(0)}` : number.toFixed(0)
}

function selectSectionGroup(groupId) {
  selectedSectionId.value = groupId
}

function selectSpatialBorehole(hole) {
  const number = Number(hole?.id?.match(/(\d+)$/)?.[1] || 1)
  store.selectedBoreholeId = `BH-${String(number).padStart(2, '0')}`
}

// cloudProgress: evolutionProgress directly drives the 3D scene drilling face
const cloudProgress = computed(() => evolutionProgress.value)

// ---- drilling KPIs ----
const drillingKpis = computed(() => {
  const sample = currentSample.value
  if (!sample) return [
    { icon: 'τ', label: '钻进扭矩', sub: 'TORQUE', value: '--', unit: 'N·m', level: 5, tone: 'cyan' },
    { icon: 'F', label: '钻进推力', sub: 'THRUST', value: '--', unit: 'kN', level: 4, tone: 'blue' },
    { icon: 'σ', label: '孔内应力', sub: 'STRESS', value: '--', unit: 'MPa', level: 4, tone: 'orange' }
  ]
  return [
    { icon: 'τ', label: '当前扭矩', sub: 'TORQUE / RAW', value: formatValue(sample.torque, 1), unit: 'N·m', level: Math.max(1, Math.min(8, Math.ceil(sample.torque / 15))), tone: 'cyan' },
    { icon: 'F', label: '当前推力', sub: 'THRUST / RAW', value: formatValue(sample.thrust, 2), unit: 'kN', level: Math.max(1, Math.min(8, Math.ceil(sample.thrust * 1.6))), tone: 'blue' },
    { icon: 'σ', label: '实测围压', sub: 'GROUND TRUTH', value: sample.actualStress, unit: 'MPa', level: Math.max(1, Math.ceil(sample.actualStress / 5)), tone: sample.actualStress > 25 ? 'orange' : 'cyan' }
  ]
})

const trendValues = computed(() => {
  return telemetrySeries.value.map(row => Number(row.torque))
})

const trendCoordinates = computed(() => {
  const values = trendValues.value
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 1)
  return values.map((value, index) => ({
    x: index / (values.length - 1) * 280,
    y: 94 - ((value - min) / span) * 82
  }))
})

const trendPoints = computed(() => trendCoordinates.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const trendArea = computed(() => `0,98 ${trendPoints.value} 280,98`)
const trendCurrent = computed(() => trendCoordinates.value[telemetryIndex.value] || null)

// ---- risk / findings ----
const findings = computed(() => {
  if (!store.ringCloud) return ['加载 Vtest4 环形钻孔数据中...']
  return [
    'A / B / C 三组共 33 个钻孔沿巷道纵向布置，相邻钻孔按 20–25° 扇形左右交错钻入围岩',
    `拟合采用 ${store.ringCloud.meta.fittingMethod}，曲线平均粗糙度降低 ${(store.ringCloud.meta.meanRoughnessReduction * 100).toFixed(1)}%`,
    '钻孔从拱形巷道表面向半透明围岩实体内部延伸，径向范围为 0–125 cm',
    '应力场和损伤场采用相同的三维围岩坐标，可直接进行空间位置对照',
    '卸压前后模型与参数决策已在卸压决策页面独立接入'
  ]
})

const currentFinding = computed(() => {
  const list = findings.value
  return {
    title: `发现 ${findingIndex.value + 1}`,
    message: list[findingIndex.value] || list[0]
  }
})

const riskLevel = computed(() => {
  const acc = activeModel.value?.damage_accuracy || 0
  if (acc >= 0.72) return { className: 'stable', title: '高精度', message: '模型损伤识别准确率超过72%' }
  if (acc >= 0.69) return { className: 'attention', title: '中等精度', message: '模型损伤识别准确率接近70%' }
  return { className: 'danger', title: '待提升', message: '模型在低应力条件下精度较高' }
})

function cycleFinding() {
  findingIndex.value = (findingIndex.value + 1) % findings.value.length
}

// ---- clock ----
const clockTime = computed(() => now.value.toLocaleTimeString('zh-CN', { hour12: false }))
const clockDate = computed(() => now.value.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '.'))

const clockTimer = window.setInterval(() => { now.value = new Date() }, 1000)

onMounted(async () => {
  window.addEventListener('keydown', handleImportKeydown)
  await store.loadAll()
  startEvolution()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleImportKeydown)
  window.clearInterval(clockTimer)
  stopEvolution()
  stopImportSimulation()
  if (findingTimer.value) window.clearInterval(findingTimer.value)
})
</script>

<style scoped lang="scss">
.digital-twin-screen {
  --cyan: #37d9ff;
  --cyan-soft: #7ee8ff;
  --blue: #1677ff;
  --panel: rgba(6, 20, 39, .76);
  --line: rgba(75, 184, 229, .24);
  position: relative;
  width: 100vw;
  height: 100vh;
  min-width: 1180px;
  min-height: 680px;
  overflow: hidden;
  color: #d9f5ff;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  background:
    radial-gradient(circle at 50% 38%, rgba(13, 76, 112, .2), transparent 38%),
    linear-gradient(145deg, #020813, #041321 52%, #020914);
}

.digital-twin-screen::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: .22;
  pointer-events: none;
  background-image: linear-gradient(rgba(82, 181, 229, .07) 1px, transparent 1px), linear-gradient(90deg, rgba(82, 181, 229, .07) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(to bottom, black, transparent 82%);
}

.digital-twin-screen::after {
  content: '';
  position: absolute;
  z-index: 0;
  left: 0;
  right: 0;
  bottom: 70px;
  height: 46%;
  pointer-events: none;
  opacity: .18;
  background: url('../../assets/images/bg4.png') center bottom / 100% 100% no-repeat;
  mix-blend-mode: screen;
}

.ambient-grid {
  position: absolute;
  z-index: 0;
  left: 22%;
  top: 20%;
  width: 56%;
  height: 48%;
  border-radius: 50%;
  background: rgba(14, 125, 190, .08);
  filter: blur(60px);
  animation: ambientPulse 5s ease-in-out infinite;
}

@keyframes ambientPulse { 50% { opacity: .52; transform: scale(1.08); } }

.top-header {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr 2.2fr 1fr;
  align-items: center;
  height: 74px;
  padding: 0 24px;
  background: linear-gradient(180deg, rgba(3, 15, 29, .98), rgba(3, 15, 29, .78) 74%, transparent);
  border-bottom: 1px solid rgba(74, 188, 236, .18);
}

.system-brand { display: flex; align-items: center; gap: 11px; }
.brand-mark { position: relative; width: 38px; height: 36px; transform: skew(-11deg); }
.brand-mark span { position: absolute; width: 20px; height: 8px; border: 2px solid var(--cyan); box-shadow: 0 0 9px rgba(55, 217, 255, .55); }
.brand-mark span:nth-child(1) { left: 0; top: 2px; }
.brand-mark span:nth-child(2) { left: 9px; top: 13px; }
.brand-mark span:nth-child(3) { left: 18px; top: 24px; }
.system-brand strong { display: block; color: #ecfbff; font: 700 18px/1 Electronic, monospace; letter-spacing: 4px; }
.system-brand small { color: #59839d; font-size: 8px; letter-spacing: 1.4px; }

.title-block { align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.title-block p { display: flex; align-items: center; gap: 8px; margin: 0 0 1px; color: #4d91af; font-size: 8px; letter-spacing: 3.5px; }
.title-block p i { width: 28px; height: 1px; background: linear-gradient(90deg, transparent, #2eaed8); }
.title-block p i:last-child { transform: rotate(180deg); }
.title-block h1 { margin: 0; font-size: clamp(20px, 1.55vw, 29px); font-weight: 600; letter-spacing: 6px; text-shadow: 0 0 18px rgba(85, 219, 255, .36); }
.title-rule { position: absolute; bottom: -7px; width: 58%; height: 15px; opacity: .55; background: url('../../assets/images/bar2.png') center / 100% 100% no-repeat; }
.title-rule span { display: block; width: 86px; height: 2px; margin: 1px auto 0; background: #6ae9ff; box-shadow: 0 0 12px #28c9ff; }

.system-state { display: flex; align-items: center; justify-content: flex-end; gap: 20px; }
.clock { padding-right: 18px; text-align: right; border-right: 1px solid rgba(87, 160, 194, .25); }
.clock strong { display: block; font: 18px/1 Electronic, monospace; letter-spacing: 2px; color: #dff9ff; }
.clock small { display: block; margin-top: 5px; color: #587b91; font-size: 9px; letter-spacing: 1px; }
.online { display: flex; align-items: center; gap: 8px; color: #bfefff; font-size: 10px; line-height: 1.25; }
.online i { width: 9px; height: 9px; border-radius: 50%; background: #48e89b; box-shadow: 0 0 0 5px rgba(72, 232, 155, .1), 0 0 12px #48e89b; animation: statusPulse 1.6s ease-in-out infinite; }
.online small { color: #4e7b8d; font-size: 7px; letter-spacing: 1px; }
@keyframes statusPulse { 50% { box-shadow: 0 0 0 8px rgba(72, 232, 155, 0), 0 0 16px #48e89b; } }

.dashboard-body {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(270px, 19.5vw) minmax(0, 1fr) minmax(270px, 19.5vw);
  gap: 12px;
  height: calc(100vh - 164px);
  min-height: 516px;
  padding: 8px 15px 5px;
}

.side-column { display: flex; flex-direction: column; gap: 9px; min-height: 0; }
.panel {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(8, 27, 49, .88), rgba(4, 17, 33, .72));
  border: 1px solid var(--line);
  box-shadow: inset 0 0 26px rgba(13, 94, 141, .08), 0 8px 28px rgba(0, 0, 0, .16);
  backdrop-filter: blur(10px);
}
.panel::before, .panel::after { content: ''; position: absolute; width: 18px; height: 1px; background: #3fdcff; top: -1px; }
.panel::before { left: 0; }.panel::after { right: 0; }
.panel-title { display: flex; align-items: center; height: 40px; padding: 0 12px; background: linear-gradient(90deg, rgba(24, 108, 153, .19), transparent); border-bottom: 1px solid rgba(67, 162, 207, .12); }
.panel-title > span { display: grid; place-items: center; width: 24px; height: 24px; margin-right: 8px; color: #64ddff; font: 10px Electronic, monospace; background: rgba(35, 164, 215, .1); border: 1px solid rgba(70, 203, 246, .38); transform: skew(-8deg); }
.panel-title div { display: flex; align-items: baseline; gap: 8px; }
.panel-title strong { font-size: 13px; letter-spacing: 1.5px; font-weight: 600; }
.panel-title small { color: #426d85; font-size: 7px; letter-spacing: 1.2px; }
.panel-title > i { flex: 1; height: 1px; margin-left: 10px; background: linear-gradient(90deg, rgba(51, 191, 235, .38), transparent); }

.overview-panel { flex: .86; }
.project-name { display: flex; align-items: center; gap: 9px; margin: 10px 12px 8px; }
.project-icon { display: grid; place-items: center; width: 35px; height: 35px; color: #55ddff; font-size: 14px; border: 1px solid rgba(76, 204, 241, .32); background: rgba(31, 153, 201, .1); }
.project-name div { flex: 1; min-width: 0; }
.project-name strong { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; font-weight: 500; color: #def7ff; }
.project-name small { color: #4e7d94; font-size: 9px; }
.project-name em { color: #ffb938; font-size: 10px; font-style: normal; padding: 3px 6px; background: rgba(255, 174, 36, .1); border: 1px solid rgba(255, 185, 56, .25); }
.overview-grid { display: grid; grid-template-columns: 1fr 1fr; margin: 0 12px 10px; border-top: 1px solid rgba(78, 152, 185, .12); border-left: 1px solid rgba(78, 152, 185, .12); }
.overview-grid div { padding: 6px 8px; border-right: 1px solid rgba(78, 152, 185, .12); border-bottom: 1px solid rgba(78, 152, 185, .12); }
.overview-grid span { display: block; color: #628ba0; font-size: 9px; }
.overview-grid strong { color: #dff8ff; font: 16px/1.2 Electronic, monospace; }
.overview-grid strong small { display: inline; color: #648ba0; font: 8px sans-serif; }
.relief-status { display: grid; grid-template-columns: 7px auto 1fr; align-items: center; gap: 5px; margin: -3px 12px 8px; padding: 5px 7px; color: #6f91a1; font-size: 7px; background: rgba(15, 38, 54, .32); border: 1px dashed rgba(103, 153, 177, .2); }
.relief-status i { width: 6px; height: 6px; border-radius: 50%; background: #6f8190; }
.relief-status strong { justify-self: end; color: #91a7b1; font-size: 8px; font-weight: 500; }
.relief-status small { grid-column: 2 / 4; color: #4d7183; font-size: 6px; }
.relief-status.available i { background: #47dda0; box-shadow: 0 0 6px #47dda0; }
.relief-status.available strong { color: #50dfa5; }

.load-panel { flex: 1.05; }
.load-kpis { padding: 5px 12px 7px; }
.load-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(69, 143, 175, .1); }
.load-row:last-child { border-bottom: 0; }
.kpi-icon { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 30px; font-size: 13px; color: #6be6ff; background: rgba(37, 184, 229, .1); border-left: 2px solid #39d4f8; }
.kpi-icon.blue { color: #70a7ff; border-color: #377fff; background: rgba(50, 112, 255, .1); }
.kpi-icon.orange { color: #ffc15b; border-color: #ff9c27; background: rgba(255, 155, 36, .1); }
.kpi-data { flex: 1; min-width: 0; }
.kpi-data > span { display: block; color: #799db0; font-size: 9px; }
.kpi-data > span small { margin-left: 4px; color: #375d73; font-size: 6px; }
.kpi-data strong { color: #e8fbff; font: 16px Electronic, monospace; }
.kpi-data strong em { margin-left: 3px; color: #527c90; font: 8px sans-serif; font-style: normal; }
.mini-bars { display: flex; align-items: flex-end; gap: 2px; width: 45px; height: 20px; }
.mini-bars i { width: 3px; height: 5px; background: rgba(67, 170, 204, .15); }
.mini-bars i:nth-child(2n) { height: 9px; }.mini-bars i:nth-child(3n) { height: 13px; }.mini-bars i:nth-child(4n) { height: 17px; }
.mini-bars i.on { background: #2dcff5; box-shadow: 0 0 4px rgba(45, 207, 245, .65); }

.trend-panel { flex: 1.02; }
.chart-head { display: flex; justify-content: space-between; padding: 7px 13px 0; color: #567f94; font-size: 8px; }
.chart-head strong { color: #ffb839; font-weight: 400; }
.trend-chart { display: block; width: calc(100% - 24px); height: calc(100% - 78px); min-height: 72px; margin: 0 12px; overflow: visible; }
.chart-grid line { stroke: rgba(80, 156, 189, .14); stroke-width: .7; stroke-dasharray: 3 3; }
.cursor-line { stroke: rgba(255, 181, 54, .65); stroke-width: .8; stroke-dasharray: 3 3; }
.chart-axis { display: flex; justify-content: space-between; margin: -2px 12px 0; color: #41677b; font-size: 7px; }

.center-stage { min-width: 0; display: flex; flex-direction: column; }
.scene-heading { display: flex; align-items: center; justify-content: space-between; height: 39px; padding: 0 8px 0 12px; background: linear-gradient(90deg, rgba(12, 46, 70, .5), rgba(4, 18, 34, .18), rgba(12, 46, 70, .5)); border: 1px solid rgba(67, 172, 217, .19); }
.scene-heading > div { display: flex; align-items: center; gap: 8px; }
.live-dot { width: 6px; height: 6px; background: #4ff0a7; border-radius: 50%; box-shadow: 0 0 9px #4ff0a7; }
.scene-heading p { margin: 0; font-size: 11px; letter-spacing: 1px; }
.scene-heading p small { margin-left: 6px; color: #3f7088; font-size: 7px; letter-spacing: 1px; }
.metric-tabs { display: flex; gap: 3px; }
.metric-tabs button { appearance: none; padding: 5px 12px; color: #5e8ba0; font-size: 9px; background: rgba(12, 37, 58, .65); border: 1px solid rgba(68, 151, 188, .16); cursor: pointer; transition: .2s ease; }
.metric-tabs button:hover, .metric-tabs button.active { color: #e5faff; border-color: rgba(69, 213, 250, .55); background: rgba(28, 150, 194, .2); box-shadow: inset 0 -2px #38d8ff; }
.scene-frame { position: relative; flex: 1; min-height: 0; overflow: hidden; background: radial-gradient(circle at 50% 50%, rgba(14, 70, 105, .12), rgba(2, 9, 19, .52)); border-left: 1px solid rgba(64, 166, 210, .18); border-right: 1px solid rgba(64, 166, 210, .18); }
.scene-frame .corner { position: absolute; z-index: 5; width: 23px; height: 23px; pointer-events: none; }
.corner.tl { top: 8px; left: 8px; border-top: 2px solid #50dbff; border-left: 2px solid #50dbff; }.corner.tr { top: 8px; right: 8px; border-top: 2px solid #50dbff; border-right: 2px solid #50dbff; }.corner.bl { bottom: 8px; left: 8px; border-bottom: 2px solid #50dbff; border-left: 2px solid #50dbff; }.corner.br { bottom: 8px; right: 8px; border-bottom: 2px solid #50dbff; border-right: 2px solid #50dbff; }
.model-tag { position: absolute; z-index: 5; display: flex; align-items: center; gap: 5px; padding: 4px 7px; color: #7ba6ba; font-size: 8px; pointer-events: none; background: rgba(4, 20, 36, .72); border: 1px solid rgba(73, 176, 216, .22); }
.model-tag span { color: #f2fbff; font: 10px Electronic, monospace; }.model-tag i { width: 16px; height: 1px; background: #51d9ff; }
.tag-load { left: 47%; top: 9%; }.tag-face { left: 19%; top: 61%; }.tag-sensor { right: 20%; top: 27%; }
.tag-face span { color: #ffb42c; }.tag-face i { background: #ff9e25; }
.cloud-legend { position: absolute; z-index: 5; right: 18px; top: 20%; display: grid; grid-template-columns: 45px 10px 24px; gap: 6px; height: 190px; padding: 10px 8px; background: rgba(3, 17, 31, .6); border: 1px solid rgba(66, 166, 207, .18); pointer-events: none; }
.legend-title { writing-mode: vertical-rl; display: flex; align-items: center; gap: 5px; color: #aac9d7; font-size: 8px; letter-spacing: 2px; }
.legend-title small { color: #54778a; font-size: 7px; }
.legend-scale { border: 1px solid rgba(255,255,255,.18); background: linear-gradient(to bottom, #f12622, #ff9d18 20%, #d8e72a 38%, #29d16d 56%, #04cfd0 70%, #087ef5 84%, #1037e6); box-shadow: 0 0 10px rgba(26, 157, 255, .24); }
.legend-scale.damage-scale { background: linear-gradient(to bottom, #1037e6, #087ef5 20%, #04cfd0 38%, #29d16d 56%, #d8e72a 70%, #ff9d18 84%, #f12622); }
.legend-labels { display: flex; flex-direction: column; justify-content: space-between; color: #89aab9; font: 8px Electronic, monospace; }
.scene-data-strip { position: absolute; z-index: 5; left: 50%; bottom: 12px; display: flex; transform: translateX(-50%); background: rgba(3, 15, 28, .76); border: 1px solid rgba(65, 164, 205, .18); pointer-events: none; }
.scene-data-strip div { min-width: 82px; padding: 5px 9px; border-right: 1px solid rgba(65, 164, 205, .14); }.scene-data-strip div:last-child { border: 0; }
.scene-data-strip span { display: block; color: #4f7689; font-size: 7px; }.scene-data-strip strong { color: #aeeaff; font: 10px Electronic, monospace; }
.axis-widget { position: absolute; z-index: 5; left: 18px; bottom: 18px; width: 52px; height: 52px; pointer-events: none; }
.axis-widget i, .axis-widget::before, .axis-widget::after { content: ''; position: absolute; left: 25px; bottom: 18px; width: 27px; height: 1px; transform-origin: left; background: #ff3b38; }
.axis-widget::before { background: #38ef89; transform: rotate(-90deg); }.axis-widget::after { background: #3e78ff; transform: rotate(-145deg); }
.axis-widget b { position: absolute; font-size: 8px; }.axis-x { right: -2px; bottom: 13px; color: #ff625f; }.axis-y { left: 20px; top: 1px; color: #48ef98; }.axis-z { left: -1px; bottom: 31px; color: #5f8fff; }
.scene-controls { display: flex; flex-direction: column; gap: 0; border: 1px solid rgba(65, 164, 205, .2); background: rgba(4, 19, 35, .8); }
.control-row { display: flex; align-items: center; gap: 8px; padding: 3px 8px; }
.control-row.sub { padding-top: 0; padding-bottom: 4px; border-top: 1px solid rgba(65, 164, 205, .1); }
.view-switch { display: flex; gap: 3px; }
.view-switch button { height: 27px; padding: 0 8px; color: #557f94; font-size: 8px; border: 1px solid rgba(70, 156, 192, .15); background: rgba(20, 58, 81, .24); cursor: pointer; }
.view-switch button span { margin-right: 4px; font-size: 10px; }
.view-switch button.active { color: #bcf3ff; border-color: rgba(62, 206, 244, .44); background: rgba(26, 142, 182, .2); }
.model-select-inline { display: flex; gap: 2px; border-left: 1px solid rgba(65, 164, 205, .15); padding-left: 8px; }
.model-select-inline button { height: 25px; padding: 0 6px; color: #557f94; font: 8px Electronic, monospace; border: 1px solid rgba(70, 156, 192, .12); background: rgba(20, 58, 81, .2); cursor: pointer; }
.model-select-inline button.active { color: #42d9ff; border-color: #38d8ff; background: rgba(26, 142, 182, .22); }
.section-group-select { display: flex; flex: 1; justify-content: flex-end; gap: 3px; min-width: 0; padding-left: 8px; border-left: 1px solid rgba(65, 164, 205, .15); }
.section-group-select button { display: grid; grid-template-columns: auto auto; align-items: center; gap: 6px; min-width: 66px; height: 27px; padding: 0 8px; color: #627f89; font-family: inherit; background: rgba(20, 58, 81, .2); border: 1px solid rgba(70, 156, 192, .12); cursor: pointer; }
.section-group-select b { color: #9bb1b7; font: 10px Electronic, monospace; }
.section-group-select span { font-size: 7px; }
.section-group-select button.active { color: #edcf83; border-color: rgba(227, 184, 90, .58); background: rgba(227, 184, 90, .09); box-shadow: inset 0 -1px #e3b85a; }
.section-group-select button.active b { color: #f2da9b; }
.borehole-row { border-top: 1px solid rgba(65, 164, 205, .1); }
.active-group-summary { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; min-width: 114px; height: 25px; padding: 0 8px; color: #687f88; background: rgba(83, 117, 127, .055); border-left: 2px solid #e3b85a; }
.active-group-summary b { color: #edcf83; font: 9px Electronic, monospace; }
.active-group-summary span, .active-group-summary em { font-size: 7px; font-style: normal; }
.active-group-summary em { color: #87a0a9; }
.borehole-select-inline { display: flex; flex: 1; gap: 2px; min-width: 0; padding-left: 8px; border-left: 1px solid rgba(65, 164, 205, .15); overflow: hidden; }
.borehole-select-inline button { flex: 1 1 0; min-width: 22px; height: 25px; padding: 0 2px; color: #557f94; font: 7px Electronic, monospace; border: 1px solid rgba(70, 156, 192, .12); background: rgba(20, 58, 81, .2); cursor: pointer; }
.borehole-select-inline button:hover, .borehole-select-inline button.active { color: #dff9ff; border-color: #38d8ff; background: rgba(26, 142, 182, .22); }
.borehole-select-inline button.special { color: #d99b43; border-style: dashed; border-color: rgba(255, 174, 61, .38); }
.borehole-select-inline button.special.active { color: #ffd07a; border-color: #ffb13d; background: rgba(255, 166, 44, .12); }
.slice-control { flex: 1; display: flex; align-items: center; gap: 6px; color: #557e92; font-size: 8px; }
.slice-control input { flex: 1; accent-color: #36d8ff; height: 3px; }
.slice-control em { width: 24px; color: #8ccbdd; font: 8px Electronic, monospace; font-style: normal; }
.rotate-toggle { height: 25px; padding: 0 7px; color: #557f94; font-size: 8px; border: 1px solid rgba(70, 156, 192, .15); background: rgba(20, 58, 81, .24); cursor: pointer; }
.rotate-toggle i { margin-right: 3px; color: #42dfff; font-size: 11px; font-style: normal; }
.rotate-toggle.active { color: #bcf3ff; border-color: rgba(62, 206, 244, .44); background: rgba(26, 142, 182, .2); }

/* Accuracy gauges */
.damage-panel { flex: 1.15; }
.damage-viz { display: flex; align-items: center; justify-content: center; padding: 9px 12px 4px; }
.accuracy-gauges { display: flex; gap: 14px; justify-content: center; }
.gauge-ring {
  --pct: 70;
  position: relative;
  width: 72px; height: 72px;
  border-radius: 50%;
  display: grid; place-items: center; align-content: center;
  background: conic-gradient(#3fdcff 0deg, #3fdcff calc(var(--pct) * 3.6deg), rgba(15, 47, 68, .5) calc(var(--pct) * 3.6deg));
}
.gauge-ring::before { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: #061426; box-shadow: inset 0 0 16px rgba(55, 217, 255, .08); border: 1px solid rgba(55, 217, 255, .18); }
.gauge-ring span { position: relative; z-index: 1; font: 13px Electronic, monospace; color: #def7ff; }
.gauge-ring small { position: relative; z-index: 1; margin-top: 2px; font-size: 7px; color: #60899d; }
.damage-gauge { --pct: 70; }
.stress-gauge { --pct: 85; }
.state-gauge { --pct: 68; }
.zone-legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 0 10px 9px; }
.zone-legend div { padding: 5px; background: rgba(15, 47, 68, .3); border: 1px solid rgba(62, 139, 170, .12); }
.zone-legend i { display: inline-block; width: 6px; height: 6px; margin-right: 4px; }
.zone-legend span { color: #7397a7; font-size: 8px; }
.zone-legend strong { display: block; margin: 2px 0 0 10px; font: 12px Electronic, monospace; color: #d9f7ff; }
.plastic-color { background: #ff6725; }.damage-color { background: #ffc52a; }.elastic-color { background: #36ce74; }

.sensor-panel { flex: 1; }
.sensor-head, .sensor-item { display: grid; grid-template-columns: 1.15fr .48fr .48fr .48fr; align-items: center; column-gap: 4px; padding: 0 10px; }
.sensor-head { height: 25px; color: #426d82; font-size: 7px; border-bottom: 1px solid rgba(68, 147, 180, .12); }
.sensor-head span:nth-child(n+2) { text-align: right; }
.sensor-item { height: calc((100% - 66px) / 3); min-height: 32px; color: #89adbd; font-size: 8px; border-bottom: 1px solid rgba(68, 147, 180, .08); cursor: pointer; transition: background .2s; }
.sensor-item:hover, .sensor-item.active { background: rgba(28, 150, 194, .12); }
.sensor-item > span { display: flex; align-items: center; gap: 5px; }
.sensor-item > span i { width: 5px; height: 5px; border-radius: 50%; background: #2c5d78; box-shadow: none; }
.sensor-item > span i.active { background: #48e59d; box-shadow: 0 0 5px #48e59d; }
.sensor-item strong { text-align: right; color: #d9f6ff; font: 11px Electronic, monospace; }
.sensor-item em { justify-self: end; padding: 2px 4px; font-size: 7px; font-style: normal; }
.sensor-item b { justify-self: end; color: #f2c96e; font: 9px Electronic, monospace; font-weight: 500; }
.sensor-item em.good { color: #4bdc9c; background: rgba(49, 219, 146, .08); }
.sensor-item em.normal { color: #ffb33a; background: rgba(255, 171, 48, .1); }

.warning-panel { flex: .68; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-color: rgba(255, 184, 48, .25); background: linear-gradient(100deg, rgba(66, 42, 12, .44), rgba(12, 23, 35, .72)); }
.warning-panel::before, .warning-panel::after { background: #ffb536; }
.warning-signal { position: relative; display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 42px; }
.warning-signal span { position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(255, 182, 46, .4); animation: signalPulse 1.8s infinite; }
.warning-signal i { display: grid; place-items: center; width: 26px; height: 26px; color: #151007; font: 700 17px sans-serif; font-style: normal; clip-path: polygon(50% 0, 100% 100%, 0 100%); background: #ffb533; padding-top: 5px; }
.warning-copy { flex: 1; min-width: 0; }
.warning-copy small { display: block; color: #815f2a; font-size: 6px; letter-spacing: 1px; }
.warning-copy strong { color: #ffc14a; font-size: 11px; }
.warning-copy p { margin: 3px 0 0; color: #846f51; font-size: 7px; line-height: 1.4; }
.risk-score { text-align: center; }
.risk-score strong { display: block; color: #ffc14a; font: 22px Electronic, monospace; }
.risk-score span { color: #7b6441; font-size: 7px; }
.warning-panel.stable { border-color: rgba(52, 220, 145, .25); background: linear-gradient(100deg, rgba(14, 52, 32, .44), rgba(12, 23, 35, .72)); }
.warning-panel.stable::before, .warning-panel.stable::after { background: #3cdd97; }
.warning-panel.stable .warning-signal i { background: #3cdd97; }
.warning-panel.stable .warning-copy strong, .warning-panel.stable .risk-score strong { color: #53e4a5; }
.warning-panel.danger { animation: warnGlow 2s ease-in-out infinite; }
@keyframes signalPulse { 70%, 100% { inset: -9px; opacity: 0; } }
@keyframes warnGlow { 50% { box-shadow: inset 0 0 25px rgba(255, 121, 28, .1), 0 0 12px rgba(255, 121, 28, .08); } }

/* Footer: Evolution timeline */
.evolution-footer { position: relative; z-index: 5; display: grid; grid-template-columns: 220px 1fr 150px; align-items: center; gap: 16px; height: 90px; padding: 6px 25px 8px; background: linear-gradient(180deg, rgba(4, 18, 33, .78), rgba(3, 12, 24, .98)); border-top: 1px solid rgba(61, 177, 221, .23); }
.evolution-footer::before { content: ''; position: absolute; left: 25%; right: 25%; top: -1px; height: 2px; background: linear-gradient(90deg, transparent, #3bdcff, transparent); }
.evolution-title { display: flex; align-items: center; gap: 11px; }
.play-button { display: flex; align-items: center; justify-content: center; gap: 7px; width: 86px; height: 42px; color: #b9f2ff; background: rgba(30, 148, 191, .14); border: 1px solid rgba(58, 213, 249, .5); clip-path: polygon(7% 0, 93% 0, 100% 20%, 100% 80%, 93% 100%, 7% 100%, 0 80%, 0 20%); cursor: pointer; }
.play-button:hover { background: rgba(37, 185, 229, .28); }
.play-button span { font-size: 13px; }
.play-button em { font-size: 8px; font-style: normal; letter-spacing: .5px; white-space: nowrap; }
.evolution-title strong { display: block; font-size: 13px; letter-spacing: 2px; }
.evolution-title small { color: #3e6c82; font-size: 7px; letter-spacing: 1px; }
.timeline-wrap { position: relative; padding: 0 8px; }
.timeline-labels { display: flex; justify-content: space-between; color: #7796a6; font-size: 10px; font-weight: 600; padding: 0 4px; }
.evolution-range { position: relative; z-index: 2; display: block; width: 100%; height: 4px; margin: 8px 0 6px; accent-color: #ffb536; cursor: pointer; }
.timeline-points { position: absolute; z-index: 1; left: 12px; right: 12px; top: 25px; display: flex; justify-content: space-between; pointer-events: none; }
.timeline-points i { width: 9px; height: 9px; border-radius: 50%; background: #102c40; border: 1px solid #2c708d; }
.timeline-points i.passed { background: #ffb536; border-color: #ffd480; box-shadow: 0 0 8px rgba(255, 181, 54, .75); }
.timeline-sub { display: flex; justify-content: space-between; align-items: center; padding: 0 4px; color: #41677b; font-size: 8px; }
.speed-control { display: flex; align-items: center; gap: 4px; }
.speed-control button { appearance: none; padding: 1px 6px; color: #557e92; font-size: 7px; background: rgba(20, 58, 81, .2); border: 1px solid rgba(70, 156, 192, .12); cursor: pointer; }
.speed-control button.active { color: #ffb536; border-color: #ffb536; }
.progress-readout { padding-left: 17px; border-left: 1px solid rgba(67, 147, 181, .2); }
.progress-readout span { display: block; color: #567e91; font-size: 8px; }
.progress-readout strong { display: block; color: #ffb536; font: 25px Electronic, monospace; text-shadow: 0 0 12px rgba(255, 181, 54, .35); }
.progress-readout strong em { margin-left: 3px; font-size: 10px; font-style: normal; }
.progress-readout small { color: #375e71; font: 7px Electronic, monospace; }
.data-provenance { position: absolute; left: 50%; bottom: 3px; max-width: 55%; overflow: hidden; transform: translateX(-50%); color: rgba(75, 130, 153, .58); font: 6px/1 Electronic, monospace; letter-spacing: .8px; white-space: nowrap; text-overflow: ellipsis; }

@media (max-height: 820px) {
  .top-header { height: 64px; }
  .dashboard-body { height: calc(100vh - 144px); }
  .evolution-footer { height: 80px; }
  .panel-title { height: 34px; }
  .project-name { margin-top: 6px; margin-bottom: 5px; }
  .overview-grid div { padding-top: 3px; padding-bottom: 3px; }
  .load-row { padding: 3px 0; }
  .gauge-ring { transform: scale(.88); }
  .zone-legend div { padding: 3px; }
}
</style>

<style scoped lang="scss">
/* “随钻智控”科研仪器主题：沿用项目点阵与结构条素材，统一克制的蓝灰 / 金色语义。 */
.digital-twin-screen,
.digital-twin-screen * { box-sizing: border-box; }

.digital-twin-screen {
  --cyan: #72d5e7;
  --cyan-soft: #b8edf4;
  --gold: #e3b85a;
  --paper: #dce8eb;
  --muted: #78909a;
  --panel: rgba(7, 18, 26, .82);
  --line: rgba(132, 164, 175, .19);
  min-width: 1024px;
  min-height: 720px;
  color: var(--paper);
  background:
    linear-gradient(180deg, rgba(5, 13, 19, .18), rgba(3, 10, 15, .76)),
    radial-gradient(circle at 52% 38%, rgba(35, 103, 121, .2), transparent 42%),
    #050d13;
}

.digital-twin-screen::before {
  opacity: .18;
  background-image:
    linear-gradient(rgba(128, 164, 176, .045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(128, 164, 176, .045) 1px, transparent 1px);
  background-size: 48px 48px;
}

.digital-twin-screen::after {
  bottom: 86px;
  height: 64%;
  opacity: .24;
  background-size: cover;
  mix-blend-mode: screen;
}

.ambient-grid { background: rgba(52, 135, 153, .09); filter: blur(82px); }

.top-header {
  grid-template-columns: minmax(220px, .9fr) minmax(540px, 2.7fr) minmax(220px, .9fr);
  height: 92px;
  padding: 0 26px;
  background: linear-gradient(180deg, rgba(5, 14, 21, .98), rgba(5, 14, 21, .86) 80%, rgba(5, 14, 21, .32));
  border-bottom-color: rgba(137, 170, 181, .16);
}

.system-brand,
.system-state,
.title-block { min-width: 0; }

.brand-mark { width: 36px; height: 34px; opacity: .9; }
.brand-mark span { border-color: #8bd7e4; box-shadow: none; }
.system-brand strong { color: #e4edef; font-size: 17px; letter-spacing: 5px; }
.system-brand small {
  display: block;
  max-width: 190px;
  overflow: hidden;
  color: #6f8791;
  font-size: 7px;
  letter-spacing: 1.7px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.title-block { position: relative; justify-content: center; gap: 2px; }
.title-block p { margin: 0; color: #6b8994; font-size: 7px; letter-spacing: 2.8px; }
.title-block p i { background: linear-gradient(90deg, transparent, #709ca8); }
.title-block h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13px;
  width: 100%;
  margin: 0;
  color: #eef4f5;
  font-size: clamp(23px, 1.5vw, 29px);
  font-weight: 600;
  letter-spacing: 5px;
  line-height: 1.35;
  text-shadow: 0 4px 22px rgba(51, 129, 146, .2);
  white-space: nowrap;
}
.title-block h1 span { flex: 0 0 auto; }
.title-block h1 small {
  min-width: 0;
  overflow: hidden;
  padding-left: 13px;
  color: #91a5ac;
  font-size: clamp(9px, .57vw, 11px);
  font-weight: 400;
  letter-spacing: 1.1px;
  border-left: 1px solid rgba(227, 184, 90, .55);
  text-overflow: ellipsis;
}
.title-rule { bottom: -8px; width: 72%; height: 13px; opacity: .24; }
.title-rule span { width: 72px; height: 1px; background: var(--gold); box-shadow: 0 0 9px rgba(227, 184, 90, .35); }

.system-state { gap: 16px; }
.clock { padding-right: 15px; }
.clock strong { color: #e0e9eb; font-size: 16px; }
.clock small { color: #6d828b; }
.online { min-width: 0; color: #b8c9ce; font-size: 9px; overflow: hidden; }
.online i { width: 7px; height: 7px; background: #76cba8; box-shadow: 0 0 0 4px rgba(118, 203, 168, .08); }
.online span { min-width: 0; overflow: hidden; white-space: nowrap; }
.online small { display: block; max-width: 108px; overflow: hidden; color: #637c86; white-space: nowrap; text-overflow: ellipsis; }

.dashboard-body {
  grid-template-columns: clamp(272px, 18.7vw, 356px) minmax(0, 1fr) clamp(272px, 18.7vw, 356px);
  gap: 14px;
  height: calc(100vh - 182px);
  min-height: 538px;
  padding: 11px 18px 8px;
}
.side-column { gap: 11px; min-width: 0; }

.panel {
  border-color: var(--line);
  background:
    linear-gradient(110deg, rgba(113, 151, 163, .035), transparent 35%),
    linear-gradient(145deg, rgba(8, 22, 31, .9), rgba(5, 15, 22, .76));
  box-shadow: inset 2px 0 rgba(227, 184, 90, .12), 0 14px 36px rgba(0, 0, 0, .16);
  backdrop-filter: blur(16px);
}
.panel::before,
.panel::after { width: 24px; background: #819ba4; opacity: .48; }
.panel-title {
  display: grid;
  grid-template-columns: 31px minmax(0, auto) minmax(16px, 1fr);
  gap: 10px;
  height: 47px;
  padding: 0 13px;
  background: linear-gradient(90deg, rgba(118, 154, 166, .08), transparent 74%);
  border-bottom-color: rgba(129, 160, 171, .1);
}
.panel-title > span {
  width: 31px;
  height: 23px;
  margin: 0;
  color: var(--gold);
  font-size: 9px;
  background: rgba(227, 184, 90, .055);
  border-color: rgba(227, 184, 90, .3);
  transform: none;
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
}
.panel-title div { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 1px; }
.panel-title strong,
.panel-title small { display: block; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.panel-title strong { color: #dce6e8; font-size: 12px; letter-spacing: 1.4px; line-height: 1.25; }
.panel-title small { color: #637b85; font-size: 6px; letter-spacing: 1.6px; }
.panel-title > i { width: 100%; margin: 0; background: linear-gradient(90deg, rgba(123, 155, 166, .3), transparent); }

/* PanelTitle 是局部渲染组件，其内部节点需要穿透父组件的 scoped 边界。 */
:deep(.panel-title > span) {
  display: grid;
  place-items: center;
  width: 31px;
  height: 23px;
  margin: 0;
  color: var(--gold);
  font: 9px Electronic, monospace;
  background: rgba(227, 184, 90, .055);
  border: 1px solid rgba(227, 184, 90, .3);
  transform: none;
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
}
:deep(.panel-title > div) { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 1px; }
:deep(.panel-title strong),
:deep(.panel-title small) { display: block; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
:deep(.panel-title strong) { color: #dce6e8; font-size: 12px; font-weight: 600; letter-spacing: 1.4px; line-height: 1.25; }
:deep(.panel-title small) { color: #637b85; font-size: 6px; letter-spacing: 1.6px; }
:deep(.panel-title > i) { width: 100%; height: 1px; margin: 0; background: linear-gradient(90deg, rgba(123, 155, 166, .3), transparent); }

.project-name { margin: 11px 13px 9px; }
.project-icon { width: 36px; height: 36px; flex: 0 0 36px; color: #9ed8e2; background: rgba(105, 159, 173, .07); border-color: rgba(119, 171, 184, .24); }
.project-name strong { color: #dae5e8; font-size: 11px; }
.project-name small { display: block; overflow: hidden; color: #69838e; white-space: nowrap; text-overflow: ellipsis; }
.project-name em { flex: 0 0 auto; color: var(--gold); font-size: 8px; white-space: nowrap; background: rgba(227, 184, 90, .06); border-color: rgba(227, 184, 90, .22); }
.overview-grid { margin-inline: 13px; border-color: rgba(121, 155, 166, .1); }
.overview-grid div { padding: 6px 9px; border-color: rgba(121, 155, 166, .1); }
.overview-grid span { color: #718993; }
.overview-grid strong { color: #e2ebed; }
.relief-status { margin-inline: 13px; grid-template-columns: 7px auto minmax(0, 1fr); }
.relief-status strong,
.relief-status small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

.load-kpis { padding-inline: 13px; }
.load-row { min-width: 0; border-color: rgba(119, 153, 165, .09); }
.kpi-icon { color: #8bd8e5; background: rgba(98, 160, 175, .07); border-color: #6fb7c6; }
.kpi-icon.blue { color: #8dafcc; border-color: #668dae; background: rgba(83, 112, 144, .08); }
.kpi-icon.orange { color: var(--gold); border-color: #c69d4e; background: rgba(198, 157, 78, .08); }
.kpi-data > span { overflow: hidden; color: #758f99; white-space: nowrap; text-overflow: ellipsis; }
.kpi-data > span small { color: #536d77; }
.kpi-data strong { color: #e1e9eb; }
.mini-bars i.on { background: #76c4d3; box-shadow: none; }

.chart-head { gap: 8px; }
.chart-head span,
.chart-head strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.chart-head span { flex: 1; min-width: 0; }
.chart-head strong { flex: 0 0 auto; color: var(--gold); }

.scene-heading {
  height: 45px;
  padding-inline: 13px 9px;
  background: linear-gradient(90deg, rgba(113, 151, 163, .09), rgba(5, 15, 22, .28));
  border-color: var(--line);
}
.scene-heading > div { min-width: 0; }
.live-dot { background: #77c9a9; box-shadow: 0 0 7px rgba(119, 201, 169, .7); }
.scene-heading p { overflow: hidden; color: #d6e1e4; white-space: nowrap; text-overflow: ellipsis; }
.scene-heading p small { color: #677f89; }
.metric-tabs { flex: 0 0 auto; }
.metric-tabs button,
.view-switch button,
.model-select-inline button,
.borehole-select-inline button,
.follow-toggle,
.rotate-toggle,
.speed-control button {
  border-color: rgba(126, 159, 171, .16);
  color: #708a95;
  background: rgba(98, 132, 144, .055);
  font-family: inherit;
}
.metric-tabs button:hover,
.metric-tabs button.active,
.view-switch button.active,
.model-select-inline button.active,
.borehole-select-inline button:hover,
.borehole-select-inline button.active,
.follow-toggle.active,
.rotate-toggle.active {
  color: #d8e8eb;
  border-color: rgba(113, 202, 218, .52);
  background: rgba(84, 151, 165, .13);
  box-shadow: inset 0 -1px #72cadb;
}

.scene-frame {
  background:
    radial-gradient(circle at 52% 49%, rgba(38, 93, 105, .14), rgba(4, 12, 18, .64) 68%),
    linear-gradient(rgba(115, 151, 163, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(115, 151, 163, .035) 1px, transparent 1px);
  background-size: auto, 32px 32px, 32px 32px;
  border-color: var(--line);
}
.scene-frame .corner { width: 18px; height: 18px; opacity: .62; }
.corner.tl, .corner.tr, .corner.bl, .corner.br { border-color: #879ea6; }
.model-tag { max-width: 160px; overflow: hidden; color: #7e969f; white-space: nowrap; text-overflow: ellipsis; background: rgba(5, 15, 21, .74); border-color: rgba(130, 161, 171, .18); }
.model-tag span { color: #dbe5e7; }
.model-tag i { flex: 0 0 14px; background: #78bcc9; }
.tag-face span { color: var(--gold); }
.tag-face i { background: var(--gold); }
.cloud-legend { right: 15px; height: 178px; background: rgba(5, 15, 21, .72); border-color: rgba(130, 161, 171, .18); }
.legend-scale,
.legend-scale.damage-scale { background: linear-gradient(to bottom, #f2c14e, #c0b46c 18%, #7aafa0 39%, #3a98a0 58%, #1d7494 74%, #174c73 87%, #102a43); box-shadow: none; }
.scene-data-strip { max-width: calc(100% - 150px); background: rgba(5, 15, 21, .82); border-color: rgba(130, 161, 171, .18); }
.scene-data-strip div { min-width: 0; border-color: rgba(130, 161, 171, .12); }
.scene-data-strip span,
.scene-data-strip strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.scene-data-strip strong { color: #b8dce3; }

.scene-controls { border-color: var(--line); background: rgba(6, 17, 24, .88); }
.control-row { min-width: 0; padding: 4px 8px; }
.control-row.sub { min-height: 31px; border-color: rgba(126, 159, 171, .1); }
.view-switch,
.model-select-inline { flex: 0 0 auto; }
.borehole-select-inline button { min-width: 18px; }
.slice-control { min-width: 0; color: #718994; }
.slice-control span { flex: 0 0 auto; }
.slice-control input { min-width: 80px; }
.slice-control em { width: 54px; flex: 0 0 54px; color: #a8cad1; text-align: right; }
.follow-toggle,
.rotate-toggle { height: 25px; flex: 0 0 auto; padding: 0 8px; cursor: pointer; font-size: 8px; }

.gauge-ring { width: 68px; height: 68px; background: conic-gradient(#78c3d0 0deg, #78c3d0 calc(var(--pct) * 3.6deg), rgba(35, 56, 65, .58) calc(var(--pct) * 3.6deg)); }
.gauge-ring::before { background: #09171f; border-color: rgba(121, 164, 176, .16); box-shadow: none; }
.gauge-ring span { color: #e1eaec; }
.zone-legend { min-width: 0; }
.zone-legend div { min-width: 0; background: rgba(93, 126, 138, .05); border-color: rgba(126, 159, 171, .1); }
.zone-legend span,
.zone-legend strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.plastic-color { background: #d6ad58; }
.damage-color { background: #72bdca; }
.elastic-color { background: #72b59b; }
.sensor-head,
.sensor-item { min-width: 0; }
.sensor-item > span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.warning-panel { border-color: rgba(227, 184, 90, .22); background: linear-gradient(100deg, rgba(75, 57, 25, .32), rgba(9, 20, 27, .78)); }
.warning-panel::before,
.warning-panel::after { background: var(--gold); }
.warning-copy strong,
.warning-copy p { overflow: hidden; }
.warning-copy strong { display: block; white-space: nowrap; text-overflow: ellipsis; }
.warning-copy p { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: #91836a; }

.evolution-footer {
  grid-template-columns: 230px minmax(0, 1fr) 165px;
  gap: 18px;
  height: 90px;
  padding: 7px 26px 9px;
  background: linear-gradient(180deg, rgba(7, 18, 25, .86), rgba(4, 12, 18, .98));
  border-color: rgba(131, 164, 175, .2);
}
.evolution-footer::before { background: linear-gradient(90deg, transparent, var(--gold), transparent); opacity: .64; }
.play-button { width: 86px; height: 42px; color: #e5ecee; background: rgba(95, 138, 150, .08); border-color: rgba(126, 192, 205, .4); }
.play-button:hover { background: rgba(102, 163, 176, .14); }
.play-button.paused { color: #f1d189; border-color: rgba(227, 184, 90, .55); background: rgba(227, 184, 90, .08); }
.evolution-title strong { color: #dbe5e7; }
.evolution-title small { color: #667f89; }
.timeline-labels { color: #80959d; }
.evolution-range { accent-color: var(--gold); }
.timeline-points i { background: #152932; border-color: #567480; }
.timeline-points i.passed { background: var(--gold); border-color: #f0d18b; box-shadow: 0 0 7px rgba(227, 184, 90, .55); }
.timeline-sub { min-width: 0; }
.timeline-sub > span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.timeline-sub > span:first-child { flex: 1; }
.timeline-sub > span:last-child { flex: 0 0 auto; }
.speed-control { flex: 0 0 auto; }
.speed-control button.active { color: var(--gold); border-color: rgba(227, 184, 90, .6); }
.progress-readout { min-width: 0; }
.progress-readout strong { color: var(--gold); text-shadow: 0 0 10px rgba(227, 184, 90, .22); }
.progress-readout small { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

@media (max-width: 1500px) {
  .top-header { grid-template-columns: 210px minmax(0, 1fr) 215px; padding-inline: 18px; }
  .title-block h1 { gap: 9px; letter-spacing: 3px; }
  .title-block h1 small { padding-left: 9px; font-size: 9px; }
  .dashboard-body { gap: 10px; padding-inline: 12px; }
  .panel-title { padding-inline: 10px; }
  .accuracy-gauges { gap: 6px; }
  .scene-data-strip { max-width: calc(100% - 125px); }
}

@media (max-height: 920px) {
  .top-header { height: 80px; }
  .dashboard-body { height: calc(100vh - 158px); min-height: 562px; padding-top: 8px; }
  .evolution-footer { height: 78px; }
  .panel-title { height: 40px; }
  .project-name { margin-top: 7px; margin-bottom: 6px; }
  .overview-grid div { padding-top: 4px; padding-bottom: 4px; }
  .load-row { padding-block: 3px; }
  .damage-viz { padding-top: 4px; }
  .gauge-ring { width: 62px; height: 62px; }
  .scene-heading { height: 40px; }
  .cloud-legend { height: 154px; }
}

@media (max-width: 1220px) {
  .system-brand small,
  .online small,
  .scene-heading p small { display: none; }
  .title-block h1 small { max-width: 360px; }
  .dashboard-body { grid-template-columns: 272px minmax(0, 1fr) 272px; }
  .metric-tabs button { padding-inline: 7px; }
  .scene-data-strip div:nth-child(3) { display: none; }
}

/* Multi-borehole result view: synchronized stress and damage fields. */
.fit-method { display: flex; flex: 0 0 auto; align-items: center; gap: 7px; color: #78929c; font-size: 8px; letter-spacing: .5px; }
.fit-method i { width: 14px; height: 1px; background: var(--gold); opacity: .72; }
.dual-scene-frame { isolation: isolate; }
.dual-cloud-grid {
  position: absolute;
  inset: 0 0 45px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  padding: 6px;
}
.cloud-pane {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background: radial-gradient(circle at 50% 48%, rgba(19, 73, 91, .13), rgba(2, 8, 14, .34) 68%);
  border: 1px solid rgba(126, 159, 171, .16);
}
.stress-cloud-pane { border-top-color: rgba(27, 151, 177, .48); }
.damage-cloud-pane { border-top-color: rgba(205, 111, 31, .48); }
.pane-legend.cloud-legend {
  top: 72px;
  right: 8px;
  grid-template-columns: 34px 9px 19px;
  gap: 4px;
  width: auto;
  height: 142px;
  padding: 7px 5px;
  background: rgba(3, 11, 17, .86);
  border-color: rgba(132, 164, 175, .24);
}
.pane-legend .legend-title { font-size: 7px; letter-spacing: 1px; }
.pane-legend .legend-labels { font-size: 7px; }
.pane-legend .legend-scale.stress-scale {
  background: linear-gradient(to bottom, #9d001f, #e62b00 12%, #e47700 29%, #9cb900 46%, #00a86b 63%, #007fc4 78%, #0037a8 90%, #000b38);
  box-shadow: 0 0 11px rgba(0, 127, 196, .42);
}
.pane-legend .legend-scale.damage-scale {
  background: linear-gradient(to bottom, #82001d, #d52300 12%, #d47400 29%, #72a800 46%, #008c8f 63%, #2656b8 78%, #351080 90%, #10002f);
  box-shadow: 0 0 11px rgba(53, 16, 128, .42);
}
.pane-readout {
  position: absolute;
  z-index: 6;
  left: 11px;
  bottom: 11px;
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 5px 8px;
  background: rgba(3, 11, 17, .84);
  border: 1px solid rgba(132, 164, 175, .22);
  pointer-events: none;
}
.pane-readout span { margin-right: 3px; color: #86a8b2; font: italic 10px Georgia, serif; }
.pane-readout strong { color: #e4ecee; font: 13px Electronic, monospace; }
.pane-readout em { color: #758d96; font-size: 7px; font-style: normal; }
.stress-readout { border-left: 2px solid #00988f; }
.damage-readout { border-left: 2px solid #dc3e17; }
.dual-scene-frame > .scene-data-strip { bottom: 7px; width: max-content; max-width: calc(100% - 18px); }

@media (max-width: 1500px) {
  .pane-legend.cloud-legend { top: 64px; height: 128px; }
  .fit-method { gap: 4px; font-size: 7px; }
}

/* Data import entry */
.import-data-trigger {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  height: 42px;
  min-width: 116px;
  padding: 0 12px 0 9px;
  color: #d8e8eb;
  font-family: inherit;
  text-align: left;
  background:
    linear-gradient(135deg, rgba(115, 190, 204, .14), rgba(43, 95, 109, .05)),
    rgba(7, 20, 28, .86);
  border: 1px solid rgba(116, 193, 207, .38);
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  cursor: pointer;
  transition: color .2s ease, border-color .2s ease, background .2s ease, transform .2s ease;
}
.import-data-trigger::after {
  content: '';
  position: absolute;
  right: 8px;
  bottom: 5px;
  width: 22px;
  height: 1px;
  background: var(--gold);
  opacity: .55;
}
.import-data-trigger:hover {
  color: #f1f7f8;
  border-color: rgba(129, 222, 237, .7);
  background: linear-gradient(135deg, rgba(115, 190, 204, .22), rgba(43, 95, 109, .08)), rgba(7, 20, 28, .9);
  transform: translateY(-1px);
}
.import-trigger-icon {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  color: #87d5e2;
  background: rgba(111, 190, 204, .08);
  border: 1px solid rgba(122, 205, 219, .22);
}
.import-trigger-icon svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: square; stroke-linejoin: miter; }
.import-data-trigger > span:last-child { display: flex; flex-direction: column; gap: 2px; }
.import-data-trigger strong { font-size: 11px; font-weight: 600; letter-spacing: 1.3px; white-space: nowrap; }
.import-data-trigger small { color: #657f89; font-size: 6px; letter-spacing: 1.2px; white-space: nowrap; }
.relief-entry {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  height: 42px;
  min-width: 142px;
  padding: 0 12px 0 9px;
  color: #eff9f5;
  text-align: left;
  text-decoration: none;
  background:
    linear-gradient(135deg, rgba(77, 188, 143, .24), rgba(46, 113, 91, .08)),
    rgba(7, 23, 24, .9);
  border: 1px solid rgba(105, 213, 167, .58);
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  transition: color .2s ease, border-color .2s ease, background .2s ease, transform .2s ease;
}
.relief-entry::after {
  position: absolute;
  right: 8px;
  bottom: 5px;
  width: 28px;
  height: 1px;
  background: #75d1a8;
  content: '';
  opacity: .75;
}
.relief-entry:hover {
  color: #fff;
  background: linear-gradient(135deg, rgba(84, 207, 157, .34), rgba(46, 113, 91, .13)), rgba(7, 23, 24, .94);
  border-color: rgba(130, 239, 193, .88);
  transform: translateY(-1px);
}
.relief-entry-icon {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  color: #8ee0bd;
  font: 18px/1 Arial, sans-serif;
  background: rgba(92, 203, 157, .09);
  border: 1px solid rgba(112, 222, 175, .3);
}
.relief-entry > span:last-child { display: flex; flex-direction: column; gap: 2px; }
.relief-entry strong { font-size: 11px; font-weight: 600; letter-spacing: 1.1px; white-space: nowrap; }
.relief-entry small { color: #6c9383; font-size: 6px; letter-spacing: 1.1px; white-space: nowrap; }

/* Data import modal */
.import-modal-backdrop {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(1, 7, 11, .76);
  backdrop-filter: blur(9px);
}
.import-modal-backdrop::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(rgba(104, 160, 174, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(104, 160, 174, .035) 1px, transparent 1px);
  background-size: 36px 36px;
}
.import-dialog {
  position: relative;
  width: min(900px, calc(100vw - 56px));
  max-height: calc(100vh - 56px);
  overflow: hidden;
  color: #dce8eb;
  background:
    linear-gradient(120deg, rgba(102, 167, 181, .045), transparent 38%),
    linear-gradient(160deg, rgba(8, 23, 32, .99), rgba(4, 14, 21, .99));
  border: 1px solid rgba(129, 181, 193, .36);
  box-shadow: 0 30px 90px rgba(0, 0, 0, .58), inset 0 0 56px rgba(57, 116, 130, .045);
}
.import-dialog::after {
  content: '';
  position: absolute;
  z-index: 2;
  left: 70px;
  right: 70px;
  top: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #79ccda, var(--gold), #79ccda, transparent);
  opacity: .75;
}
.dialog-corner { position: absolute; z-index: 4; width: 18px; height: 18px; pointer-events: none; }
.dialog-corner.tl { top: 6px; left: 6px; border-top: 1px solid var(--gold); border-left: 1px solid var(--gold); }
.dialog-corner.tr { top: 6px; right: 6px; border-top: 1px solid var(--gold); border-right: 1px solid var(--gold); }
.dialog-corner.bl { bottom: 6px; left: 6px; border-bottom: 1px solid var(--gold); border-left: 1px solid var(--gold); }
.dialog-corner.br { bottom: 6px; right: 6px; border-bottom: 1px solid var(--gold); border-right: 1px solid var(--gold); }

.import-dialog-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 15px;
  height: 78px;
  padding: 0 22px;
  border-bottom: 1px solid rgba(126, 166, 178, .14);
  background: linear-gradient(90deg, rgba(104, 162, 176, .08), transparent 58%);
}
.dialog-index { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 48px; height: 43px; border: 1px solid rgba(227, 184, 90, .35); background: rgba(227, 184, 90, .05); clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
.dialog-index span { color: var(--gold); font: 16px/1 Electronic, monospace; }
.dialog-index small { margin-top: 5px; color: #7e745c; font-size: 5px; letter-spacing: .8px; }
.import-dialog-header p { margin: 0 0 3px; color: #6b8791; font-size: 7px; letter-spacing: 2.2px; }
.import-dialog-header h2 { margin: 0; color: #eef5f6; font-size: 20px; font-weight: 500; letter-spacing: 3px; }
.dialog-status { display: flex; align-items: center; gap: 8px; padding: 7px 11px; border-left: 1px solid rgba(123, 159, 170, .17); }
.dialog-status > i { width: 7px; height: 7px; border-radius: 50%; background: #77c9a9; box-shadow: 0 0 0 4px rgba(119, 201, 169, .08); }
.dialog-status span { display: flex; flex-direction: column; gap: 2px; color: #a9bec4; font-size: 9px; }
.dialog-status small { color: #5b747e; font-size: 6px; letter-spacing: 1px; }
.dialog-close { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; color: #75909a; font: 23px/1 Arial, sans-serif; background: rgba(103, 144, 156, .04); border: 1px solid rgba(123, 159, 170, .17); cursor: pointer; transition: .2s ease; }
.dialog-close:hover { color: #e8f1f3; border-color: rgba(227, 184, 90, .45); background: rgba(227, 184, 90, .06); }

.import-steps { display: grid; grid-template-columns: auto 1fr auto 1fr auto; align-items: center; gap: 12px; height: 64px; padding: 0 68px; background: rgba(2, 10, 15, .32); border-bottom: 1px solid rgba(125, 161, 172, .1); }
.import-steps > div { display: flex; align-items: center; gap: 9px; opacity: .45; transition: opacity .25s ease; }
.import-steps > div.active { opacity: 1; }
.import-steps > div > span { display: grid; place-items: center; width: 28px; height: 28px; color: #758c95; font: 8px Electronic, monospace; border: 1px solid rgba(121, 157, 168, .26); clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px); }
.import-steps > div.active > span { color: var(--gold); border-color: rgba(227, 184, 90, .55); background: rgba(227, 184, 90, .055); }
.import-steps p { margin: 0; color: #b7c8cc; font-size: 10px; white-space: nowrap; }
.import-steps p small { display: block; margin-top: 2px; color: #607983; font-size: 6px; letter-spacing: 1px; }
.import-steps > i { height: 1px; background: linear-gradient(90deg, rgba(106, 150, 162, .35), rgba(106, 150, 162, .08)); }

.import-dialog-body { display: grid; grid-template-columns: 1.05fr .95fr; min-height: 310px; }
.import-source-column { padding: 20px 23px 17px; border-right: 1px solid rgba(124, 161, 172, .12); }
.file-drop-zone { position: relative; display: flex; height: 198px; flex-direction: column; align-items: center; justify-content: center; padding: 16px; overflow: hidden; text-align: center; background: rgba(72, 121, 135, .035); border: 1px dashed rgba(117, 184, 198, .36); cursor: pointer; transition: .22s ease; }
.file-drop-zone::before, .file-drop-zone::after { content: ''; position: absolute; width: 25px; height: 25px; border-color: rgba(227, 184, 90, .5); pointer-events: none; }
.file-drop-zone::before { left: 6px; top: 6px; border-left: 1px solid; border-top: 1px solid; }
.file-drop-zone::after { right: 6px; bottom: 6px; border-right: 1px solid; border-bottom: 1px solid; }
.file-drop-zone:hover, .file-drop-zone.dragging { background: rgba(88, 157, 172, .085); border-color: rgba(125, 214, 231, .68); }
.file-drop-zone.filled { background: rgba(91, 151, 164, .055); border-style: solid; }
.file-drop-zone input { display: none; }
.drop-visual { position: relative; width: 62px; height: 56px; margin-bottom: 8px; }
.drop-visual svg { position: relative; z-index: 2; width: 46px; height: 46px; fill: none; stroke: #79bdca; stroke-width: 1.2; stroke-linecap: square; }
.drop-visual i { position: absolute; left: 7px; bottom: 3px; width: 49px; height: 1px; background: rgba(115, 185, 198, .16); }
.drop-visual i:nth-of-type(2) { left: 14px; bottom: 0; width: 35px; }
.drop-visual i:nth-of-type(3) { left: 22px; bottom: -3px; width: 19px; }
.file-drop-zone > strong { display: block; max-width: 100%; overflow: hidden; color: #dce8ea; font-size: 13px; font-weight: 500; letter-spacing: .6px; white-space: nowrap; text-overflow: ellipsis; }
.file-drop-zone > p { margin: 5px 0 9px; color: #6a838d; font-size: 9px; }
.file-drop-zone > button { height: 28px; padding: 0 14px; color: #a8d6de; font-family: inherit; font-size: 9px; background: rgba(104, 176, 190, .08); border: 1px solid rgba(114, 191, 205, .3); pointer-events: none; }
.format-support { display: flex; align-items: center; gap: 6px; height: 32px; color: #657f89; font-size: 7px; }
.format-support b { padding: 2px 5px; color: #8eabb3; font-size: 7px; font-weight: 500; background: rgba(106, 148, 160, .07); border: 1px solid rgba(117, 157, 169, .14); }
.format-support em { margin-left: auto; color: #586f78; font-style: normal; }
.demo-file-button, .file-validation-card { display: flex; align-items: center; width: 100%; height: 51px; padding: 0 12px; color: #a8bec4; font-family: inherit; text-align: left; background: rgba(96, 139, 151, .045); border: 1px solid rgba(119, 158, 169, .13); }
.demo-file-button { cursor: pointer; }
.demo-file-button:hover { background: rgba(100, 160, 173, .08); border-color: rgba(120, 187, 200, .26); }
.demo-file-button > span, .validation-icon { display: grid; place-items: center; width: 28px; height: 28px; margin-right: 10px; color: var(--gold); background: rgba(227, 184, 90, .06); border: 1px solid rgba(227, 184, 90, .26); }
.demo-file-button p, .file-validation-card p { display: flex; flex: 1; flex-direction: column; gap: 3px; margin: 0; font-size: 9px; }
.demo-file-button small, .file-validation-card small { color: #5d7680; font-size: 6px; letter-spacing: .7px; }
.demo-file-button em { color: #78939d; font-size: 15px; font-style: normal; }
.file-validation-card { background: rgba(78, 148, 119, .045); border-color: rgba(102, 184, 147, .18); }
.validation-icon { color: #7bc9a9; border-color: rgba(105, 190, 151, .28); background: rgba(81, 164, 126, .07); }
.file-validation-card p strong { color: #b8d5c9; font-size: 9px; font-weight: 500; }
.file-validation-card > em { color: #70b99b; font: 7px Electronic, monospace; font-style: normal; }

.import-config-column { padding: 18px 23px 17px; }
.config-heading { display: flex; align-items: baseline; gap: 8px; height: 25px; border-bottom: 1px solid rgba(119, 157, 169, .13); }
.config-heading span { color: #d3e1e4; font-size: 11px; letter-spacing: 1px; }
.config-heading small { color: #5b747e; font-size: 6px; letter-spacing: 1.2px; }
.config-field { display: grid; grid-template-columns: 108px minmax(0, 1fr); align-items: center; gap: 12px; margin-top: 13px; }
.config-field > span { color: #9eb2b8; font-size: 9px; }
.config-field > span small { display: block; margin-top: 2px; color: #526b75; font-size: 6px; letter-spacing: .8px; }
.config-field select { width: 100%; height: 34px; padding: 0 30px 0 10px; color: #bdcdd1; font-family: inherit; font-size: 9px; outline: none; background: #0a1b24; border: 1px solid rgba(120, 160, 172, .19); cursor: pointer; }
.config-field select:focus { border-color: rgba(116, 199, 214, .48); }
.field-mapping { margin-top: 14px; border: 1px solid rgba(119, 157, 169, .14); }
.mapping-head { display: flex !important; align-items: center !important; justify-content: space-between; height: 30px !important; padding: 0 10px !important; background: rgba(100, 144, 156, .055); border-bottom: 1px solid rgba(119, 157, 169, .11) !important; }
.mapping-head span { color: #9db1b7; font-size: 8px; }
.mapping-head small { color: #71bda3; font-size: 6px; letter-spacing: .8px; }
.field-mapping > div { display: grid; grid-template-columns: 1fr 18px 1fr 38px; align-items: center; height: 25px; padding: 0 10px; border-bottom: 1px solid rgba(119, 157, 169, .08); }
.field-mapping code { color: #7fb8c4; font: 7px Consolas, monospace; }
.field-mapping i { color: #596f77; font-size: 8px; font-style: normal; text-align: center; }
.field-mapping div > span { color: #a8b9bd; font-size: 8px; }
.field-mapping div > em { color: #5e7882; font-size: 7px; font-style: normal; text-align: right; }
.field-mapping > button { width: 100%; height: 27px; color: #728c96; font-family: inherit; font-size: 7px; background: transparent; border: 0; cursor: pointer; }
.field-mapping > button:hover { color: #a9c7cd; }
.field-mapping > button span { margin-left: 3px; color: var(--gold); }
.switch-setting { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; cursor: pointer; }
.switch-setting > span { display: flex; flex-direction: column; gap: 2px; }
.switch-setting strong { color: #9fb2b8; font-size: 8px; font-weight: 500; }
.switch-setting small { color: #566f79; font-size: 6px; }
.switch-setting input { display: none; }
.switch-setting > i { position: relative; width: 32px; height: 17px; background: #132a33; border: 1px solid rgba(119, 157, 169, .24); transition: .2s ease; }
.switch-setting > i::after { content: ''; position: absolute; left: 2px; top: 2px; width: 11px; height: 11px; background: #718790; transition: .2s ease; }
.switch-setting input:checked + i { background: rgba(82, 153, 164, .2); border-color: rgba(112, 201, 216, .5); }
.switch-setting input:checked + i::after { left: 17px; background: #7ccbd8; }

.import-progress { margin: 0 23px 10px; padding: 10px 12px; background: rgba(77, 129, 142, .04); border: 1px solid rgba(118, 164, 176, .16); }
.import-progress > div { display: flex; justify-content: space-between; color: #9bb1b7; font-size: 8px; }
.import-progress > div strong { color: #9ad3dd; font: 9px Electronic, monospace; }
.import-progress > i { display: block; height: 3px; margin-top: 7px; overflow: hidden; background: rgba(110, 151, 162, .12); }
.import-progress > i b { display: block; height: 100%; background: linear-gradient(90deg, #477e8b, #79cad8, var(--gold)); transition: width .16s linear; }
.import-progress > p { margin: 6px 0 0; color: #5b747e; font-size: 7px; }
.import-progress.success { border-color: rgba(105, 184, 147, .22); background: rgba(76, 142, 115, .045); }
.import-progress.success > div strong { color: #78c4a5; }
.import-progress.success > i b { background: #70bd9d; }

.import-dialog-footer { display: flex; align-items: center; gap: 9px; height: 68px; padding: 0 23px; background: rgba(2, 9, 14, .44); border-top: 1px solid rgba(122, 160, 171, .12); }
.demo-notice { display: flex; flex: 1; align-items: center; gap: 9px; }
.demo-notice > span { display: grid; place-items: center; width: 21px; height: 21px; color: var(--gold); font: italic 11px Georgia, serif; border: 1px solid rgba(227, 184, 90, .3); border-radius: 50%; }
.demo-notice p { display: flex; flex-direction: column; gap: 2px; margin: 0; color: #9b8f75; font-size: 8px; }
.demo-notice small { color: #5d6f73; font-size: 6px; }
.cancel-import, .confirm-import { height: 36px; padding: 0 18px; color: #8ea5ac; font-family: inherit; font-size: 9px; letter-spacing: .6px; background: rgba(95, 137, 149, .04); border: 1px solid rgba(119, 159, 170, .2); cursor: pointer; }
.cancel-import:hover { color: #d2dfe2; border-color: rgba(125, 177, 189, .38); }
.confirm-import { min-width: 110px; color: #e2eef0; background: linear-gradient(135deg, rgba(92, 161, 175, .25), rgba(52, 105, 118, .1)); border-color: rgba(117, 202, 217, .48); clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px)); }
.confirm-import:hover:not(:disabled) { background: linear-gradient(135deg, rgba(106, 185, 200, .34), rgba(52, 105, 118, .16)); }
.confirm-import:disabled { color: #576b72; background: rgba(67, 89, 96, .05); border-color: rgba(103, 128, 136, .13); cursor: not-allowed; }
.confirm-import > span { display: inline-block; margin-right: 5px; color: var(--gold); }
.button-spinner { width: 10px; height: 10px; vertical-align: -2px; border: 1px solid rgba(122, 205, 218, .25); border-top-color: #7dcdda; border-radius: 50%; animation: importSpin .7s linear infinite; }
@keyframes importSpin { to { transform: rotate(360deg); } }

.import-modal-enter-active, .import-modal-leave-active { transition: opacity .22s ease; }
.import-modal-enter-active .import-dialog, .import-modal-leave-active .import-dialog { transition: opacity .22s ease, transform .22s ease; }
.import-modal-enter-from, .import-modal-leave-to { opacity: 0; }
.import-modal-enter-from .import-dialog, .import-modal-leave-to .import-dialog { opacity: 0; transform: translateY(10px) scale(.985); }

@media (max-width: 1500px) {
  .top-header { grid-template-columns: 190px minmax(0, 1fr) 430px; }
  .system-state { gap: 12px; }
  .clock { padding-right: 12px; }
}

@media (max-width: 1220px) {
  .top-header { grid-template-columns: 175px minmax(0, 1fr) 276px; }
  .online { display: none; }
  .clock { display: none; }
  .system-state { gap: 8px; }
  .import-data-trigger { min-width: 112px; }
  .relief-entry { min-width: 136px; }
}

@media (max-height: 780px) {
  .import-modal-backdrop { padding: 16px; }
  .import-dialog { max-height: calc(100vh - 32px); }
  .import-dialog-header { height: 66px; }
  .import-steps { height: 52px; }
  .import-dialog-body { min-height: 278px; }
  .import-source-column, .import-config-column { padding-top: 13px; padding-bottom: 12px; }
  .file-drop-zone { height: 164px; }
  .drop-visual { height: 47px; margin-bottom: 3px; }
  .drop-visual svg { height: 40px; }
  .demo-file-button, .file-validation-card { height: 43px; }
  .import-dialog-footer { height: 58px; }
}
</style>
