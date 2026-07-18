<template>
  <main class="digital-twin-screen">
    <div class="ambient-grid"></div>
    <header class="top-header">
      <div class="system-brand">
        <div class="brand-mark"><span></span><span></span><span></span></div>
        <div>
          <strong>SRDT</strong>
          <small>DEEP ROCK DIGITAL TWIN</small>
        </div>
      </div>
      <div class="title-block">
        <p><i></i> DEEP ROCK INTELLIGENCE PLATFORM <i></i></p>
        <h1>深部巷道围岩损伤演化三维云图</h1>
        <div class="title-rule"><span></span></div>
      </div>
      <div class="system-state">
        <div class="clock"><strong>{{ clockTime }}</strong><small>{{ clockDate }}</small></div>
        <div class="online"><i></i><span>系统在线<br><small>SYSTEM ONLINE</small></span></div>
      </div>
    </header>

    <section class="dashboard-body">
      <aside class="side-column left-column">
        <section class="panel overview-panel">
          <PanelTitle code="01" title="工程概况" sub="PROJECT OVERVIEW" />
          <div class="project-name">
            <span class="project-icon">井</span>
            <div><strong>西翼 -860m 运输巷</strong><small>监测断面 K12+420</small></div>
            <em>Ⅰ级</em>
          </div>
          <div class="overview-grid">
            <div><span>埋深</span><strong>862<small> m</small></strong></div>
            <div><span>洞径</span><strong>6.4<small> m</small></strong></div>
            <div><span>围压</span><strong>{{ confiningPressure }}<small> MPa</small></strong></div>
            <div><span>进尺</span><strong>{{ advance }}<small> m</small></strong></div>
          </div>
        </section>

        <section class="panel load-panel">
          <PanelTitle code="02" title="多场载荷监测" sub="MULTI-FIELD LOAD" />
          <div class="load-kpis">
            <div class="load-row" v-for="item in loadItems" :key="item.label">
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

        <section class="panel trend-panel">
          <PanelTitle code="03" title="应力响应趋势" sub="STRESS RESPONSE" />
          <div class="chart-head"><span>切向应力 / MPa</span><strong>峰值 {{ cloudSample.peak }} MPa</strong></div>
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
            <circle :cx="trendLast.x" :cy="trendLast.y" r="3.5" fill="#061326" stroke="#ffb22b" stroke-width="2" />
          </svg>
          <div class="chart-axis"><span>T-30</span><span>T-20</span><span>T-10</span><span>NOW</span></div>
        </section>
      </aside>

      <section class="center-stage">
        <div class="scene-heading">
          <div>
            <span class="live-dot"></span>
            <p>三维计算域 <small>3D COMPUTATIONAL DOMAIN</small></p>
          </div>
          <nav class="metric-tabs">
            <button v-for="option in metricOptions" :key="option.key" :class="{ active: metric === option.key }" @click="metric = option.key">
              {{ option.label }}
            </button>
          </nav>
        </div>
        <div class="scene-frame">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <RockCloud3D
            :progress="progress"
            :metric="metric"
            :slice="slice"
            :auto-rotate="autoRotate"
            :view-mode="viewMode"
            @sample="cloudSample = $event"
          />
          <div class="model-tag tag-load"><span>P₀</span><i></i>等效围压 {{ confiningPressure }} MPa</div>
          <div class="model-tag tag-face"><span>σ<sub>max</sub></span><i></i>应力集中区</div>
          <div class="model-tag tag-sensor"><span>S-04</span><i></i>微震阵列</div>
          <div class="axis-widget"><b class="axis-z">Z</b><b class="axis-y">Y</b><b class="axis-x">X</b><i></i></div>
          <div class="cloud-legend">
            <div class="legend-title"><span>{{ activeMetric.label }}</span><small>{{ activeMetric.unit }}</small></div>
            <div class="legend-scale"></div>
            <div class="legend-labels"><span v-for="tick in activeMetric.ticks" :key="tick">{{ tick }}</span></div>
          </div>
          <div class="scene-data-strip">
            <div><span>网格单元</span><strong>48,960</strong></div>
            <div><span>计算步</span><strong>{{ stepLabel }}</strong></div>
            <div><span>收敛误差</span><strong>2.8e-⁵</strong></div>
            <div><span>刷新率</span><strong>60 FPS</strong></div>
          </div>
        </div>
        <div class="scene-controls">
          <div class="view-switch">
            <button v-for="view in views" :key="view.key" :class="{ active: viewMode === view.key }" @click="viewMode = view.key">
              <span>{{ view.icon }}</span>{{ view.label }}
            </button>
          </div>
          <label class="slice-control">
            <span>剖切位置</span>
            <input v-model.number="slice" type="range" min="0" max="100" />
            <em>{{ slice }}%</em>
          </label>
          <button class="rotate-toggle" :class="{ active: autoRotate }" @click="autoRotate = !autoRotate"><i>↻</i>{{ autoRotate ? '自动旋转' : '旋转已停' }}</button>
        </div>
      </section>

      <aside class="side-column right-column">
        <section class="panel damage-panel">
          <PanelTitle code="04" title="破坏分区识别" sub="DAMAGE ZONING" />
          <div class="damage-viz">
            <div class="damage-rings" :style="{ '--evolution': progress / 100 }">
              <i class="ring elastic"></i><i class="ring damage"></i><i class="ring plastic"></i><span class="tunnel-hole"></span>
              <b class="scan-line"></b>
            </div>
            <div class="damage-value"><span>塑性区半径</span><strong>{{ cloudSample.plasticRadius }}<em> m</em></strong></div>
          </div>
          <div class="zone-legend">
            <div><i class="plastic-color"></i><span>塑性区</span><strong>{{ zoneRatios[0] }}%</strong></div>
            <div><i class="damage-color"></i><span>损伤区</span><strong>{{ zoneRatios[1] }}%</strong></div>
            <div><i class="elastic-color"></i><span>弹性区</span><strong>{{ zoneRatios[2] }}%</strong></div>
          </div>
        </section>

        <section class="panel sensor-panel">
          <PanelTitle code="05" title="传感器阵列" sub="SENSOR MATRIX" />
          <div class="sensor-head"><span>点位</span><span>实时值</span><span>状态</span></div>
          <div class="sensor-item" v-for="sensor in sensorItems" :key="sensor.id">
            <span><i :class="sensor.state"></i>{{ sensor.id }}</span>
            <strong>{{ sensor.value }}<small>{{ sensor.unit }}</small></strong>
            <em :class="sensor.state">{{ sensor.state === 'warn' ? '关注' : '正常' }}</em>
          </div>
        </section>

        <section class="panel warning-panel" :class="riskLevel.className">
          <div class="warning-signal"><span></span><i>!</i></div>
          <div class="warning-copy">
            <small>INTELLIGENT EARLY WARNING</small>
            <strong>{{ riskLevel.title }}</strong>
            <p>{{ riskLevel.message }}</p>
          </div>
          <div class="risk-score"><strong>{{ riskScore }}</strong><span>风险指数</span></div>
        </section>
      </aside>
    </section>

    <footer class="evolution-footer">
      <div class="evolution-title">
        <button class="play-button" @click="playing = !playing"><span>{{ playing ? 'Ⅱ' : '▶' }}</span></button>
        <div><strong>围岩演化推演</strong><small>ROCK MASS EVOLUTION</small></div>
      </div>
      <div class="timeline-wrap">
        <div class="timeline-labels"><span>开挖扰动</span><span>应力重分布</span><span>损伤萌生</span><span>塑性扩展</span><span>趋于稳定</span></div>
        <input v-model.number="progress" class="evolution-range" type="range" min="0" max="100" step="0.1" />
        <div class="timeline-points"><i v-for="n in 5" :key="n" :class="{ passed: progress >= (n - 1) * 25 }"></i></div>
        <div class="timeline-time"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
      </div>
      <div class="progress-readout">
        <span>演化进度</span>
        <strong>{{ progress.toFixed(1) }}<em>%</em></strong>
        <small>STEP {{ stepLabel }} / 120</small>
      </div>
    </footer>
  </main>
</template>

<script setup>
import { computed, defineComponent, h, onBeforeUnmount, ref } from 'vue'
import RockCloud3D from '@/components/RockCloud3D.vue'

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

const progress = ref(38.6)
const playing = ref(true)
const metric = ref('stress')
const slice = ref(0)
const autoRotate = ref(true)
const viewMode = ref('cloud')
const now = ref(new Date())
const cloudSample = ref({ peak: 60, plasticRadius: '1.96' })

const metricOptions = [
  { key: 'stress', label: '等效应力', unit: 'MPa', ticks: ['80', '64', '48', '32', '16', '0'] },
  { key: 'displacement', label: '位移场', unit: 'mm', ticks: ['42', '34', '25', '17', '8', '0'] },
  { key: 'plastic', label: '塑性应变', unit: '%', ticks: ['2.5', '2.0', '1.5', '1.0', '0.5', '0'] }
]

const views = [
  { key: 'cloud', label: '整体云图', icon: '◈' },
  { key: 'section', label: '剖面模式', icon: '◫' },
  { key: 'iso', label: '等值面', icon: '◎' }
]

const activeMetric = computed(() => metricOptions.find((item) => item.key === metric.value))
const confiningPressure = computed(() => (22.8 + progress.value * 0.048).toFixed(1))
const advance = computed(() => (438.6 + progress.value * 0.017).toFixed(1))
const stepLabel = computed(() => String(Math.round(progress.value * 1.2)).padStart(3, '0'))
const clockTime = computed(() => now.value.toLocaleTimeString('zh-CN', { hour12: false }))
const clockDate = computed(() => now.value.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '.'))

const loadItems = computed(() => [
  { icon: 'σ', label: '垂直应力', sub: 'VERTICAL', value: (28.4 + progress.value * .031).toFixed(1), unit: 'MPa', level: 6, tone: 'cyan' },
  { icon: '↔', label: '水平应力', sub: 'HORIZONTAL', value: (21.6 + progress.value * .024).toFixed(1), unit: 'MPa', level: 5, tone: 'blue' },
  { icon: '⌁', label: '微震能量', sub: 'MICROSEISMIC', value: (4.2 + progress.value * .068).toFixed(1), unit: 'kJ', level: progress.value > 64 ? 7 : 4, tone: progress.value > 64 ? 'orange' : 'cyan' }
])

const trendValues = computed(() => Array.from({ length: 22 }, (_, index) => {
  const rising = index * (0.9 + progress.value * .008)
  const ripple = Math.sin(index * .86 + progress.value * .07) * 4.3 + Math.cos(index * .31) * 2.2
  return 19 + rising + ripple
}))

const trendCoordinates = computed(() => {
  const values = trendValues.value
  const max = Math.max(...values) * 1.08
  return values.map((value, index) => ({ x: index / (values.length - 1) * 280, y: 94 - value / max * 82 }))
})
const trendPoints = computed(() => trendCoordinates.value.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '))
const trendArea = computed(() => `0,98 ${trendPoints.value} 280,98`)
const trendLast = computed(() => trendCoordinates.value.at(-1))

const zoneRatios = computed(() => {
  const plastic = Math.round(9 + progress.value * .16)
  const damage = Math.round(18 + progress.value * .09)
  return [plastic, damage, 100 - plastic - damage]
})

const sensorItems = computed(() => [
  { id: 'S-01 拱顶', value: (1.12 + progress.value * .013).toFixed(2), unit: 'mm', state: 'normal' },
  { id: 'S-02 左帮', value: (1.68 + progress.value * .017).toFixed(2), unit: 'mm', state: progress.value > 76 ? 'warn' : 'normal' },
  { id: 'S-03 右帮', value: (1.44 + progress.value * .012).toFixed(2), unit: 'mm', state: 'normal' },
  { id: 'S-04 底板', value: (2.16 + progress.value * .024).toFixed(2), unit: 'mm', state: progress.value > 58 ? 'warn' : 'normal' }
])

const riskScore = computed(() => Math.min(96, Math.round(28 + progress.value * .58)))
const riskLevel = computed(() => {
  if (riskScore.value >= 72) return { className: 'danger', title: 'Ⅱ级 · 橙色预警', message: '左帮塑性区加速扩展，建议降低推进速率并复核支护参数。' }
  if (riskScore.value >= 52) return { className: 'attention', title: 'Ⅲ级 · 黄色关注', message: '局部应力持续积聚，当前仍处于可控演化区间。' }
  return { className: 'stable', title: 'Ⅳ级 · 状态稳定', message: '围岩响应平稳，各监测量处于正常阈值范围。' }
})

const clockTimer = window.setInterval(() => { now.value = new Date() }, 1000)
const evolutionTimer = window.setInterval(() => {
  if (!playing.value) return
  progress.value = progress.value >= 100 ? 0 : Number((progress.value + .12).toFixed(2))
}, 120)

onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
  window.clearInterval(evolutionTimer)
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
.title-rule { position: absolute; bottom: -1px; width: 48%; height: 3px; background: linear-gradient(90deg, transparent, rgba(45, 191, 244, .4), transparent); }
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
.legend-labels { display: flex; flex-direction: column; justify-content: space-between; color: #89aab9; font: 8px Electronic, monospace; }
.scene-data-strip { position: absolute; z-index: 5; left: 50%; bottom: 12px; display: flex; transform: translateX(-50%); background: rgba(3, 15, 28, .76); border: 1px solid rgba(65, 164, 205, .18); pointer-events: none; }
.scene-data-strip div { min-width: 82px; padding: 5px 9px; border-right: 1px solid rgba(65, 164, 205, .14); }.scene-data-strip div:last-child { border: 0; }
.scene-data-strip span { display: block; color: #4f7689; font-size: 7px; }.scene-data-strip strong { color: #aeeaff; font: 10px Electronic, monospace; }
.axis-widget { position: absolute; z-index: 5; left: 18px; bottom: 18px; width: 52px; height: 52px; pointer-events: none; }
.axis-widget i, .axis-widget::before, .axis-widget::after { content: ''; position: absolute; left: 25px; bottom: 18px; width: 27px; height: 1px; transform-origin: left; background: #ff3b38; }
.axis-widget::before { background: #38ef89; transform: rotate(-90deg); }.axis-widget::after { background: #3e78ff; transform: rotate(-145deg); }
.axis-widget b { position: absolute; font-size: 8px; }.axis-x { right: -2px; bottom: 13px; color: #ff625f; }.axis-y { left: 20px; top: 1px; color: #48ef98; }.axis-z { left: -1px; bottom: 31px; color: #5f8fff; }
.scene-controls { display: flex; align-items: center; gap: 12px; height: 42px; padding: 0 8px; border: 1px solid rgba(65, 164, 205, .2); background: rgba(4, 19, 35, .8); }
.view-switch { display: flex; gap: 3px; }.view-switch button, .rotate-toggle { height: 27px; padding: 0 8px; color: #557f94; font-size: 8px; border: 1px solid rgba(70, 156, 192, .15); background: rgba(20, 58, 81, .24); cursor: pointer; }.view-switch button span { margin-right: 4px; font-size: 10px; }.view-switch button.active, .rotate-toggle.active { color: #bcf3ff; border-color: rgba(62, 206, 244, .44); background: rgba(26, 142, 182, .2); }
.slice-control { flex: 1; display: flex; align-items: center; gap: 8px; color: #557e92; font-size: 8px; }.slice-control input { flex: 1; accent-color: #36d8ff; height: 3px; }.slice-control em { width: 28px; color: #8ccbdd; font: 8px Electronic, monospace; font-style: normal; }.rotate-toggle { flex: 0 0 auto; }.rotate-toggle i { margin-right: 4px; color: #42dfff; font-size: 12px; font-style: normal; }

.damage-panel { flex: 1.15; }
.damage-viz { display: flex; align-items: center; padding: 9px 12px 4px; }
.damage-rings { --evolution: .4; position: relative; width: 112px; height: 112px; flex: 0 0 112px; border-radius: 50%; background: repeating-radial-gradient(circle, transparent 0 8px, rgba(85, 183, 221, .07) 9px 10px); }
.ring, .tunnel-hole { position: absolute; left: 50%; top: 50%; border-radius: 50%; transform: translate(-50%, -50%); }
.ring.elastic { width: calc(96px + var(--evolution) * 10px); height: calc(96px + var(--evolution) * 10px); background: rgba(47, 194, 103, .16); border: 9px solid rgba(56, 207, 111, .44); box-shadow: 0 0 12px rgba(44, 214, 108, .18); }
.ring.damage { width: calc(70px + var(--evolution) * 10px); height: calc(70px + var(--evolution) * 10px); background: rgba(255, 197, 38, .18); border: 10px solid rgba(255, 194, 35, .68); }
.ring.plastic { width: calc(43px + var(--evolution) * 15px); height: calc(43px + var(--evolution) * 15px); background: rgba(255, 94, 32, .3); border: 8px solid rgba(255, 104, 38, .77); }
.tunnel-hole { width: 24px; height: 24px; background: #030b15; border: 2px solid #ffca4d; box-shadow: 0 0 10px rgba(255, 144, 34, .6); }
.scan-line { position: absolute; left: 56px; top: 8px; width: 1px; height: 48px; transform-origin: bottom; background: linear-gradient(to top, #68e6ff, transparent); animation: radarScan 4s linear infinite; }
@keyframes radarScan { to { transform: rotate(360deg); } }
.damage-value { flex: 1; padding-left: 12px; }
.damage-value span { display: block; color: #6891a4; font-size: 9px; }.damage-value strong { display: block; margin-top: 5px; color: #ffbb38; font: 24px Electronic, monospace; text-shadow: 0 0 12px rgba(255, 160, 40, .32); }.damage-value em { color: #6d91a1; font: 9px sans-serif; font-style: normal; }
.zone-legend { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 0 10px 9px; }
.zone-legend div { padding: 5px; background: rgba(15, 47, 68, .3); border: 1px solid rgba(62, 139, 170, .12); }.zone-legend i { display: inline-block; width: 6px; height: 6px; margin-right: 4px; }.zone-legend span { color: #7397a7; font-size: 8px; }.zone-legend strong { display: block; margin: 2px 0 0 10px; font: 12px Electronic, monospace; color: #d9f7ff; }.plastic-color { background: #ff6725; }.damage-color { background: #ffc52a; }.elastic-color { background: #36ce74; }

.sensor-panel { flex: 1; }
.sensor-head, .sensor-item { display: grid; grid-template-columns: 1.4fr .8fr .55fr; align-items: center; column-gap: 5px; padding: 0 12px; }
.sensor-head { height: 25px; color: #426d82; font-size: 7px; border-bottom: 1px solid rgba(68, 147, 180, .12); }.sensor-head span:nth-child(n+2) { text-align: right; }
.sensor-item { height: calc((100% - 66px) / 4); min-height: 25px; color: #89adbd; font-size: 8px; border-bottom: 1px solid rgba(68, 147, 180, .08); }.sensor-item > span { display: flex; align-items: center; gap: 5px; }.sensor-item > span i { width: 5px; height: 5px; border-radius: 50%; background: #48e59d; box-shadow: 0 0 5px #48e59d; }.sensor-item > span i.warn { background: #ffac32; box-shadow: 0 0 5px #ffac32; }.sensor-item strong { text-align: right; color: #d9f6ff; font: 11px Electronic, monospace; }.sensor-item strong small { margin-left: 2px; color: #52798c; font: 7px sans-serif; }.sensor-item em { justify-self: end; padding: 2px 4px; color: #4bdc9c; background: rgba(49, 219, 146, .08); font-size: 7px; font-style: normal; }.sensor-item em.warn { color: #ffb33a; background: rgba(255, 171, 48, .1); }

.warning-panel { flex: .68; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-color: rgba(255, 184, 48, .25); background: linear-gradient(100deg, rgba(66, 42, 12, .44), rgba(12, 23, 35, .72)); }.warning-panel::before, .warning-panel::after { background: #ffb536; }
.warning-signal { position: relative; display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 42px; }.warning-signal span { position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(255, 182, 46, .4); animation: signalPulse 1.8s infinite; }.warning-signal i { display: grid; place-items: center; width: 26px; height: 26px; color: #151007; font: 700 17px sans-serif; font-style: normal; clip-path: polygon(50% 0, 100% 100%, 0 100%); background: #ffb533; padding-top: 5px; }.warning-copy { flex: 1; min-width: 0; }.warning-copy small { display: block; color: #815f2a; font-size: 6px; letter-spacing: 1px; }.warning-copy strong { color: #ffc14a; font-size: 11px; }.warning-copy p { margin: 3px 0 0; color: #846f51; font-size: 7px; line-height: 1.4; }.risk-score { text-align: center; }.risk-score strong { display: block; color: #ffc14a; font: 22px Electronic, monospace; }.risk-score span { color: #7b6441; font-size: 7px; }.warning-panel.stable { border-color: rgba(52, 220, 145, .25); }.warning-panel.stable::before, .warning-panel.stable::after { background: #3cdd97; }.warning-panel.stable .warning-signal i { background: #3cdd97; }.warning-panel.stable .warning-copy strong, .warning-panel.stable .risk-score strong { color: #53e4a5; }.warning-panel.danger { animation: warnGlow 2s ease-in-out infinite; }
@keyframes signalPulse { 70%, 100% { inset: -9px; opacity: 0; } } @keyframes warnGlow { 50% { box-shadow: inset 0 0 25px rgba(255, 121, 28, .1), 0 0 12px rgba(255, 121, 28, .08); } }

.evolution-footer { position: relative; z-index: 5; display: grid; grid-template-columns: 225px 1fr 150px; align-items: center; gap: 16px; height: 90px; padding: 6px 25px 8px; background: linear-gradient(180deg, rgba(4, 18, 33, .78), rgba(3, 12, 24, .98)); border-top: 1px solid rgba(61, 177, 221, .23); }
.evolution-footer::before { content: ''; position: absolute; left: 25%; right: 25%; top: -1px; height: 2px; background: linear-gradient(90deg, transparent, #3bdcff, transparent); }
.evolution-title { display: flex; align-items: center; gap: 11px; }.play-button { display: grid; place-items: center; width: 42px; height: 42px; color: #b9f2ff; background: rgba(30, 148, 191, .14); border: 1px solid rgba(58, 213, 249, .5); clip-path: polygon(10% 0, 90% 0, 100% 20%, 100% 80%, 90% 100%, 10% 100%, 0 80%, 0 20%); cursor: pointer; }.play-button:hover { background: rgba(37, 185, 229, .28); }.play-button span { font-size: 13px; }.evolution-title strong { display: block; font-size: 13px; letter-spacing: 2px; }.evolution-title small { color: #3e6c82; font-size: 7px; letter-spacing: 1px; }
.timeline-wrap { position: relative; padding: 0 8px; }.timeline-labels, .timeline-time { display: flex; justify-content: space-between; color: #7699a9; font-size: 8px; }.timeline-time { color: #355d71; font: 7px Electronic, monospace; }.evolution-range { position: relative; z-index: 2; display: block; width: 100%; height: 3px; margin: 10px 0 8px; accent-color: #3cddff; cursor: pointer; }.timeline-points { position: absolute; z-index: 1; left: 10px; right: 10px; top: 28px; display: flex; justify-content: space-between; pointer-events: none; }.timeline-points i { width: 9px; height: 9px; border-radius: 50%; background: #102c40; border: 1px solid #2c708d; }.timeline-points i.passed { background: #50dcff; border-color: #8aeaff; box-shadow: 0 0 8px rgba(61, 220, 255, .75); }
.progress-readout { padding-left: 17px; border-left: 1px solid rgba(67, 147, 181, .2); }.progress-readout span { display: block; color: #567e91; font-size: 8px; }.progress-readout strong { display: block; color: #7beaff; font: 25px Electronic, monospace; text-shadow: 0 0 12px rgba(71, 220, 255, .35); }.progress-readout strong em { margin-left: 3px; font-size: 10px; font-style: normal; }.progress-readout small { color: #375e71; font: 7px Electronic, monospace; }

@media (max-height: 820px) {
  .top-header { height: 64px; }
  .dashboard-body { height: calc(100vh - 144px); }
  .evolution-footer { height: 80px; }
  .panel-title { height: 34px; }
  .project-name { margin-top: 6px; margin-bottom: 5px; }
  .overview-grid div { padding-top: 3px; padding-bottom: 3px; }
  .load-row { padding: 3px 0; }
  .damage-rings { transform: scale(.88); margin: -6px; }
  .zone-legend div { padding: 3px; }
}
</style>
