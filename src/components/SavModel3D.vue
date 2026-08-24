<template>
  <div ref="container" class="sav-model-canvas" :class="{ 'phase-after': isAfter }">
    <header class="model-header">
      <div>
        <span>{{ isAfter ? 'RELIEF EFFECT / FLAC3D SAV' : 'FLAC3D / SAV' }}</span>
        <strong>{{ modelTitle }}</strong>
        <small>{{ sourceSummary }}</small>
      </div>
      <div class="load-state" :class="loadState">
        <i></i>
        <span>{{ stateLabel }}</span>
        <strong v-if="loadState === 'loading'">{{ loadProgress }}%</strong>
      </div>
    </header>

    <div v-if="loadState === 'loading'" class="loading-track">
      <i :style="{ width: `${loadProgress}%` }"></i>
    </div>

    <div v-if="loadState === 'pending' || loadState === 'error'" class="model-fallback">
      <span class="fallback-code">{{ loadState === 'pending' ? 'SAV / GLB' : 'LOAD ERROR' }}</span>
      <strong>{{ loadState === 'pending' ? 'SAV 转换产物尚未生成' : '模型加载失败' }}</strong>
      <p>{{ errorMessage }}</p>
      <code>{{ manifestUrl }}</code>
    </div>

    <div v-if="loadState === 'ready'" class="stress-legend">
      <span>高</span>
      <i></i>
      <span>低</span>
      <strong>σ<sub>{{ pyvistaManifest ? 'v' : '3' }}</sub></strong>
      <small>{{ stressRangeLabel }}</small>
    </div>

    <aside
      v-if="loadState === 'ready' && targetInfo && showTargetPanel"
      class="target-identification"
      :class="{ active: targetActive }"
    >
      <button type="button" @click="toggleTargetIdentification">
        <i class="target-button-icon" aria-hidden="true"></i>
        <span>
          <strong>{{ targetButtonLabel }}</strong>
          <small>
            σ ≥ {{ displayTargetInfo.thresholdMultiplier.toFixed(1) }} × 平均应力
            · 距巷道 ≤ {{ targetInfo.roadwayInfluenceDistanceM.toFixed(1) }} m
          </small>
        </span>
      </button>
      <div v-if="targetActive" class="target-results">
        <div>
          <span>{{ isAfter ? '基准平均' : '平均应力' }}</span>
          <strong>{{ formatStress(displayTargetInfo.averageStressMpa) }}</strong>
        </div>
        <div>
          <span>{{ isAfter ? '残余阈值' : '识别阈值' }}</span>
          <strong>{{ formatStress(displayTargetInfo.thresholdStressMpa) }}</strong>
        </div>
        <div>
          <span>{{ isAfter ? '残余峰值' : '峰值应力' }}</span>
          <strong class="peak">{{ formatStress(displayTargetInfo.peakStressMpa) }}</strong>
        </div>
        <footer>
          <span>{{ formatCount(displayTargetInfo.highStressZoneCount) }} 个高应力体单元</span>
          <strong>占有效体单元 {{ targetRatioLabel }}</strong>
        </footer>
      </div>
    </aside>

    <div ref="targetMarker" class="target-marker" aria-hidden="true">
      <i></i>
      <span>
        <strong>{{ isAfter ? '残余峰值' : '峰值应力' }}</strong>
        <small>{{ formatStress(displayTargetInfo?.peakStressMpa) }}</small>
      </span>
    </div>

    <div v-if="loadState === 'ready'" class="model-toolbar">
      <div class="surface-switch" role="group" aria-label="表面显示模式">
        <button
          v-for="option in surfaceOptions"
          :key="option.value"
          type="button"
          :class="{ active: surfaceMode === option.value }"
          @click="surfaceMode = option.value"
        >{{ option.label }}</button>
      </div>
      <button
        class="tool-toggle"
        type="button"
        :class="{ active: wireframe }"
        title="切换线框"
        @click="wireframe = !wireframe"
      >线框</button>
      <button
        class="tool-toggle"
        type="button"
        :class="{ active: autoRotate }"
        title="切换自动旋转"
        @click="autoRotate = !autoRotate"
      >{{ autoRotate ? '停止旋转' : '自动旋转' }}</button>
      <button class="reset-view" type="button" title="重置视角" @click="fitCamera">重置视角</button>
    </div>

    <div v-if="loadState === 'ready'" class="model-stats">
      <div><span>巷道表面</span><strong>{{ formatCount(manifest?.model?.roadwayFaceCount) }}<small> 面</small></strong></div>
      <div><span>有效体单元</span><strong>{{ formatCount(manifest?.model?.activeZoneCount) }}<small> 个</small></strong></div>
      <div><span>坐标单位</span><strong>{{ manifest?.model?.coordinateUnit || 'm' }}</strong></div>
    </div>

    <div v-if="loadState === 'ready' && showReliefPlan" class="relief-legend">
      <strong>{{ reliefVariant === 'inclined' ? '倾斜卸压孔组' : '变径卸压孔组' }}</strong>
      <span><i class="collar"></i>孔口</span>
      <span><i class="pilot"></i>钻进段 60 mm</span>
      <span><i class="change"></i>变径点</span>
      <span><i class="relief"></i>卸压段 300 mm</span>
    </div>

    <div class="view-hint" :class="{ visible: hovered }">
      <span>拖拽旋转</span><i></i><span>滚轮缩放</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const props = defineProps({
  manifestUrl: {
    type: String,
    default: () => `${import.meta.env.BASE_URL}models/xieyaqian/manifest.json`
  },
  phase: {
    type: String,
    default: 'before',
    validator: (value) => ['before', 'after'].includes(value)
  },
  defaultTargetActive: {
    type: Boolean,
    default: false
  },
  targetVisible: {
    type: Boolean,
    default: null
  },
  showTargetPanel: {
    type: Boolean,
    default: true
  },
  showReliefPlan: {
    type: Boolean,
    default: false
  },
  reliefPlan: {
    type: Array,
    default: () => []
  },
  reliefVariant: {
    type: String,
    default: 'straight',
    validator: (value) => ['straight', 'inclined'].includes(value)
  }
})

const emit = defineEmits(['status', 'target-change'])
const container = ref(null)
const targetMarker = ref(null)
const manifest = ref(null)
const pyvistaManifest = ref(null)
const loadState = ref('loading')
const loadProgress = ref(0)
const errorMessage = ref('')
const hovered = ref(false)
const surfaceMode = ref('all')
const wireframe = ref(false)
const autoRotate = ref(false)
const targetActive = ref(props.targetVisible ?? props.defaultTargetActive)
const renderedZoneCount = ref(0)
const renderedPeakStress = ref(null)

const surfaceOptions = [
  { value: 'all', label: '综合三维' },
  { value: 'roadway', label: '切面分析' },
  { value: 'exterior', label: '围岩外壳' }
]

const isAfter = computed(() => props.phase === 'after')
const modelTitle = computed(() => (
  isAfter.value
    ? '800米埋深巷道卸压后数值演示模型'
    : '800米埋深巷道卸压前数值演示模型'
))

const sourceSummary = computed(() => {
  const source = manifest.value?.source
  if (!source) return '正在读取模型清单'
  return `${source.name} · ${source.product} ${source.version}`
})

const stateLabel = computed(() => {
  if (loadState.value === 'ready') {
    return isAfter.value ? '卸压后模型已载入' : '卸压前模型已载入'
  }
  return ({
    loading: '模型载入中',
    pending: '等待 FLAC3D 导出',
    error: '载入失败'
  })[loadState.value] || '初始化'
})

const stressRangeLabel = computed(() => {
  const range = targetActive.value && displayTargetInfo.value
    ? [
        displayTargetInfo.value.thresholdStressMpa,
        displayTargetInfo.value.peakStressMpa
      ]
    : pyvistaManifest.value?.field?.range || manifest.value?.field?.range
  if (!Array.isArray(range) || range.length < 2) return 'MPa'
  return `${Number(range[0]).toFixed(1)}–${Number(range[1]).toFixed(1)} MPa`
})

const targetInfo = computed(() => manifest.value?.targetIdentification || null)
const displayTargetInfo = computed(() => {
  const info = targetInfo.value
  if (!info) return null
  const highStressLayer = pyvistaManifest.value?.layers?.highStressSolid
  const stressRange = highStressLayer?.stressRangeMpa
  const zoneCount = renderedZoneCount.value || info.highStressZoneCount
  const activeZoneCount = Number(manifest.value?.model?.activeZoneCount || info.activeZoneCount)
  const thresholdStressMpa = Array.isArray(stressRange)
    ? Number(stressRange[0])
    : info.thresholdStressMpa
  return {
    ...info,
    averageStressMpa: highStressLayer
      ? thresholdStressMpa / Number(info.thresholdMultiplier || 1.2)
      : info.averageStressMpa,
    thresholdStressMpa,
    peakStressMpa: renderedPeakStress.value ?? info.peakStressMpa,
    highStressZoneCount: zoneCount,
    activeZoneCount,
    activeZoneRatio: zoneCount / Math.max(activeZoneCount, 1)
  }
})
const targetButtonLabel = computed(() => {
  if (!targetActive.value) {
    return isAfter.value ? '显示卸压后残余应力区' : '识别高应力靶区'
  }
  return isAfter.value ? '卸压后残余应力区' : '高应力靶区已锁定'
})
const targetRatioLabel = computed(() => {
  const ratio = Number(displayTargetInfo.value?.activeZoneRatio)
  return Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '--'
})

let scene
let camera
let renderer
let controls
let animationFrame
let resizeObserver
let modelRoot
let abortController
let modelBounds
let targetPosition
let highStressVolume
let highStressHalo
let boundsHelper
let axesHelper
const sliceGridLines = []
const tunnelOutlineLines = []
let reliefPlanGroup
const roadwayMeshes = []
const exteriorMeshes = []
const legacyHighStressMeshes = []

function setState(state, message = '') {
  loadState.value = state
  errorMessage.value = message
  emit('status', {
    state,
    message,
    manifest: manifest.value,
    phase: props.phase,
    metrics: displayTargetInfo.value
  })
}

function formatCount(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '--'
}

function formatStress(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(2)} MPa` : '--'
}

function resolveModelUrl(relativeUrl) {
  return new URL(relativeUrl, new URL(props.manifestUrl, window.location.href)).href
}

async function fetchArrayBuffer(relativeUrl) {
  const response = await fetch(resolveModelUrl(relativeUrl), {
    cache: 'force-cache',
    signal: abortController.signal
  })
  if (!response.ok) throw new Error(`三维图层请求失败（HTTP ${response.status}）`)
  return response.arrayBuffer()
}

function parseMeshBuffer(buffer) {
  const view = new DataView(buffer)
  const vertexCount = view.getUint32(0, true)
  const indexCount = view.getUint32(4, true)
  const positionOffset = 8
  const scalarOffset = positionOffset + vertexCount * 3 * 4
  const indexOffset = scalarOffset + vertexCount * 4
  const expectedBytes = indexOffset + indexCount * 4
  if (buffer.byteLength !== expectedBytes) {
    throw new Error('三维网格二进制长度不匹配')
  }
  return {
    positions: new Float32Array(buffer, positionOffset, vertexCount * 3),
    scalars: new Float32Array(buffer, scalarOffset, vertexCount),
    indices: new Uint32Array(buffer, indexOffset, indexCount)
  }
}

function parseLineBuffer(buffer) {
  const view = new DataView(buffer)
  const pointCount = view.getUint32(0, true)
  const expectedBytes = 4 + pointCount * 3 * 4
  if (buffer.byteLength !== expectedBytes || pointCount % 2 !== 0) {
    throw new Error('三维线框二进制长度不匹配')
  }
  return new Float32Array(buffer, 4, pointCount * 3)
}

function makeStressColors(values, range, palette) {
  const colors = new Float32Array(values.length * 3)
  const stops = palette.map((value) => new THREE.Color(value))
  const minimum = Number(range[0])
  const maximum = Number(range[1])
  const span = Math.max(maximum - minimum, 1e-6)
  const color = new THREE.Color()

  for (let index = 0; index < values.length; index += 1) {
    const scaled = THREE.MathUtils.clamp((values[index] - minimum) / span, 0, 1)
    const stopPosition = scaled * (stops.length - 1)
    const lowerIndex = Math.min(Math.floor(stopPosition), stops.length - 2)
    color.lerpColors(stops[lowerIndex], stops[lowerIndex + 1], stopPosition - lowerIndex)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }
  return colors
}

async function createStressLayer(config, name, renderOrder) {
  const data = parseMeshBuffer(await fetchArrayBuffer(config.url))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(
      makeStressColors(
        data.scalars,
        pyvistaManifest.value.field.range,
        pyvistaManifest.value.colormap
      ),
      3
    )
  )
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
  geometry.computeBoundingSphere()

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: Number(config.opacity),
    depthWrite: renderOrder !== 1
  })
  material.userData.baseOpacity = material.opacity
  material.userData.baseTransparent = true
  material.userData.baseDepthWrite = material.depthWrite

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.renderOrder = renderOrder
  modelRoot.add(mesh)
  return mesh
}

async function createSolidLayer(config, name, options = {}) {
  const data = parseMeshBuffer(await fetchArrayBuffer(config.url))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  const material = new THREE.MeshPhongMaterial({
    color: options.color || config.color || '#ffffff',
    emissive: options.emissive || '#000000',
    emissiveIntensity: options.emissiveIntensity || 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: Number(config.opacity),
    depthWrite: false,
    shininess: options.shininess ?? 24
  })
  material.userData.baseOpacity = material.opacity
  material.userData.baseTransparent = true
  material.userData.baseDepthWrite = false

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.renderOrder = options.renderOrder || 4
  modelRoot.add(mesh)
  return mesh
}

async function createLineLayer(relativeUrl, name, color, opacity, renderOrder) {
  const positions = parseLineBuffer(await fetchArrayBuffer(relativeUrl))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false
  })
  const lines = new THREE.LineSegments(geometry, material)
  lines.name = name
  lines.renderOrder = renderOrder
  modelRoot.add(lines)
  return lines
}

function addSceneGuides() {
  const bounds = pyvistaManifest.value?.bounds
  if (!Array.isArray(bounds) || bounds.length !== 2) return
  const box = new THREE.Box3(
    new THREE.Vector3(...bounds[0]),
    new THREE.Vector3(...bounds[1])
  )
  boundsHelper = new THREE.Box3Helper(box, '#8b9aa0')
  boundsHelper.material.transparent = true
  boundsHelper.material.opacity = 0.58
  boundsHelper.material.depthWrite = false
  boundsHelper.renderOrder = 7
  modelRoot.add(boundsHelper)

  const size = box.getSize(new THREE.Vector3())
  axesHelper = new THREE.AxesHelper(Math.max(size.length() * 0.09, 2.4))
  axesHelper.position.copy(box.min)
  axesHelper.renderOrder = 8
  modelRoot.add(axesHelper)
}

async function loadPyvistaLayers() {
  const layersUrl = manifest.value?.model?.pyvistaLayers
  if (!layersUrl) return false
  const response = await fetch(resolveModelUrl(layersUrl), {
    cache: 'no-store',
    signal: abortController.signal
  })
  if (!response.ok) throw new Error(`PyVista 图层清单请求失败（HTTP ${response.status}）`)
  pyvistaManifest.value = await response.json()
  const layers = pyvistaManifest.value.layers

  modelRoot = new THREE.Group()
  modelRoot.name = `${manifest.value?.source?.name || 'flac3d-sav'}-${props.phase}-pyvista`
  scene.add(modelRoot)

  const outerShell = await createStressLayer(layers.outerShell, 'PyVistaOuterShell', 1)
  exteriorMeshes.push(outerShell)
  loadProgress.value = 30

  for (const [key, label] of [
    ['sliceX', 'X'],
    ['sliceY', 'Y'],
    ['sliceZ', 'Z']
  ]) {
    const config = layers[key]
    const slice = await createStressLayer(config, `PyVistaSlice${label}`, 2)
    roadwayMeshes.push(slice)
    const grid = await createLineLayer(
      config.gridUrl,
      `PyVistaSlice${label}Grid`,
      '#15242b',
      0.26,
      3
    )
    sliceGridLines.push(grid)
  }
  loadProgress.value = 68

  const tunnelWall = await createSolidLayer(layers.tunnelWall, 'PyVistaTunnelWall', {
    color: '#ffffff',
    shininess: 40,
    renderOrder: 4
  })
  roadwayMeshes.push(tunnelWall)
  const tunnelOutline = await createLineLayer(
    layers.tunnelWall.edgeUrl,
    'PyVistaTunnelFeatureEdges',
    '#00f5ff',
    0.95,
    6
  )
  tunnelOutlineLines.push(tunnelOutline)

  highStressVolume = await createSolidLayer(
    layers.highStressSolid,
    'PyVistaHighStressSolid',
    {
      color: layers.highStressSolid.color,
      emissive: isAfter.value ? '#33130d' : '#5a0804',
      emissiveIntensity: isAfter.value ? 0.18 : 0.32,
      shininess: 28,
      renderOrder: 5
    }
  )
  highStressVolume.visible = false
  renderedZoneCount.value = Number(layers.highStressSolid.cellCount)
  renderedPeakStress.value = Number(layers.highStressSolid.stressRangeMpa?.[1])
  addSceneGuides()
  loadProgress.value = 86
  return true
}
function configureMesh(mesh) {
  const name = mesh.name.toLowerCase()
  const isHighStress = name.includes('highstress')
  const isExterior = name.includes('exterior')
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const configured = materials.map((sourceMaterial) => {
    const material = sourceMaterial.clone()
    material.vertexColors = !isHighStress && Boolean(mesh.geometry.getAttribute('color'))
    material.side = THREE.DoubleSide
    material.depthWrite = !isExterior && !isHighStress
    material.transparent = isExterior || isHighStress
    if (isExterior) material.opacity = 0.16
    if (isHighStress) {
      material.color?.set('#ff3d2e')
      material.emissive?.set('#ff1f12')
      material.emissiveIntensity = 1.15
      material.opacity = 0.86
      material.polygonOffset = true
      material.polygonOffsetFactor = -2
      material.polygonOffsetUnits = -2
    }
    material.userData.baseOpacity = material.opacity
    material.userData.baseTransparent = material.transparent
    material.userData.baseDepthWrite = material.depthWrite
    return material
  })
  mesh.material = Array.isArray(mesh.material) ? configured : configured[0]
  mesh.castShadow = false
  mesh.receiveShadow = false
  if (isHighStress) {
    mesh.visible = false
    legacyHighStressMeshes.push(mesh)
  } else if (isExterior) {
    exteriorMeshes.push(mesh)
  } else {
    roadwayMeshes.push(mesh)
  }
}

function updateSurfaceVisibility() {
  const showRoadway = surfaceMode.value !== 'exterior'
  const showExterior = surfaceMode.value !== 'roadway'
  roadwayMeshes.forEach((mesh) => { mesh.visible = showRoadway })
  exteriorMeshes.forEach((mesh) => { mesh.visible = showExterior })
  sliceGridLines.forEach((lines) => { lines.visible = showRoadway })
  tunnelOutlineLines.forEach((lines) => { lines.visible = showRoadway })
  const showTarget = targetActive.value && showRoadway
  if (highStressVolume) highStressVolume.visible = showTarget
  if (highStressHalo) highStressHalo.visible = showTarget
  if (reliefPlanGroup) reliefPlanGroup.visible = props.showReliefPlan && showRoadway
  updateTargetMarker()
}

function updateTargetVisualization() {
  const dimRoadway = !pyvistaManifest.value && targetActive.value && surfaceMode.value !== 'exterior'
  roadwayMeshes.forEach((mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((material) => {
      material.transparent = dimRoadway || material.userData.baseTransparent
      material.opacity = dimRoadway
        ? (isAfter.value ? 0.88 : 0.82)
        : material.userData.baseOpacity
      material.depthWrite = dimRoadway ? false : material.userData.baseDepthWrite
      material.needsUpdate = true
    })
  })
  updateSurfaceVisibility()
}

function toggleTargetIdentification() {
  if (!targetInfo.value || !highStressVolume) return
  if (!targetActive.value && surfaceMode.value === 'exterior') {
    surfaceMode.value = 'roadway'
  }
  targetActive.value = !targetActive.value
  emit('target-change', targetActive.value)
}

function makeCylinderBetween(start, end, radius, material) {
  const direction = end.clone().sub(start)
  const length = direction.length()
  if (length <= 1e-6) return null
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 18, 1, false)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  )
  return mesh
}

function reliefDirection(item) {
  if (Array.isArray(item.direction) && item.direction.length === 3) {
    return new THREE.Vector3(...item.direction.map(Number)).normalize()
  }
  if (props.reliefVariant === 'inclined') {
    const angle = THREE.MathUtils.degToRad(12)
    return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize()
  }
  const collar = new THREE.Vector3(...item.borehole_coordinate.map(Number))
  const change = new THREE.Vector3(...item.diameter_change_coordinate.map(Number))
  return change.sub(collar).normalize()
}

function buildReliefPlan() {
  if (!modelRoot) return
  if (reliefPlanGroup) {
    modelRoot.remove(reliefPlanGroup)
    disposeObject(reliefPlanGroup)
  }
  reliefPlanGroup = new THREE.Group()
  reliefPlanGroup.name = 'PressureReliefPlan'

  const pilotMaterial = new THREE.MeshStandardMaterial({
    color: '#090d11',
    roughness: 0.58,
    metalness: 0.28
  })
  const reliefMaterial = new THREE.MeshStandardMaterial({
    color: '#00ff66',
    emissive: '#006f32',
    emissiveIntensity: 0.85,
    roughness: 0.38,
    metalness: 0.08,
    transparent: true,
    opacity: 0.9
  })
  const collarMaterial = new THREE.MeshStandardMaterial({
    color: '#ff00ff',
    emissive: '#8f008f',
    emissiveIntensity: 1.2
  })
  const changeMaterial = new THREE.MeshStandardMaterial({
    color: '#fff000',
    emissive: '#7e7100',
    emissiveIntensity: 1.1
  })

  props.reliefPlan.forEach((item) => {
    const collar = new THREE.Vector3(...item.borehole_coordinate.map(Number))
    const direction = reliefDirection(item)
    const pilotLength = Number(item.pilot_hole_length_m)
    const reliefLength = Number(item.relief_hole_length_m)
    const pilotRadius = Number(item.pilot_hole_diameter_m) * 0.5
    const reliefRadius = Number(item.relief_hole_diameter_m) * 0.5
    if (![pilotLength, reliefLength, pilotRadius, reliefRadius].every(Number.isFinite)) return

    const change = collar.clone().addScaledVector(direction, pilotLength)
    const reliefEnd = change.clone().addScaledVector(direction, reliefLength)
    const pilotTube = makeCylinderBetween(collar, change, pilotRadius, pilotMaterial)
    const reliefTube = makeCylinderBetween(change, reliefEnd, reliefRadius, reliefMaterial)
    if (pilotTube) reliefPlanGroup.add(pilotTube)
    if (reliefTube) reliefPlanGroup.add(reliefTube)

    const collarMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 18, 12),
      collarMaterial
    )
    collarMarker.position.copy(collar)
    reliefPlanGroup.add(collarMarker)

    const changeMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 18, 12),
      changeMaterial
    )
    changeMarker.position.copy(change)
    reliefPlanGroup.add(changeMarker)
  })

  reliefPlanGroup.visible = props.showReliefPlan
  modelRoot.add(reliefPlanGroup)
}

function updateTargetMarker() {
  const marker = targetMarker.value
  if (!marker) return
  if (
    !targetActive.value
    || surfaceMode.value === 'exterior'
    || loadState.value !== 'ready'
    || !targetPosition
    || !camera
    || !container.value
  ) {
    marker.classList.remove('visible')
    return
  }

  const worldPosition = targetPosition.clone()
  modelRoot?.localToWorld(worldPosition)
  const cameraDirection = new THREE.Vector3()
  camera.getWorldDirection(cameraDirection)
  const inFront = worldPosition.clone()
    .sub(camera.position)
    .dot(cameraDirection) > 0
  const projected = worldPosition.project(camera)
  const visible = inFront
    && projected.x >= -1 && projected.x <= 1
    && projected.y >= -1 && projected.y <= 1
    && projected.z >= -1 && projected.z <= 1

  if (!visible) {
    marker.classList.remove('visible')
    return
  }

  marker.style.left = `${(projected.x * 0.5 + 0.5) * container.value.clientWidth}px`
  marker.style.top = `${(-projected.y * 0.5 + 0.5) * container.value.clientHeight}px`
  marker.classList.add('visible')
}

function updateWireframe() {
  ;[...roadwayMeshes, ...exteriorMeshes].forEach((mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((material) => { material.wireframe = wireframe.value })
  })
}

function stressColor(stress, minimum, maximum, color) {
  const ratio = THREE.MathUtils.clamp(
    (stress - minimum) / Math.max(maximum - minimum, 1e-6),
    0,
    1
  )
  if (ratio < 0.45) {
    return color.lerpColors(
      new THREE.Color('#ff7547'),
      new THREE.Color('#f02d20'),
      ratio / 0.45
    )
  }
  return color.lerpColors(
    new THREE.Color('#f02d20'),
    new THREE.Color('#8f001e'),
    (ratio - 0.45) / 0.55
  )
}

async function loadHighStressVolume() {
  const volumeUrl = targetInfo.value?.volumeUrl
  if (!volumeUrl) throw new Error('模型清单中缺少高应力体单元数据')
  const response = await fetch(resolveModelUrl(volumeUrl), {
    cache: 'no-store',
    signal: abortController.signal
  })
  if (!response.ok) throw new Error(`高应力体单元请求失败（HTTP ${response.status}）`)
  const buffer = await response.arrayBuffer()
  const values = new Float32Array(buffer)
  if (values.length % 4 !== 0) throw new Error('高应力体单元数据格式无效')

  const sourceCount = values.length / 4
  const count = sourceCount
  let peakStress = -Infinity

  for (let index = 0; index < sourceCount; index += 1) {
    const sourceStress = values[index * 4 + 3]
    peakStress = Math.max(peakStress, sourceStress)
  }

  if (!count) throw new Error('当前阶段没有超过阈值的高应力体单元')

  renderedZoneCount.value = count
  renderedPeakStress.value = peakStress
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sourceRange = targetInfo.value?.volumeStressRangeMpa || [
    targetInfo.value?.thresholdStressMpa,
    targetInfo.value?.peakStressMpa
  ]
  const minimum = Number(sourceRange[0])
  const maximum = Number(sourceRange[1])
  const color = new THREE.Color()
  let targetIndex = 0

  for (let index = 0; index < sourceCount; index += 1) {
    const sourceOffset = index * 4
    const sourceStress = values[sourceOffset + 3]

    const targetOffset = targetIndex * 3
    positions[targetOffset] = values[sourceOffset]
    positions[targetOffset + 1] = values[sourceOffset + 1]
    positions[targetOffset + 2] = values[sourceOffset + 2]
    stressColor(sourceStress, minimum, maximum, color)
    colors[targetOffset] = color.r
    colors[targetOffset + 1] = color.g
    colors[targetOffset + 2] = color.b
    targetIndex += 1
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()

  highStressHalo = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.22,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: isAfter.value ? 0.06 : 0.08,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
  )
  highStressHalo.name = 'HighStressVolumeHalo'
  highStressHalo.renderOrder = 4

  highStressVolume = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.1,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: isAfter.value ? 0.9 : 0.86,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
  )
  highStressVolume.name = 'HighStressVolume'
  highStressVolume.renderOrder = 5
  modelRoot.add(highStressHalo, highStressVolume)
}

function fitCamera() {
  if (!camera || !controls) return
  const visibleObjects = [...roadwayMeshes, ...exteriorMeshes]
    .filter((mesh) => mesh.visible)
  if (targetActive.value && highStressVolume?.visible) {
    visibleObjects.push(highStressVolume)
  }
  if (props.showReliefPlan && reliefPlanGroup?.visible) {
    visibleObjects.push(reliefPlanGroup)
  }
  if (!visibleObjects.length) return
  modelBounds = new THREE.Box3()
  visibleObjects.forEach((object) => modelBounds.expandByObject(object))
  if (modelBounds.isEmpty()) return
  const size = modelBounds.getSize(new THREE.Vector3())
  const center = modelBounds.getCenter(new THREE.Vector3())
  const radius = Math.max(size.length() * 0.5, 1)
  const direction = (
    props.showReliefPlan
      ? new THREE.Vector3(1.05, 1.35, 0.62)
      : new THREE.Vector3(0.72, 1.35, 0.48)
  ).normalize()
  const distance = radius * (camera.aspect < 1 ? 3.35 : 2.85)
  camera.position.copy(center).add(direction.multiplyScalar(distance))
  camera.near = Math.max(radius / 1000, 0.01)
  camera.far = radius * 20
  camera.updateProjectionMatrix()
  controls.target.copy(center)
  controls.minDistance = radius * 0.25
  controls.maxDistance = radius * 7
  controls.update()
}

function disposeObject(object) {
  object.traverse?.((child) => {
    child.geometry?.dispose?.()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.filter(Boolean).forEach((material) => material.dispose?.())
  })
}

async function loadModel() {
  abortController = new AbortController()
  try {
    setState('loading')
    const response = await fetch(props.manifestUrl, {
      cache: 'no-store',
      signal: abortController.signal
    })
    if (!response.ok) throw new Error(`模型清单请求失败（HTTP ${response.status}）`)
    manifest.value = await response.json()

    if (!manifest.value?.ready) {
      setState('pending', '需要先完成 FLAC3D SAV 浏览器模型导出。')
      return
    }

    if (manifest.value?.model?.pyvistaLayers) {
      await loadPyvistaLayers()
      buildReliefPlan()
      modelBounds = new THREE.Box3().setFromObject(modelRoot)
      const peakPosition = targetInfo.value?.peakPosition
      targetPosition = Array.isArray(peakPosition) && peakPosition.length === 3
        ? new THREE.Vector3(...peakPosition.map(Number))
        : null
      updateTargetVisualization()
      updateWireframe()
      fitCamera()
      loadProgress.value = 100
      setState('ready')
      updateTargetMarker()
      return
    }
    const loader = new GLTFLoader()
    const modelUrl = resolveModelUrl(manifest.value.model.url)
    loader.load(
      modelUrl,
      async (gltf) => {
        modelRoot = gltf.scene
        modelRoot.name = `${manifest.value?.source?.name || 'flac3d-sav'}-${props.phase}`
        modelRoot.traverse((child) => {
          if (child.isMesh) configureMesh(child)
        })
        try {
          scene.add(modelRoot)
          loadProgress.value = 82
          await loadHighStressVolume()
          buildReliefPlan()
          modelBounds = new THREE.Box3().setFromObject(modelRoot)
          const peakPosition = targetInfo.value?.peakPosition
          targetPosition = Array.isArray(peakPosition) && peakPosition.length === 3
            ? new THREE.Vector3(...peakPosition.map(Number))
            : null
          updateTargetVisualization()
          updateWireframe()
          fitCamera()
          loadProgress.value = 100
          setState('ready')
          updateTargetMarker()
        } catch (error) {
          setState('error', error?.message || '高应力体单元无法解析')
        }
      },
      (event) => {
        if (event.total > 0) {
          loadProgress.value = Math.min(99, Math.round(event.loaded / event.total * 100))
        }
      },
      (error) => setState('error', error?.message || 'GLB 文件无法解析')
    )
  } catch (error) {
    if (error?.name !== 'AbortError') {
      setState('error', error?.message || String(error))
    }
  }
}

function initScene() {
  if (!container.value) return
  scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2('#f3f5f5', 0.0011)

  camera = new THREE.PerspectiveCamera(
    36,
    container.value.clientWidth / container.value.clientHeight,
    0.01,
    10000
  )
  camera.up.set(0, 0, 1)
  camera.position.set(8, 6, 12)

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.setClearColor(0xf3f5f5, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.toneMappingExposure = 1
  container.value.prepend(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.autoRotateSpeed = 0.34

  scene.add(new THREE.HemisphereLight('#d8eef2', '#061019', 1.8))
  const keyLight = new THREE.DirectionalLight('#f2fbff', 2.1)
  keyLight.position.set(5, 9, 8)
  scene.add(keyLight)
  const fillLight = new THREE.DirectionalLight('#4b8298', 1.2)
  fillLight.position.set(-7, -3, -5)
  scene.add(fillLight)

  renderer.domElement.addEventListener('pointerenter', () => { hovered.value = true })
  renderer.domElement.addEventListener('pointerleave', () => { hovered.value = false })

  resizeObserver = new ResizeObserver(() => {
    if (!container.value || !renderer || !camera) return
    const width = container.value.clientWidth
    const height = container.value.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    if (modelRoot) fitCamera()
  })
  resizeObserver.observe(container.value)

  const animate = () => {
    animationFrame = requestAnimationFrame(animate)
    controls.autoRotate = autoRotate.value && loadState.value === 'ready'
    controls.update()
    if (targetActive.value) {
      const pulse = 1 + Math.sin(performance.now() * 0.0045) * 0.18
      if (highStressVolume) {
        highStressVolume.material.opacity = (
          isAfter.value ? 0.79 : 0.75
        ) + pulse * 0.07
      }
      if (highStressHalo) {
        highStressHalo.material.opacity = (
          isAfter.value ? 0.035 : 0.045
        ) + pulse * 0.025
      }
      updateTargetMarker()
    }
    renderer.render(scene, camera)
  }
  animate()
  loadModel()
}

watch(surfaceMode, () => {
  updateTargetVisualization()
  fitCamera()
})
watch(wireframe, updateWireframe)
watch(targetActive, () => {
  updateTargetVisualization()
  fitCamera()
})
watch(() => props.targetVisible, (value) => {
  if (value === null) return
  targetActive.value = value
})
watch(
  () => [props.showReliefPlan, props.reliefVariant, props.reliefPlan],
  () => {
    buildReliefPlan()
    updateSurfaceVisibility()
    fitCamera()
  },
  { deep: true }
)

onMounted(initScene)

onBeforeUnmount(() => {
  abortController?.abort()
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  controls?.dispose()
  if (modelRoot) disposeObject(modelRoot)
  renderer?.dispose()
  renderer?.domElement?.remove()
})
</script>

<style scoped>
.sav-model-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.sav-model-canvas::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(255, 255, 255, .03), rgba(35, 50, 55, .05));
  content: '';
  pointer-events: none;
}
.sav-model-canvas :deep(canvas) { display: block; width: 100%; height: 100%; }
.model-header {
  position: absolute;
  z-index: 4;
  top: 15px;
  left: 17px;
  right: 17px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  pointer-events: none;
}
.model-header > div:first-child { min-width: 0; }
.model-header span,
.model-header strong,
.model-header small { display: block; }
.model-header > div:first-child > span {
  color: #45606a;
  font: 9px Electronic, monospace;
  letter-spacing: 1.6px;
}
.model-header > div:first-child > strong {
  margin-top: 5px;
  color: #17323b;
  font-size: 15px;
  font-weight: 500;
}
.model-header > div:first-child > small {
  margin-top: 3px;
  color: #536b74;
  font: 9px Electronic, monospace;
}
.load-state {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  color: #78919b;
  font-size: 9px;
  background: rgba(5, 16, 23, .78);
  border: 1px solid rgba(125, 157, 168, .18);
}
.load-state i {
  width: 5px;
  height: 5px;
  background: #c39d56;
  border-radius: 50%;
  box-shadow: 0 0 7px rgba(195, 157, 86, .56);
}
.load-state.ready i { background: #66c99e; box-shadow: 0 0 7px rgba(102, 201, 158, .7); }
.load-state.error i { background: #d65d4a; box-shadow: 0 0 7px rgba(214, 93, 74, .7); }
.load-state strong { color: #d9e5e7; font: 10px Electronic, monospace; }
.loading-track {
  position: absolute;
  z-index: 5;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(109, 139, 149, .12);
}
.loading-track i {
  display: block;
  height: 100%;
  background: #6dc9d8;
  box-shadow: 0 0 8px rgba(109, 201, 216, .65);
  transition: width .2s ease;
}
.model-fallback {
  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  width: min(430px, calc(100% - 64px));
  padding: 25px 27px;
  transform: translate(-50%, -50%);
  text-align: center;
  background: rgba(5, 15, 22, .84);
  border: 1px solid rgba(128, 158, 168, .22);
}
.fallback-code { color: #73909a; font: 10px Electronic, monospace; letter-spacing: 2px; }
.model-fallback strong { display: block; margin-top: 10px; color: #d9e5e7; font-size: 14px; font-weight: 500; }
.model-fallback p { margin: 8px auto 12px; color: #7e959e; font-size: 11px; line-height: 1.65; }
.model-fallback code { color: #bca366; font: 9px Electronic, monospace; }
.model-toolbar {
  position: absolute;
  z-index: 5;
  left: 50%;
  bottom: 17px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px;
  transform: translateX(-50%);
  background: rgba(4, 14, 21, .86);
  border: 1px solid rgba(126, 158, 169, .2);
}
.surface-switch { display: flex; gap: 2px; }
.model-toolbar button {
  height: 25px;
  padding: 0 9px;
  color: #758f99;
  font-size: 10px;
  background: rgba(103, 137, 148, .06);
  border: 1px solid transparent;
  cursor: pointer;
}
.model-toolbar button:hover,
.model-toolbar button.active {
  color: #dce8ea;
  background: rgba(85, 151, 165, .16);
  border-color: rgba(110, 191, 207, .34);
}
.model-toolbar .reset-view { border-left-color: rgba(126, 158, 169, .22); }
.stress-legend {
  position: absolute;
  z-index: 4;
  top: 84px;
  right: 20px;
  display: grid;
  grid-template-columns: 12px 9px;
  grid-template-rows: auto 118px auto auto auto;
  gap: 4px 5px;
  align-items: center;
  color: #708993;
  font-size: 9px;
  text-align: center;
  pointer-events: none;
}
.stress-legend i {
  grid-column: 2;
  grid-row: 1 / 4;
  width: 9px;
  height: 142px;
  background: linear-gradient(to bottom, #b00020, #ff6a00 13%, #fff7d6 25%, #fff200 38%, #7dff00 50%, #00e5a8 63%, #00b8ff 75%, #006dff 84%, #0033cc 92%, #081d58);
  box-shadow: 0 0 10px rgba(0, 127, 196, .3);
}
.stress-legend > span:first-child { align-self: start; }
.stress-legend > span:nth-child(3) { align-self: end; }
.stress-legend strong,
.stress-legend small { grid-column: 1 / 3; }
.stress-legend strong { margin-top: 4px; color: #b7c8cd; font: italic 10px Georgia, serif; }
.stress-legend small { color: #69818a; white-space: nowrap; }
.target-identification {
  position: absolute;
  z-index: 6;
  top: 83px;
  left: 17px;
  width: 205px;
  background: rgba(4, 14, 21, .9);
  border: 1px solid rgba(126, 158, 169, .22);
  box-shadow: 0 12px 28px rgba(0, 0, 0, .2);
}
.target-identification.active {
  border-color: rgba(255, 99, 64, .52);
  box-shadow: 0 0 22px rgba(235, 62, 38, .12);
}
.phase-after .target-identification.active {
  border-color: rgba(101, 201, 158, .52);
  box-shadow: 0 0 22px rgba(72, 188, 143, .12);
}
.target-identification > button {
  display: flex;
  width: 100%;
  min-height: 45px;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  color: #8da3aa;
  text-align: left;
  background: rgba(87, 125, 138, .05);
  border: 0;
  cursor: pointer;
}
.target-identification > button:hover { background: rgba(91, 155, 169, .11); }
.target-identification.active > button {
  color: #f3dad4;
  background: rgba(224, 68, 42, .1);
  border-bottom: 1px solid rgba(255, 105, 72, .2);
}
.target-button-icon {
  position: relative;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: 1px solid #73a6b2;
  border-radius: 50%;
}
.target-button-icon::before,
.target-button-icon::after {
  position: absolute;
  top: 50%;
  left: 50%;
  background: #8bc1cc;
  content: '';
  transform: translate(-50%, -50%);
}
.target-button-icon::before { width: 26px; height: 1px; }
.target-button-icon::after { width: 1px; height: 26px; }
.target-identification.active .target-button-icon {
  border-color: #ff684b;
  box-shadow: 0 0 9px rgba(255, 62, 36, .58);
}
.target-identification.active .target-button-icon::before,
.target-identification.active .target-button-icon::after { background: #ff755b; }
.phase-after .target-identification.active .target-button-icon {
  border-color: #68cda1;
  box-shadow: 0 0 9px rgba(75, 202, 148, .5);
}
.phase-after .target-identification.active .target-button-icon::before,
.phase-after .target-identification.active .target-button-icon::after {
  background: #77d9b0;
}
.target-identification button span,
.target-identification button strong,
.target-identification button small { display: block; min-width: 0; }
.target-identification button span { flex: 1; }
.target-identification button strong { color: #dbe7e9; font-size: 11px; font-weight: 500; }
.target-identification button small {
  margin-top: 3px;
  color: #6f8992;
  font: 9px Electronic, monospace;
}
.target-identification.active button small { color: #b98678; }
.target-results {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  padding: 8px;
}
.target-results > div {
  min-width: 0;
  padding: 6px 5px;
  background: rgba(114, 146, 156, .06);
  border-top: 1px solid rgba(120, 151, 161, .14);
}
.target-results span,
.target-results strong { display: block; }
.target-results span { color: #657e87; font-size: 8px; white-space: nowrap; }
.target-results strong {
  margin-top: 3px;
  color: #dce6e8;
  font: 10px Electronic, monospace;
  white-space: nowrap;
}
.target-results strong.peak { color: #ff755b; }
.target-results footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 2px 0;
  color: #7f959d;
  font-size: 8px;
}
.target-results footer strong { margin: 0; color: #d4a14e; font-size: 8px; font-weight: 500; }
.target-marker {
  position: absolute;
  z-index: 7;
  width: 0;
  height: 0;
  opacity: 0;
  transform: translate(-50%, -50%);
  transition: opacity .16s ease;
  pointer-events: none;
}
.target-marker.visible { opacity: 1; }
.target-marker > i {
  position: absolute;
  top: -17px;
  left: -17px;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 183, 71, .92);
  border-radius: 50%;
  box-shadow:
    0 0 0 5px rgba(255, 70, 41, .12),
    0 0 18px rgba(255, 55, 30, .7);
  animation: target-reticle 1.45s ease-in-out infinite;
}
.target-marker > i::before,
.target-marker > i::after {
  position: absolute;
  top: 50%;
  left: 50%;
  background: #ffe0a3;
  box-shadow: 0 0 6px rgba(255, 81, 43, .9);
  content: '';
  transform: translate(-50%, -50%);
}
.target-marker > i::before { width: 42px; height: 1px; }
.target-marker > i::after { width: 1px; height: 42px; }
.target-marker > span {
  position: absolute;
  top: -13px;
  left: 26px;
  width: 74px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 164, 75, .7);
}
.target-marker strong,
.target-marker small { display: block; white-space: nowrap; }
.target-marker strong { color: #ffc478; font-size: 9px; font-weight: 500; }
.target-marker small { margin-top: 2px; color: #fff0d2; font: 10px Electronic, monospace; }
@keyframes target-reticle {
  0%, 100% { transform: scale(.92); opacity: .72; }
  50% { transform: scale(1.08); opacity: 1; }
}
.model-stats {
  position: absolute;
  z-index: 4;
  left: 17px;
  bottom: 18px;
  display: flex;
  gap: 5px;
  pointer-events: none;
}
.model-stats div {
  min-width: 76px;
  padding: 5px 7px;
  background: rgba(5, 15, 22, .76);
  border-left: 1px solid rgba(114, 184, 197, .45);
}
.model-stats span { display: block; color: #657e88; font-size: 8px; }
.model-stats strong { display: block; margin-top: 2px; color: #d7e3e5; font: 11px Electronic, monospace; }
.model-stats small { color: #718a94; font-size: 8px; }
.relief-legend {
  position: absolute;
  z-index: 5;
  top: 83px;
  left: 17px;
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 6px 14px;
  min-width: 242px;
  padding: 10px 11px;
  color: #89a0a8;
  font-size: 9px;
  background: rgba(4, 14, 21, .91);
  border: 1px solid rgba(0, 245, 255, .28);
  box-shadow: 0 12px 28px rgba(0, 0, 0, .24);
  pointer-events: none;
}
.relief-legend strong {
  grid-column: 1 / -1;
  padding-bottom: 6px;
  color: #dce8ea;
  font-size: 11px;
  font-weight: 500;
  border-bottom: 1px solid rgba(112, 164, 177, .16);
}
.relief-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.relief-legend i {
  width: 12px;
  height: 4px;
  background: #111;
}
.relief-legend .collar {
  height: 7px;
  background: #ff00ff;
  border-radius: 50%;
}
.relief-legend .change {
  height: 7px;
  background: #fff000;
  border-radius: 50%;
}
.relief-legend .relief {
  height: 6px;
  background: #00ff66;
}
.view-hint {
  position: absolute;
  z-index: 4;
  right: 18px;
  bottom: 19px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: rgba(150, 177, 186, .45);
  font-size: 9px;
  opacity: .55;
  transition: opacity .2s ease;
  pointer-events: none;
}
.view-hint.visible { opacity: 1; }
.view-hint i { width: 1px; height: 8px; background: rgba(130, 160, 170, .26); }
@media (max-width: 1000px) {
  .model-stats, .view-hint { display: none; }
  .model-toolbar { width: calc(100% - 28px); justify-content: center; }
  .model-toolbar button { padding-inline: 6px; }
  .target-identification {
    top: 77px;
    left: 12px;
    width: 188px;
  }
  .target-results { grid-template-columns: repeat(2, 1fr); }
  .target-results > div:last-of-type { grid-column: 1 / -1; }
  .stress-legend { right: 12px; }
  .relief-legend { left: 12px; }
}
@media (max-width: 560px) {
  .model-header { left: 12px; right: 12px; }
  .model-header > div:first-child { max-width: calc(100% - 104px); }
  .model-header > div:first-child > strong { font-size: 10px; }
  .model-header > div:first-child > small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .target-identification { width: 176px; }
  .relief-legend {
    top: 74px;
    width: 188px;
    min-width: 0;
    grid-template-columns: 1fr;
  }
  .target-identification > button { min-height: 41px; padding: 6px 8px; }
  .target-results { padding: 6px; }
  .target-results footer { display: block; line-height: 1.55; }
  .model-toolbar {
    bottom: 10px;
    overflow-x: auto;
    justify-content: flex-start;
  }
  .model-toolbar button { flex: 0 0 auto; }
}
</style>
