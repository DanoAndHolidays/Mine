<template>
  <div
    ref="container"
    class="volume-cloud-canvas"
    :class="[viewMode, { compact }]"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <canvas ref="canvasElement" class="canvas-host"></canvas>
    <div class="field-header">
      <span class="field-symbol">{{ metricMeta.symbol }}</span>
      <div><strong>{{ metricMeta.title }}</strong><small>{{ metricMeta.subtitle }}</small></div>
    </div>
    <div class="coordinate-note">
      <span><b>X</b> 巷道纵向 -8-8 m</span>
      <span><b>S</b> 拱形巷道表面 11 孔</span>
      <span><b>r</b> 径向钻深 0-{{ maxDepth }} cm</span>
    </div>
    <div class="spatial-status">
      <span><i></i>{{ sectionGroups.length }} 个实测反演断面</span>
      <strong>{{ totalBoreholes }} 孔空间联合插值</strong>
    </div>
    <div class="section-key">
      <span v-for="group in sectionGroups" :key="group.id" :class="{ active: group.id === selectedGroupId }">
        <i></i><strong>{{ group.id }}组</strong><small>{{ group.longitudinalM }} m · 11孔</small>
      </span>
    </div>
    <div class="mode-readout">
      <strong>{{ viewModeMeta.title }}</strong>
      <span>{{ viewModeMeta.detail }}</span>
    </div>
    <div class="depth-readout">
      <span>当前径向分析深度</span>
      <strong>{{ selectedDepth.toFixed(1) }}<em> cm</em></strong>
    </div>
    <div class="view-hint" :class="{ visible: hovered }">
      <span>拖拽旋转</span><i></i><span>滚轮缩放</span>
    </div>
    <div v-if="!webglReady" class="webgl-fallback">
      <strong>3D ENGINE OFFLINE</strong><span>当前浏览器未启用 WebGL</span>
      <small v-if="webglError">{{ webglError }}</small>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const props = defineProps({
  progress: { type: Number, default: 100 },
  metric: { type: String, default: 'stress' },
  slice: { type: Number, default: 50 },
  autoRotate: { type: Boolean, default: true },
  viewMode: { type: String, default: 'cloud' },
  compact: { type: Boolean, default: false },
  playing: { type: Boolean, default: true },
  speed: { type: Number, default: 1 },
  modelId: { type: String, default: 'v4' },
  boreholes: { type: Array, default: () => [] },
  spatialGroups: { type: Array, default: () => [] },
  selectedBoreholeId: { type: String, default: 'BH-01' },
  selectedGroupId: { type: String, default: 'B' },
  maxDepth: { type: Number, default: 125 }
})

const emit = defineEmits(['sample', 'select', 'slice-select'])
const container = ref(null)
const canvasElement = ref(null)
const hovered = ref(false)
const webglReady = ref(true)
const webglError = ref('')
const selectedDepth = computed(() => props.maxDepth * THREE.MathUtils.clamp(props.slice / 100, 0, 1))
const sectionGroups = computed(() => props.spatialGroups.slice().sort((a, b) => a.longitudinalM - b.longitudinalM))
const selectedSectionGroup = computed(() => (
  sectionGroups.value.find(group => group.id === props.selectedGroupId)
  || sectionGroups.value[Math.floor(sectionGroups.value.length / 2)]
  || null
))
const totalBoreholes = computed(() => sectionGroups.value.reduce((total, group) => total + (group.boreholes?.length || 0), 0))
const viewModeMeta = computed(() => {
  if (props.viewMode === 'section') {
    return {
      title: `${selectedSectionGroup.value?.id || '--'}组横断面解析`,
      detail: `实测断面 X=${selectedSectionGroup.value?.longitudinalM ?? '--'} m · 0-${selectedDepth.value.toFixed(1)} cm`
    }
  }
  if (props.viewMode === 'iso') return { title: '离散场点', detail: '空间采样点直接分布' }
  return { title: '完整三维围岩', detail: '连续体场 + 半透明围岩' }
})
const metricMeta = computed(() => {
  if (props.metric === 'damage') return { symbol: 'D(X,S,r)', title: '三维损伤反演场', subtitle: 'ARCHED ROADWAY · SPATIAL FIELD' }
  if (props.metric === 'error') return { symbol: 'E(X,S,r)', title: '三维置信误差场', subtitle: 'CONFIDENCE-WEIGHTED SPATIAL FIELD' }
  return { symbol: 'σ(X,S,r)', title: '三维应力反演场', subtitle: 'ARCHED ROADWAY · SPATIAL FIELD' }
})

const ROADWAY_HALF_WIDTH = 2.35
const ROADWAY_FLOOR_Y = -1.55
const ROADWAY_SPRING_Y = 0.35
const LONGITUDINAL_MIN = -9.5
const LONGITUDINAL_MAX = 9.5
const ROADWAY_LENGTH = LONGITUDINAL_MAX - LONGITUDINAL_MIN
const FIELD_DEPTH_M = 2.75
const ANALYSIS_SLICE_BOTTOM_HALF_WIDTH = 0.58
const ANALYSIS_SLICE_TOP_HALF_WIDTH = 1.45
const ANALYSIS_SLICE_HALF_THICKNESS = 0.045
const ROCK_HALF_WIDTH = 5.45
const ROCK_BOTTOM_Y = -3.55
const ROCK_TOP_Y = 5.35
const X_STEPS = 25
const SURFACE_STEPS = 48
const RADIAL_STEPS = 9
const MAX_RENDER_FPS = 30
const FRAME_INTERVAL = 1000 / MAX_RENDER_FPS
const BOREHOLE_FAN_BASE_ANGLE_DEGREES = 15
const BOREHOLE_EXTRA_ANGLE_DEGREES = [5, 7, 9, 6, 8, 10, 7, 9, 6, 8, 5]
const BOREHOLE_TUBE_RADIUS = 0.024
const BOREHOLE_COLLAR_RADIUS = 0.048
const BOREHOLE_HEAD_RADIUS = 0.055

let scene, camera, renderer, controls, resizeObserver, intersectionObserver, animationFrame
let rootGroup, fieldPoints, fieldSurface, fieldLayerGroup, rockMass, rockEdges, cavitySurface, roadwayFloor
let boreholeGroup, boreholeMeshes = [], sectionGuideGroup
let fieldPointMaterial, fieldSurfaceMaterial, fieldLayerMaterial
let isIntersecting = true
let controlsDragging = false
let renderRequested = true
let settleUntil = 0
let lastFrameTime = 0
let lastSurfaceBand = -1
let boreholeEntries = []
let lastViewMode = props.viewMode

const palettes = {
  stress: [[0, '#000b38'], [.18, '#0037a8'], [.36, '#007fc4'], [.54, '#00a86b'], [.7, '#9cb900'], [.84, '#e47700'], [.94, '#e62b00'], [1, '#9d001f']],
  damage: [[0, '#10002f'], [.2, '#351080'], [.4, '#2656b8'], [.58, '#008c8f'], [.73, '#72a800'], [.86, '#d47400'], [.95, '#d52300'], [1, '#82001d']],
  error: [[0, '#07121d'], [.35, '#123d62'], [.62, '#168b91'], [.82, '#d28b18'], [1, '#9d071d']]
}
const paletteColors = Object.fromEntries(
  Object.entries(palettes).map(([key, stops]) => [key, stops.map(([position, color]) => [position, new THREE.Color(color)])])
)
const scratchColor = new THREE.Color()
const scratchMatrix = new THREE.Matrix4()
const scratchQuaternion = new THREE.Quaternion()
const scratchIdentityQuaternion = new THREE.Quaternion()
const scratchScale = new THREE.Vector3()
const scratchMidpoint = new THREE.Vector3()
const scratchDirection = new THREE.Vector3()
const longitudinalAxis = new THREE.Vector3(1, 0, 0)
const cylinderAxis = new THREE.Vector3(0, 1, 0)

function requestRender(settleMs = 0) {
  renderRequested = true
  if (settleMs) settleUntil = Math.max(settleUntil, performance.now() + settleMs)
}

function colorAt(value, target = new THREE.Color()) {
  const palette = paletteColors[props.metric] || paletteColors.stress
  const normalized = THREE.MathUtils.clamp(value, 0, 1)
  for (let index = 0; index < palette.length - 1; index += 1) {
    const [start, startColor] = palette[index]
    const [end, endColor] = palette[index + 1]
    if (normalized <= end) {
      return target.copy(startColor).lerp(endColor, (normalized - start) / Math.max(end - start, .0001))
    }
  }
  return target.copy(palette.at(-1)[1])
}

function archPoint(surfaceRatio, offset = 0) {
  const ratio = THREE.MathUtils.clamp(surfaceRatio, 0, 1)
  const width = ROADWAY_HALF_WIDTH + offset
  const floor = ROADWAY_FLOOR_Y - offset
  if (ratio < .2) return new THREE.Vector3(0, THREE.MathUtils.lerp(floor, ROADWAY_SPRING_Y, ratio / .2), -width)
  if (ratio <= .8) {
    const angle = Math.PI - (ratio - .2) / .6 * Math.PI
    return new THREE.Vector3(0, ROADWAY_SPRING_Y + Math.sin(angle) * width, Math.cos(angle) * width)
  }
  return new THREE.Vector3(0, THREE.MathUtils.lerp(ROADWAY_SPRING_Y, floor, (ratio - .8) / .2), width)
}

function archNormal(surfaceRatio) {
  const before = archPoint(Math.max(0, surfaceRatio - .001))
  const after = archPoint(Math.min(1, surfaceRatio + .001))
  const tangent = after.sub(before).normalize()
  const normal = new THREE.Vector3(0, tangent.z, -tangent.y).normalize()
  const point = archPoint(surfaceRatio)
  const outward = new THREE.Vector3(0, point.y - ROADWAY_SPRING_Y, point.z)
  if (normal.dot(outward) < 0) normal.multiplyScalar(-1)
  return normal
}

function analysisSliceHalfWidth(surfaceRatio, radialRatio = 0) {
  const point = archPoint(surfaceRatio)
  const roadwayTop = ROADWAY_SPRING_Y + ROADWAY_HALF_WIDTH
  const heightRatio = THREE.MathUtils.clamp(
    (point.y - ROADWAY_FLOOR_Y) / Math.max(roadwayTop - ROADWAY_FLOOR_Y, 0.001),
    0,
    1
  )
  const verticalProfile = Math.pow(heightRatio, 0.82)
  const baseWidth = THREE.MathUtils.lerp(
    ANALYSIS_SLICE_BOTTOM_HALF_WIDTH,
    ANALYSIS_SLICE_TOP_HALF_WIDTH,
    verticalProfile
  )
  return baseWidth * THREE.MathUtils.lerp(0.92, 1.08, THREE.MathUtils.clamp(radialRatio, 0, 1))
}

function writeAnalysisSliceVertex(positions, vertexIndex, group, surfaceRatio, radialRatio, side) {
  const base = archPoint(surfaceRatio)
  const normal = archNormal(surfaceRatio)
  const centerX = Number(group?.longitudinalM) || 0
  const halfWidth = analysisSliceHalfWidth(surfaceRatio, radialRatio)
  const cursor = vertexIndex * 3
  positions[cursor] = centerX + (side === 0 ? -halfWidth : halfWidth)
  positions[cursor + 1] = base.y + normal.y * FIELD_DEPTH_M * radialRatio
  positions[cursor + 2] = base.z + normal.z * FIELD_DEPTH_M * radialRatio
}

function sampleAtDepth(borehole, radialRatio) {
  const samples = borehole?.samples || []
  if (!samples.length) return null
  const index = Math.min(Math.round(THREE.MathUtils.clamp(radialRatio, 0, 1) * (samples.length - 1)), samples.length - 1)
  return samples[index]
}

function sampleValue(group, surfaceRatio, radialRatio) {
  const boreholes = group?.boreholes || []
  if (!boreholes.length) return 0
  const position = THREE.MathUtils.clamp(surfaceRatio, 0, 1) * (boreholes.length - 1)
  const lower = Math.floor(position)
  const upper = Math.min(lower + 1, boreholes.length - 1)
  const amount = position - lower
  const read = (sample) => {
    if (!sample) return 0
    if (props.metric === 'damage') return Number(sample.damagePct || 0) / 80
    if (props.metric === 'error') return 1 - Number(sample.confidence || 0)
    return Number(sample.stressMpa || 0) / 40
  }
  return THREE.MathUtils.lerp(
    read(sampleAtDepth(boreholes[lower], radialRatio)),
    read(sampleAtDepth(boreholes[upper], radialRatio)),
    amount
  )
}

function fieldAt(x, surfaceRatio, radialRatio) {
  const groups = sectionGroups.value
  if (!groups.length) return 0
  if (x <= groups[0].longitudinalM) return sampleValue(groups[0], surfaceRatio, radialRatio)
  if (x >= groups.at(-1).longitudinalM) return sampleValue(groups.at(-1), surfaceRatio, radialRatio)
  for (let index = 0; index < groups.length - 1; index += 1) {
    const left = groups[index]
    const right = groups[index + 1]
    if (x <= right.longitudinalM) {
      const amount = (x - left.longitudinalM) / Math.max(right.longitudinalM - left.longitudinalM, .0001)
      return THREE.MathUtils.lerp(
        sampleValue(left, surfaceRatio, radialRatio),
        sampleValue(right, surfaceRatio, radialRatio),
        amount
      )
    }
  }
  return 0
}

function createRockMass() {
  const shape = new THREE.Shape()
  shape.moveTo(-ROCK_HALF_WIDTH, ROCK_BOTTOM_Y)
  shape.lineTo(ROCK_HALF_WIDTH, ROCK_BOTTOM_Y)
  shape.lineTo(ROCK_HALF_WIDTH, ROCK_TOP_Y)
  shape.lineTo(-ROCK_HALF_WIDTH, ROCK_TOP_Y)
  shape.closePath()

  const cavity = new THREE.Path()
  for (let index = 0; index <= SURFACE_STEPS; index += 1) {
    const point = archPoint(index / SURFACE_STEPS)
    if (index === 0) cavity.moveTo(point.z, point.y)
    else cavity.lineTo(point.z, point.y)
  }
  cavity.closePath()
  shape.holes.push(cavity)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: ROADWAY_LENGTH,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 1
  })
  geometry.translate(0, 0, -ROADWAY_LENGTH / 2)
  geometry.rotateY(Math.PI / 2)
  geometry.computeVertexNormals()

  const capMaterial = new THREE.MeshLambertMaterial({
    color: '#789098',
    transparent: true,
    opacity: .22,
    side: THREE.DoubleSide,
    depthWrite: false
  })
  const wallMaterial = new THREE.MeshLambertMaterial({
    color: '#526970',
    transparent: true,
    opacity: .13,
    side: THREE.DoubleSide,
    depthWrite: false
  })
  rockMass = new THREE.Mesh(geometry, [capMaterial, wallMaterial])
  rockMass.name = '半透明围岩实体与拱形巷道空腔'
  rockMass.renderOrder = 1
  rootGroup.add(rockMass)

  rockEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 28),
    new THREE.LineBasicMaterial({ color: '#8fa7ad', transparent: true, opacity: .2, depthWrite: false })
  )
  rockEdges.renderOrder = 2
  rootGroup.add(rockEdges)
}

function makeTubeGeometry(offset = 0) {
  const positions = new Float32Array(X_STEPS * (SURFACE_STEPS + 1) * 3)
  const indices = []
  let cursor = 0
  for (let xi = 0; xi < X_STEPS; xi += 1) {
    const x = THREE.MathUtils.lerp(LONGITUDINAL_MIN, LONGITUDINAL_MAX, xi / (X_STEPS - 1))
    for (let si = 0; si <= SURFACE_STEPS; si += 1) {
      const point = archPoint(si / SURFACE_STEPS, offset)
      positions[cursor++] = x
      positions[cursor++] = point.y
      positions[cursor++] = point.z
    }
  }
  for (let xi = 0; xi < X_STEPS - 1; xi += 1) {
    for (let si = 0; si < SURFACE_STEPS; si += 1) {
      const current = xi * (SURFACE_STEPS + 1) + si
      const next = current + SURFACE_STEPS + 1
      indices.push(current, next, current + 1, current + 1, next, next + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createRoadwayCavity() {
  cavitySurface = new THREE.Mesh(
    makeTubeGeometry(.018),
    new THREE.MeshLambertMaterial({
      color: '#8ba2a8',
      transparent: true,
      opacity: .31,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  )
  cavitySurface.name = '拱形巷道内壁'
  cavitySurface.renderOrder = 4
  rootGroup.add(cavitySurface)

  const floorGeometry = new THREE.PlaneGeometry(ROADWAY_LENGTH, ROADWAY_HALF_WIDTH * 2)
  floorGeometry.rotateX(-Math.PI / 2)
  roadwayFloor = new THREE.Mesh(
    floorGeometry,
    new THREE.MeshLambertMaterial({
      color: '#82979d',
      transparent: true,
      opacity: .28,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  )
  roadwayFloor.position.y = ROADWAY_FLOOR_Y
  roadwayFloor.renderOrder = 4
  rootGroup.add(roadwayFloor)
}

function createSectionGuides() {
  if (sectionGuideGroup) {
    rootGroup.remove(sectionGuideGroup)
    disposeObject(sectionGuideGroup)
  }
  sectionGuideGroup = new THREE.Group()
  const colors = ['#6bc8d8', '#e1bc65', '#6bc8d8']
  sectionGroups.value.forEach((group, groupIndex) => {
    const active = group.id === props.selectedGroupId
    const groupGuide = new THREE.Group()
    groupGuide.name = `${group.id}组断面辅助线`
    groupGuide.userData.groupId = group.id
    const inner = []
    const outer = []
    for (let index = 0; index <= SURFACE_STEPS; index += 1) {
      const ratio = index / SURFACE_STEPS
      const innerPoint = archPoint(ratio, .025)
      const outerPoint = archPoint(ratio, FIELD_DEPTH_M)
      innerPoint.x = group.longitudinalM
      outerPoint.x = group.longitudinalM
      inner.push(innerPoint)
      outer.push(outerPoint)
    }
    ;[inner, outer].forEach((points) => {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({
          color: active ? '#f0c86d' : colors[groupIndex] || colors[0],
          transparent: true,
          opacity: active ? .82 : .28,
          dashSize: .18,
          gapSize: .11,
          depthWrite: false
        })
      )
      line.computeLineDistances()
      line.renderOrder = 5
      groupGuide.add(line)
    })
    sectionGuideGroup.add(groupGuide)
  })
  rootGroup.add(sectionGuideGroup)
  updateSectionGuideVisibility()
}

function updateSectionGuideVisibility() {
  if (!sectionGuideGroup) return
  const sectionMode = props.viewMode === 'section'
  const activeGroupId = selectedSectionGroup.value?.id || props.selectedGroupId
  sectionGuideGroup.children.forEach((groupGuide) => {
    groupGuide.visible = !sectionMode || groupGuide.userData.groupId === activeGroupId
  })
}

function createConnectedFieldGeometry(radialLevels) {
  const surfaceVertexCount = SURFACE_STEPS + 1
  const layerVertexCount = X_STEPS * surfaceVertexCount
  const vertexCount = radialLevels.length * layerVertexCount
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)
  const indices = []
  let cursor = 0
  const vertexIndex = (ri, xi, si) => ri * layerVertexCount + xi * surfaceVertexCount + si

  radialLevels.forEach((radialRatio) => {
    for (let xi = 0; xi < X_STEPS; xi += 1) {
      const x = THREE.MathUtils.lerp(LONGITUDINAL_MIN, LONGITUDINAL_MAX, xi / (X_STEPS - 1))
      for (let si = 0; si <= SURFACE_STEPS; si += 1) {
        const surfaceRatio = si / SURFACE_STEPS
        const base = archPoint(surfaceRatio)
        const normal = archNormal(surfaceRatio)
        positions[cursor] = x
        positions[cursor + 1] = base.y + normal.y * FIELD_DEPTH_M * radialRatio
        positions[cursor + 2] = base.z + normal.z * FIELD_DEPTH_M * radialRatio
        colorAt(fieldAt(x, surfaceRatio, radialRatio), scratchColor)
        colors[cursor] = scratchColor.r
        colors[cursor + 1] = scratchColor.g
        colors[cursor + 2] = scratchColor.b
        cursor += 3
      }
    }
  })

  // Continuous longitudinal shells carry the interpolated field through the roadway.
  radialLevels.forEach((_, ri) => {
    for (let xi = 0; xi < X_STEPS - 1; xi += 1) {
      for (let si = 0; si < SURFACE_STEPS; si += 1) {
        const current = vertexIndex(ri, xi, si)
        const next = vertexIndex(ri, xi + 1, si)
        indices.push(current, next, current + 1, current + 1, next, next + 1)
      }
    }
  })

  // Radial webs at the ends and measured A/B/C sections join every shell into one body.
  const connectorSlices = new Set([0, X_STEPS - 1])
  sectionGroups.value.forEach((group) => {
    const ratio = (group.longitudinalM - LONGITUDINAL_MIN) / ROADWAY_LENGTH
    connectorSlices.add(Math.round(THREE.MathUtils.clamp(ratio, 0, 1) * (X_STEPS - 1)))
  })
  connectorSlices.forEach((xi) => {
    for (let ri = 0; ri < radialLevels.length - 1; ri += 1) {
      for (let si = 0; si < SURFACE_STEPS; si += 1) {
        const inner = vertexIndex(ri, xi, si)
        const outer = vertexIndex(ri + 1, xi, si)
        const innerNext = vertexIndex(ri, xi, si + 1)
        const outerNext = vertexIndex(ri + 1, xi, si + 1)
        indices.push(inner, outer, innerNext, innerNext, outer, outerNext)
      }
    }
  })

  // Close both arch feet so the volume reads as a single connected rock body.
  ;[0, SURFACE_STEPS].forEach((si) => {
    for (let ri = 0; ri < radialLevels.length - 1; ri += 1) {
      for (let xi = 0; xi < X_STEPS - 1; xi += 1) {
        const inner = vertexIndex(ri, xi, si)
        const outer = vertexIndex(ri + 1, xi, si)
        const innerNext = vertexIndex(ri, xi + 1, si)
        const outerNext = vertexIndex(ri + 1, xi + 1, si)
        indices.push(inner, innerNext, outer, outer, innerNext, outerNext)
      }
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

function createField() {
  if (fieldPoints) {
    rootGroup.remove(fieldPoints)
    fieldPoints.geometry.dispose()
    fieldPoints.material.dispose()
  }
  if (fieldSurface) {
    rootGroup.remove(fieldSurface)
    fieldSurface.geometry.dispose()
    fieldSurface.material.dispose()
  }
  if (fieldLayerGroup) {
    rootGroup.remove(fieldLayerGroup)
    disposeObject(fieldLayerGroup)
  }

  const pointCount = X_STEPS * (SURFACE_STEPS + 1) * RADIAL_STEPS
  const positions = new Float32Array(pointCount * 3)
  const colors = new Float32Array(pointCount * 3)
  let vectorCursor = 0
  for (let ri = 1; ri <= RADIAL_STEPS; ri += 1) {
    const radialRatio = ri / RADIAL_STEPS
    for (let xi = 0; xi < X_STEPS; xi += 1) {
      const x = THREE.MathUtils.lerp(LONGITUDINAL_MIN, LONGITUDINAL_MAX, xi / (X_STEPS - 1))
      for (let si = 0; si <= SURFACE_STEPS; si += 1) {
        const surfaceRatio = si / SURFACE_STEPS
        const base = archPoint(surfaceRatio)
        const normal = archNormal(surfaceRatio)
        positions[vectorCursor] = x
        positions[vectorCursor + 1] = base.y + normal.y * FIELD_DEPTH_M * radialRatio
        positions[vectorCursor + 2] = base.z + normal.z * FIELD_DEPTH_M * radialRatio
        colorAt(fieldAt(x, surfaceRatio, radialRatio), scratchColor)
        colors[vectorCursor] = scratchColor.r
        colors[vectorCursor + 1] = scratchColor.g
        colors[vectorCursor + 2] = scratchColor.b
        vectorCursor += 3
      }
    }
  }
  const pointGeometry = new THREE.BufferGeometry()
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  pointGeometry.computeBoundingSphere()
  fieldPointMaterial = new THREE.PointsMaterial({
    size: props.compact ? .082 : .095,
    sizeAttenuation: true,
    transparent: true,
    opacity: .6,
    depthWrite: false,
    vertexColors: true
  })
  fieldPoints = new THREE.Points(pointGeometry, fieldPointMaterial)
  fieldPoints.name = '分层绘制三维反演场'
  fieldPoints.renderOrder = 3
  rootGroup.add(fieldPoints)

  fieldLayerGroup = new THREE.Group()
  fieldLayerGroup.name = '连续三维围岩空间体场'
  fieldLayerMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: .34,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true
  })
  const connectedVolume = new THREE.Mesh(
    createConnectedFieldGeometry([.04, .18, .34, .5, .66, .82, 1]),
    fieldLayerMaterial
  )
  connectedVolume.name = '径向连续连接体'
  connectedVolume.renderOrder = 3
  fieldLayerGroup.add(connectedVolume)
  rootGroup.add(fieldLayerGroup)

  // Keep the analysis surface wide in X, but thin along the radial direction. The previous
  // implementation filled the whole 0 -> current-depth interval, which made the section read as
  // a large opaque plate as soon as the slider moved away from zero.
  const surfaceLayerCount = 2
  const surfacePathVertexCount = surfaceLayerCount * (SURFACE_STEPS + 1)
  const surfaceVertexCount = surfacePathVertexCount * 2
  const surfacePositions = new Float32Array(surfaceVertexCount * 3)
  const surfaceColors = new Float32Array(surfaceVertexCount * 3)
  const surfaceIndices = []
  const surfaceVertexIndex = (layer, si, side) => (layer * (SURFACE_STEPS + 1) + si) * 2 + side
  const surfaceLayerRatios = [0, 1]
  const selectedGroup = selectedSectionGroup.value || { longitudinalM: 0 }
  for (let layer = 0; layer < surfaceLayerCount; layer += 1) {
    const radialRatio = THREE.MathUtils.clamp(
      THREE.MathUtils.clamp(props.slice / 100, 0, 1)
      + (surfaceLayerRatios[layer] === 0 ? -ANALYSIS_SLICE_HALF_THICKNESS : ANALYSIS_SLICE_HALF_THICKNESS),
      0,
      1
    )
    for (let si = 0; si <= SURFACE_STEPS; si += 1) {
      const surfaceRatio = si / SURFACE_STEPS
      for (let side = 0; side < 2; side += 1) {
        writeAnalysisSliceVertex(
          surfacePositions,
          surfaceVertexIndex(layer, si, side),
          selectedGroup,
          surfaceRatio,
          radialRatio,
          side
        )
      }
    }
  }
  for (let si = 0; si < SURFACE_STEPS; si += 1) {
    const left = surfaceVertexIndex(0, si, 0)
    const leftNext = surfaceVertexIndex(0, si + 1, 0)
    const right = surfaceVertexIndex(0, si, 1)
    const rightNext = surfaceVertexIndex(0, si + 1, 1)
    surfaceIndices.push(left, leftNext, right, leftNext, rightNext, right)
    const farLeft = surfaceVertexIndex(1, si, 0)
    const farLeftNext = surfaceVertexIndex(1, si + 1, 0)
    const farRight = surfaceVertexIndex(1, si, 1)
    const farRightNext = surfaceVertexIndex(1, si + 1, 1)
    surfaceIndices.push(farLeft, farRight, farLeftNext, farLeftNext, farRight, farRightNext)
  }
  // Do not close the two layers with longitudinal side walls. The side walls made the
  // analysis slice read like a solid plate when the camera was rotated; the two faces above
  // are enough to render a thin, double-sided cut surface while keeping the tapered outline.
  const surfaceGeometry = new THREE.BufferGeometry()
  surfaceGeometry.setAttribute('position', new THREE.BufferAttribute(surfacePositions, 3))
  surfaceGeometry.setAttribute('color', new THREE.BufferAttribute(surfaceColors, 3))
  surfaceGeometry.setIndex(surfaceIndices)
  surfaceGeometry.computeBoundingSphere()
  fieldSurfaceMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: .78,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true
  })
  fieldSurface = new THREE.Mesh(surfaceGeometry, fieldSurfaceMaterial)
  fieldSurface.frustumCulled = false
  fieldSurface.name = '当前分组实测横断面'
  fieldSurface.renderOrder = 6
  rootGroup.add(fieldSurface)

  lastSurfaceBand = -1
  updateAnalysisSlice(true)
  updateProgress()
  updateViewMode()
  if (container.value) container.value.dataset.fieldPoints = String(pointCount)
  requestRender()
}

function setCylinderMatrix(target, start, end, index) {
  scratchDirection.subVectors(end, start)
  const length = scratchDirection.length()
  scratchMidpoint.copy(start).add(end).multiplyScalar(.5)
  scratchQuaternion.setFromUnitVectors(cylinderAxis, scratchDirection.normalize())
  scratchScale.set(1, length, 1)
  scratchMatrix.compose(scratchMidpoint, scratchQuaternion, scratchScale)
  target.setMatrixAt(index, scratchMatrix)
}

function setInstancePosition(target, position, index, scale = 1) {
  scratchMatrix.compose(position, scratchIdentityQuaternion, scratchScale.setScalar(scale))
  target.setMatrixAt(index, scratchMatrix)
}

function hideInstance(target, position, index) {
  scratchMatrix.compose(position, scratchIdentityQuaternion, scratchScale.set(0, 0, 0))
  target.setMatrixAt(index, scratchMatrix)
}

function sectionContainsBorehole(entry, radialRatio, sliceRatio) {
  if (radialRatio > sliceRatio) return false
  const xOffset = Math.abs(entry.direction.x * FIELD_DEPTH_M * radialRatio)
  const sliceHalfWidth = analysisSliceHalfWidth(entry.surfaceRatio, radialRatio)
  return xOffset <= sliceHalfWidth + .025
}

function sectionVisibleEnd(entry, sliceRatio) {
  if (sliceRatio <= .001 || Math.abs(entry.direction.x) < .0001) return sliceRatio
  const steps = 24
  let previousRatio = 0
  let previousInside = true
  for (let step = 1; step <= steps; step += 1) {
    const currentRatio = sliceRatio * step / steps
    const currentInside = sectionContainsBorehole(entry, currentRatio, sliceRatio)
    if (previousInside && !currentInside) {
      let lower = previousRatio
      let upper = currentRatio
      for (let iteration = 0; iteration < 8; iteration += 1) {
        const middle = (lower + upper) / 2
        if (sectionContainsBorehole(entry, middle, sliceRatio)) lower = middle
        else upper = middle
      }
      return upper
    }
    previousRatio = currentRatio
    previousInside = currentInside
  }
  return sliceRatio
}

function updateBoreholeSectionGeometry() {
  if (!boreholeMeshes.length) return
  const sectionMode = props.viewMode === 'section'
  const sliceRatio = THREE.MathUtils.clamp(props.slice / 100, 0, 1)
  boreholeEntries.forEach((entry) => {
    const visibleEndRatio = sectionMode ? sectionVisibleEnd(entry, sliceRatio) : 1
    const visibleEnd = scratchMidpoint
      .copy(entry.start)
      .addScaledVector(entry.direction, FIELD_DEPTH_M * visibleEndRatio)
    if (sectionMode && visibleEndRatio <= .001) {
      hideInstance(entry.mesh.tubes, entry.start, entry.meshIndex)
    } else {
      // In section mode only draw the trace covered by the tapered analysis slab.
      // The previous inverse segment (boundary -> full depth) protruded beyond the slice.
      setCylinderMatrix(entry.mesh.tubes, entry.start, sectionMode ? visibleEnd : entry.end, entry.meshIndex)
    }
    if (sectionMode) {
      hideInstance(entry.mesh.collars, entry.start, entry.meshIndex)
    } else {
      setInstancePosition(entry.mesh.collars, entry.start, entry.meshIndex, 1)
    }
  })
  boreholeMeshes.forEach(({ tubes, collars }) => {
    tubes.instanceMatrix.needsUpdate = true
    collars.instanceMatrix.needsUpdate = true
  })
}

function isSelectedBorehole(borehole, index) {
  const selectedNumber = Number(props.selectedBoreholeId.match(/(\d+)$/)?.[1] || 1) - 1
  const boreholeGroupId = borehole?.id?.split('-')?.[0]
  const groupMatches = !boreholeGroupId || boreholeGroupId === props.selectedGroupId
  return groupMatches && (borehole?.id === props.selectedBoreholeId || index === selectedNumber)
}

function boreholeFanDirection(normal, groupIndex, boreholeIndex) {
  const side = (groupIndex + boreholeIndex) % 2 === 0 ? -1 : 1
  const extraAngle = BOREHOLE_EXTRA_ANGLE_DEGREES[
    (groupIndex * 11 + boreholeIndex) % BOREHOLE_EXTRA_ANGLE_DEGREES.length
  ]
  const angle = THREE.MathUtils.degToRad(BOREHOLE_FAN_BASE_ANGLE_DEGREES + extraAngle)
  return normal.clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(longitudinalAxis, side * Math.sin(angle))
    .normalize()
}

function createBoreholes() {
  if (boreholeGroup) {
    rootGroup.remove(boreholeGroup)
    disposeObject(boreholeGroup)
  }
  boreholeEntries = []
  boreholeMeshes = []
  boreholeGroup = new THREE.Group()
  boreholeGroup.name = '巷道表面20-25度扇形左右交错的三组实体钻孔'

  sectionGroups.value.forEach((group, groupIndex) => {
    const entries = (group.boreholes || []).map((borehole, index) => {
      const surfaceRatio = index / Math.max((group.boreholes || []).length - 1, 1)
      const start = archPoint(surfaceRatio, .035)
      start.x = group.longitudinalM
      const normal = archNormal(surfaceRatio)
      const direction = boreholeFanDirection(normal, groupIndex, index)
      const end = start.clone().addScaledVector(direction, FIELD_DEPTH_M)
      return { borehole, index, group, surfaceRatio, start, direction, end }
    })
    if (!entries.length) return

    const groupNode = new THREE.Group()
    groupNode.name = `${group.id}组倾斜钻孔`
    groupNode.userData.groupId = group.id

    const tubeGeometry = new THREE.CylinderGeometry(BOREHOLE_TUBE_RADIUS, BOREHOLE_TUBE_RADIUS, 1, 8, 1, true)
    const collarGeometry = new THREE.SphereGeometry(BOREHOLE_COLLAR_RADIUS, 8, 6)
    const headGeometry = new THREE.SphereGeometry(BOREHOLE_HEAD_RADIUS, 8, 6)
    const tubes = new THREE.InstancedMesh(
      tubeGeometry,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: .42, depthWrite: false, vertexColors: true }),
      entries.length
    )
    const collars = new THREE.InstancedMesh(
      collarGeometry,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: .58, depthWrite: false, vertexColors: true }),
      entries.length
    )
    const heads = new THREE.InstancedMesh(
      headGeometry,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: .68, depthWrite: false, vertexColors: true }),
      entries.length
    )
    tubes.name = `${group.id}组钻孔线`
    collars.name = `${group.id}组孔口`
    heads.name = `${group.id}组钻孔端点`
    tubes.renderOrder = 7
    collars.renderOrder = 8
    heads.renderOrder = 8

    entries.forEach((entry, meshIndex) => {
      setCylinderMatrix(tubes, entry.start, entry.end, meshIndex)
      setInstancePosition(collars, entry.start, meshIndex, 1)
      boreholeEntries.push({ ...entry, mesh: { node: groupNode, tubes, collars, heads }, meshIndex })
    })
    tubes.instanceMatrix.needsUpdate = true
    collars.instanceMatrix.needsUpdate = true
    groupNode.add(tubes, collars, heads)
    boreholeGroup.add(groupNode)
    boreholeMeshes.push({ group, node: groupNode, tubes, collars, heads })
  })

  rootGroup.add(boreholeGroup)
  updateBoreholeVisibility()
  updateBoreholeSectionGeometry()
  updateBoreholeColors()
  updateBoreholeHeads()
}

function updateBoreholeColors() {
  if (!boreholeMeshes.length) return
  const sectionMode = props.viewMode === 'section'
  boreholeEntries.forEach((entry) => {
    const selected = isSelectedBorehole(entry.borehole, entry.index)
    entry.mesh.tubes.setColorAt(
      entry.meshIndex,
      scratchColor.set(sectionMode ? (selected ? '#2e210d' : '#071116') : (selected ? '#dffaff' : '#6aabb7'))
    )
    entry.mesh.collars.setColorAt(entry.meshIndex, scratchColor.set(selected ? '#75e6f5' : '#89b6bf'))
    entry.mesh.heads.setColorAt(entry.meshIndex, scratchColor.set(selected ? '#ffd16a' : '#9f8a55'))
  })
  boreholeMeshes.forEach(({ tubes, collars, heads }) => {
    if (tubes.instanceColor) tubes.instanceColor.needsUpdate = true
    if (collars.instanceColor) collars.instanceColor.needsUpdate = true
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true
  })
  requestRender()
}

function updateBoreholeVisibility() {
  const sectionMode = props.viewMode === 'section'
  const activeGroupId = selectedSectionGroup.value?.id || props.selectedGroupId
  boreholeMeshes.forEach(({ group, node }) => {
    node.visible = !sectionMode || group.id === activeGroupId
  })
  requestRender()
}

function updateBoreholeHeads() {
  if (!boreholeMeshes.length) return
  const radialRatio = THREE.MathUtils.clamp(props.slice / 100, 0, 1)
  const sectionMode = props.viewMode === 'section'
  const sliceRatio = THREE.MathUtils.clamp(props.slice / 100, 0, 1)
  boreholeEntries.forEach((entry) => {
    const markerRatio = sectionMode ? sectionVisibleEnd(entry, sliceRatio) : radialRatio
    const position = scratchMidpoint.copy(entry.start).addScaledVector(entry.direction, FIELD_DEPTH_M * markerRatio)
    if (sectionMode) {
      // Keep the marker at the real clipped endpoint instead of snapping every hole to the
      // same camera-facing edge of the slice.
      position.x += .025
      setInstancePosition(
        entry.mesh.heads,
        position,
        entry.meshIndex,
        isSelectedBorehole(entry.borehole, entry.index) ? 1.22 : .72
      )
    } else {
      setInstancePosition(
        entry.mesh.heads,
        position,
        entry.meshIndex,
        isSelectedBorehole(entry.borehole, entry.index) ? 1.18 : .78
      )
    }
  })
  boreholeMeshes.forEach(({ heads }) => {
    heads.instanceMatrix.needsUpdate = true
  })

  const center = selectedSectionGroup.value
  const selectedIndex = Math.max(0, Number(props.selectedBoreholeId.match(/(\d+)$/)?.[1] || 1) - 1)
  const borehole = center?.boreholes?.[selectedIndex]
  const sample = sampleAtDepth(borehole, radialRatio)
  if (borehole && sample) emit('sample', { borehole, sample, sliceProgress: props.slice })
}

function updateAnalysisSlice(force = false) {
  if (!fieldSurfaceMaterial || !fieldSurface) return
  const ratio = THREE.MathUtils.clamp(props.slice / 100, 0, 1)
  const group = selectedSectionGroup.value
  if (!group) return
  const positionAttribute = fieldSurface.geometry.getAttribute('position')
  const colorAttribute = fieldSurface.geometry.getAttribute('color')
  let vertexIndex = 0
  const layerRatios = [
    THREE.MathUtils.clamp(ratio - ANALYSIS_SLICE_HALF_THICKNESS, 0, 1),
    THREE.MathUtils.clamp(ratio + ANALYSIS_SLICE_HALF_THICKNESS, 0, 1)
  ]
  for (const sampledRatio of layerRatios) {
    for (let si = 0; si <= SURFACE_STEPS; si += 1) {
      const surfaceRatio = si / SURFACE_STEPS
      for (let side = 0; side < 2; side += 1) {
        writeAnalysisSliceVertex(
          positionAttribute.array,
          vertexIndex,
          group,
          surfaceRatio,
          sampledRatio,
          side
        )
        colorAt(sampleValue(group, surfaceRatio, sampledRatio), scratchColor)
        colorAttribute.setXYZ(vertexIndex, scratchColor.r, scratchColor.g, scratchColor.b)
        vertexIndex += 1
      }
    }
  }
  positionAttribute.needsUpdate = true
  colorAttribute.needsUpdate = true
  fieldSurface.geometry.computeBoundingSphere()
  updateBoreholeSectionGeometry()
  updateBoreholeHeads()
  requestRender()
}

function updateProgress() {
  if (!fieldPoints) return
  const ratio = THREE.MathUtils.clamp(props.progress / 100, 0, 1)
  const visibleRadialBands = Math.ceil(ratio * RADIAL_STEPS)
  fieldPoints.geometry.setDrawRange(0, visibleRadialBands * X_STEPS * (SURFACE_STEPS + 1))
  requestRender()
}

function updateViewMode() {
  if (!fieldPoints || !fieldSurface || !fieldLayerGroup || !rockMass) return
  const cloudMode = props.viewMode === 'cloud'
  const sectionMode = props.viewMode === 'section'
  fieldPoints.visible = cloudMode || props.viewMode === 'iso'
  fieldPointMaterial.opacity = props.viewMode === 'iso' ? .78 : .16
  fieldPointMaterial.size = props.viewMode === 'iso' ? .105 : props.compact ? .058 : .066
  fieldLayerGroup.visible = cloudMode
  fieldLayerMaterial.opacity = props.compact ? .29 : .34
  fieldSurface.visible = sectionMode
  // The section is a thin, readable overlay rather than a translucent rectangular box.
  // Keep its two faces bright enough to read, then put the clipped dark borehole traces above it.
  fieldSurfaceMaterial.opacity = sectionMode ? .82 : .78
  fieldSurfaceMaterial.depthWrite = false
  fieldSurface.renderOrder = sectionMode ? 10 : 6
  boreholeMeshes.forEach(({ tubes, collars, heads }) => {
    tubes.visible = true
    collars.visible = !sectionMode
    heads.visible = true
    tubes.renderOrder = sectionMode ? 11 : 7
    collars.renderOrder = sectionMode ? 5 : 8
    heads.renderOrder = sectionMode ? 12 : 8
    tubes.material.depthTest = !sectionMode
    collars.material.depthTest = !sectionMode
    heads.material.depthTest = !sectionMode
    tubes.material.opacity = sectionMode ? .82 : props.viewMode === 'iso' ? .5 : .42
    collars.material.opacity = .58
    heads.material.opacity = sectionMode ? .9 : .68
  })
  updateBoreholeVisibility()
  updateBoreholeColors()
  updateBoreholeSectionGeometry()
  updateBoreholeHeads()
  updateSectionGuideVisibility()
  if (controls) {
    controls.autoRotate = props.autoRotate && !sectionMode
    if (sectionMode && lastViewMode !== 'section') {
      const sectionX = Number(selectedSectionGroup.value?.longitudinalM) || 0
      controls.target.set(sectionX, .5, 0)
      camera.position.set(sectionX + 18.5, .7, .15)
      controls.update()
    }
  }
  lastViewMode = props.viewMode
  // Avoid the full rock extrusion and floor rectangle competing with the selected section.
  // The cavity shell remains as a subtle roadway silhouette for orientation.
  rockMass.visible = !sectionMode
  rockEdges.visible = !sectionMode
  roadwayFloor.visible = !sectionMode
  cavitySurface.visible = true
  rockMass.material[0].opacity = cloudMode ? .48 : sectionMode ? .04 : .18
  rockMass.material[1].opacity = cloudMode ? .31 : sectionMode ? .025 : .09
  rockEdges.material.opacity = cloudMode ? .58 : sectionMode ? .04 : .24
  cavitySurface.material.opacity = cloudMode ? .52 : sectionMode ? .22 : .24
  roadwayFloor.material.opacity = cloudMode ? .46 : sectionMode ? .04 : .2
  rootGroup.rotation.set(0, 0, 0)
  requestRender()
}

function updateAutoRotate() {
  if (!controls) return
  controls.autoRotate = props.autoRotate && props.viewMode !== 'section'
  if (!props.autoRotate) {
    const dampingEnabled = controls.enableDamping
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = dampingEnabled
  }
  requestRender(350)
}

function disposeObject(object) {
  object.traverse?.((child) => {
    child.geometry?.dispose?.()
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
    else child.material?.dispose?.()
  })
}

function init() {
  if (!container.value || !canvasElement.value) return
  try {
    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2('#06111a', .018)
    camera = new THREE.PerspectiveCamera(34, container.value.clientWidth / container.value.clientHeight, .1, 120)
    camera.position.set(17.8, 3.7, 19.6)

    renderer = new THREE.WebGLRenderer({
      canvas: canvasElement.value,
      antialias: !props.compact,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'mediump'
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, props.compact ? 1 : 1.25))
    renderer.setSize(container.value.clientWidth, container.value.clientHeight, false)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    container.value.dataset.maxFps = String(MAX_RENDER_FPS)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = .07
    controls.minDistance = 13
    controls.maxDistance = 46
    controls.target.set(0, .5, 0)
    controls.autoRotate = props.autoRotate
    controls.autoRotateSpeed = .24
    controls.addEventListener('start', () => {
      controlsDragging = true
      requestRender()
    })
    controls.addEventListener('change', () => requestRender(180))
    controls.addEventListener('end', () => {
      controlsDragging = false
      requestRender(450)
    })

    scene.add(new THREE.HemisphereLight('#d9edf2', '#071019', 1.2))
    const key = new THREE.DirectionalLight('#e7f8fb', 1.65)
    key.position.set(8, 12, 9)
    scene.add(key)
    const fill = new THREE.DirectionalLight('#537f8c', .85)
    fill.position.set(-9, 2, -8)
    scene.add(fill)

    rootGroup = new THREE.Group()
    scene.add(rootGroup)
    createRockMass()
    createRoadwayCavity()
    createSectionGuides()
    createBoreholes()
    createField()

    resizeObserver = new ResizeObserver(() => {
      const width = Math.max(container.value?.clientWidth || 1, 1)
      const height = Math.max(container.value?.clientHeight || 1, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      requestRender()
    })
    resizeObserver.observe(container.value)

    intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry?.isIntersecting ?? true
      if (isIntersecting) requestRender()
    }, { threshold: .02 })
    intersectionObserver.observe(container.value)
    animate()
  } catch (error) {
    webglReady.value = false
    webglError.value = error?.message || String(error)
  }
}

function animate(timestamp = 0) {
  animationFrame = requestAnimationFrame(animate)
  if (!renderer || !isIntersecting || document.visibilityState === 'hidden') return
  const active = props.autoRotate || controlsDragging || renderRequested || timestamp < settleUntil
  if (!active || timestamp - lastFrameTime < FRAME_INTERVAL) return
  lastFrameTime = timestamp
  controls.autoRotate = props.autoRotate && props.viewMode !== 'section'
  controls.update()
  renderer.render(scene, camera)
  renderRequested = false
}

watch(() => props.progress, updateProgress)
watch(() => props.slice, () => updateAnalysisSlice())
watch(() => props.viewMode, updateViewMode)
watch(() => props.autoRotate, updateAutoRotate)
watch(() => props.metric, createField)
watch(() => props.spatialGroups, () => {
  if (!rootGroup) return
  createSectionGuides()
  createBoreholes()
  createField()
}, { deep: false })
watch(() => props.selectedBoreholeId, () => {
  updateBoreholeColors()
  updateBoreholeHeads()
})
watch(() => props.selectedGroupId, () => {
  if (!rootGroup) return
  createSectionGuides()
  updateBoreholeVisibility()
  updateBoreholeColors()
  updateAnalysisSlice(true)
  if (props.viewMode === 'section' && controls) {
    const sectionX = Number(selectedSectionGroup.value?.longitudinalM) || 0
    const delta = sectionX - controls.target.x
    camera.position.x += delta
    controls.target.x = sectionX
    controls.update()
  }
})

onMounted(init)
onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  controls?.dispose()
  if (scene) disposeObject(scene)
  renderer?.dispose()
})
</script>

<style scoped>
.volume-cloud-canvas { position: absolute; inset: 0; overflow: hidden; }
.volume-cloud-canvas::after { position: absolute; inset: 0; z-index: 1; content: ''; pointer-events: none; background: radial-gradient(circle at 52% 45%, transparent 46%, rgba(3, 10, 17, .46) 100%); }
.canvas-host { position: absolute; inset: 0; display: block; width: 100%; height: 100%; outline: none; }
.field-header { position: absolute; z-index: 4; top: 14px; left: 14px; display: flex; align-items: center; gap: 9px; pointer-events: none; }
.field-symbol { display: grid; place-items: center; min-width: 76px; height: 34px; color: #e1edf0; font: italic 11px Georgia, serif; background: rgba(7, 18, 26, .78); border: 1px solid rgba(132, 164, 175, .3); }
.field-header strong, .field-header small { display: block; }
.field-header strong { color: #d4e1e4; font-size: 10px; font-weight: 500; letter-spacing: 1px; }
.field-header small { margin-top: 3px; color: #64818c; font-size: 6px; letter-spacing: 1px; }
.coordinate-note { position: absolute; z-index: 4; top: 57px; left: 14px; display: flex; gap: 4px; pointer-events: none; }
.coordinate-note span, .spatial-status, .depth-readout { color: #78929c; background: rgba(7, 18, 26, .72); border: 1px solid rgba(113, 145, 157, .18); }
.coordinate-note span { padding: 4px 7px; font-size: 7px; }
.coordinate-note b { margin-right: 3px; color: #d5e2e5; font-family: Georgia, serif; }
.spatial-status { position: absolute; z-index: 4; top: 14px; right: 15px; display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 7px; }
.spatial-status i { width: 6px; height: 6px; background: #54d7a1; border-radius: 50%; box-shadow: 0 0 8px rgba(84, 215, 161, .7); }
.spatial-status strong { color: #d9e6e8; font-weight: 500; }
.section-key { position: absolute; z-index: 4; right: 15px; top: 48px; display: flex; gap: 4px; pointer-events: none; }
.section-key > span { display: grid; grid-template-columns: 4px auto; column-gap: 5px; padding: 5px 7px; background: rgba(6, 17, 24, .76); border: 1px solid rgba(115, 158, 170, .18); }
.section-key i { grid-row: 1 / 3; width: 3px; background: #69ccde; }
.section-key strong { color: #cadadd; font-size: 7px; font-weight: 500; }
.section-key small { color: #607a85; font-size: 6px; }
.section-key > span.active { border-color: rgba(230, 193, 104, .55); background: rgba(70, 55, 25, .48); }
.section-key > span.active i { background: #e5bd61; box-shadow: 0 0 7px rgba(229, 189, 97, .5); }
.section-key > span.active strong { color: #f1db9d; }
.mode-readout { position: absolute; z-index: 4; left: 16px; bottom: 38px; display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; pointer-events: none; background: rgba(5, 16, 23, .76); border-left: 2px solid #71c9d8; }
.mode-readout strong { color: #d9e7e9; font-size: 8px; font-weight: 500; }
.mode-readout span { color: #637d86; font-size: 6px; }
.volume-cloud-canvas.section .mode-readout { border-left-color: #e5bd61; }
.volume-cloud-canvas.section .mode-readout strong { color: #f0d89a; }
.depth-readout { position: absolute; z-index: 4; right: 16px; bottom: 15px; min-width: 105px; padding: 6px 8px; text-align: right; pointer-events: none; }
.depth-readout span { display: block; font-size: 6px; }
.depth-readout strong { display: block; margin-top: 2px; color: #e2ecee; font: 12px Electronic, monospace; }
.depth-readout em { color: #718a94; font-size: 7px; font-style: normal; }
.view-hint { position: absolute; z-index: 4; left: 16px; bottom: 15px; display: flex; align-items: center; gap: 7px; color: rgba(154, 180, 190, .48); font-size: 8px; opacity: .58; transition: opacity .2s; }
.view-hint.visible { opacity: 1; }
.view-hint i { width: 1px; height: 9px; background: rgba(137, 165, 176, .25); }
.webgl-fallback { position: absolute; inset: 0; z-index: 10; display: grid; place-content: center; gap: 8px; text-align: center; color: #8fa8b2; background: rgba(5, 13, 20, .95); }
.webgl-fallback strong { color: #8ce7f7; letter-spacing: 3px; }
.volume-cloud-canvas.compact .coordinate-note { display: none; }
.volume-cloud-canvas.compact .field-header { top: 10px; left: 11px; }
.volume-cloud-canvas.compact .spatial-status { top: 10px; right: 10px; }
.volume-cloud-canvas.compact .section-key { top: 44px; right: 10px; }
@media (max-width: 1100px) {
  .section-key { display: none; }
  .spatial-status strong { display: none; }
}
</style>
