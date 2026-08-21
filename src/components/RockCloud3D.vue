<template>
  <div
    ref="container"
    class="volume-cloud-canvas"
    :class="{ compact }"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
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
      <span><i></i>A / B / C 三个实测反演断面</span>
      <strong>33 孔空间联合插值</strong>
    </div>
    <div class="section-key">
      <span v-for="group in sectionGroups" :key="group.id">
        <i></i><strong>{{ group.id }}组</strong><small>{{ group.longitudinalM }} m · 11孔</small>
      </span>
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
  maxDepth: { type: Number, default: 125 }
})

const emit = defineEmits(['sample', 'select', 'slice-select'])
const container = ref(null)
const hovered = ref(false)
const webglReady = ref(true)
const webglError = ref('')
const selectedDepth = computed(() => props.maxDepth * THREE.MathUtils.clamp(props.slice / 100, 0, 1))
const sectionGroups = computed(() => props.spatialGroups.slice().sort((a, b) => a.longitudinalM - b.longitudinalM))
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
const ROCK_HALF_WIDTH = 5.45
const ROCK_BOTTOM_Y = -3.55
const ROCK_TOP_Y = 5.35
const X_STEPS = 25
const SURFACE_STEPS = 48
const RADIAL_STEPS = 9
const MAX_RENDER_FPS = 30
const FRAME_INTERVAL = 1000 / MAX_RENDER_FPS

let scene, camera, renderer, controls, resizeObserver, intersectionObserver, animationFrame
let rootGroup, fieldPoints, fieldSurface, rockMass, rockEdges, cavitySurface, roadwayFloor
let boreholeGroup, boreholeTubes, boreholeCollars, boreholeHeads, sectionGuideGroup
let fieldPointMaterial, fieldSurfaceMaterial
let isIntersecting = true
let controlsDragging = false
let renderRequested = true
let settleUntil = 0
let lastFrameTime = 0
let lastSurfaceBand = -1
let boreholeEntries = []

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
          color: colors[groupIndex] || colors[0],
          transparent: true,
          opacity: groupIndex === 1 ? .6 : .38,
          dashSize: .18,
          gapSize: .11,
          depthWrite: false
        })
      )
      line.computeLineDistances()
      line.renderOrder = 5
      sectionGuideGroup.add(line)
    })
  })
  rootGroup.add(sectionGuideGroup)
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

  const surfaceVertexCount = X_STEPS * (SURFACE_STEPS + 1)
  const surfacePositions = new Float32Array(surfaceVertexCount * 3)
  const surfaceOutward = new Float32Array(surfaceVertexCount * 3)
  const surfaceColors = new Float32Array(surfaceVertexCount * 3)
  const surfaceIndices = []
  let surfaceCursor = 0
  for (let xi = 0; xi < X_STEPS; xi += 1) {
    const x = THREE.MathUtils.lerp(LONGITUDINAL_MIN, LONGITUDINAL_MAX, xi / (X_STEPS - 1))
    for (let si = 0; si <= SURFACE_STEPS; si += 1) {
      const ratio = si / SURFACE_STEPS
      const base = archPoint(ratio)
      const normal = archNormal(ratio)
      surfacePositions[surfaceCursor] = x
      surfacePositions[surfaceCursor + 1] = base.y
      surfacePositions[surfaceCursor + 2] = base.z
      surfaceOutward[surfaceCursor] = normal.x
      surfaceOutward[surfaceCursor + 1] = normal.y
      surfaceOutward[surfaceCursor + 2] = normal.z
      surfaceCursor += 3
    }
  }
  for (let xi = 0; xi < X_STEPS - 1; xi += 1) {
    for (let si = 0; si < SURFACE_STEPS; si += 1) {
      const current = xi * (SURFACE_STEPS + 1) + si
      const next = current + SURFACE_STEPS + 1
      surfaceIndices.push(current, next, current + 1, current + 1, next, next + 1)
    }
  }
  const surfaceGeometry = new THREE.BufferGeometry()
  surfaceGeometry.setAttribute('position', new THREE.BufferAttribute(surfacePositions, 3))
  surfaceGeometry.setAttribute('outward', new THREE.BufferAttribute(surfaceOutward, 3))
  surfaceGeometry.setAttribute('color', new THREE.BufferAttribute(surfaceColors, 3))
  surfaceGeometry.setIndex(surfaceIndices)
  surfaceGeometry.computeBoundingSphere()
  fieldSurfaceMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: .56,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true
  })
  fieldSurface = new THREE.Mesh(surfaceGeometry, fieldSurfaceMaterial)
  fieldSurface.userData.basePositions = surfacePositions.slice()
  fieldSurface.userData.outward = surfaceOutward
  fieldSurface.frustumCulled = false
  fieldSurface.name = '当前径向分析等值面'
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

function isSelectedBorehole(borehole, index) {
  const selectedNumber = Number(props.selectedBoreholeId.match(/(\d+)$/)?.[1] || 1) - 1
  return borehole?.id === props.selectedBoreholeId || index === selectedNumber
}

function createBoreholes() {
  if (boreholeGroup) {
    rootGroup.remove(boreholeGroup)
    disposeObject(boreholeGroup)
  }
  boreholeEntries = []
  sectionGroups.value.forEach((group) => {
    group.boreholes.forEach((borehole, index) => {
      const surfaceRatio = index / Math.max(group.boreholes.length - 1, 1)
      const start = archPoint(surfaceRatio, .035)
      start.x = group.longitudinalM
      const normal = archNormal(surfaceRatio)
      const end = start.clone().addScaledVector(normal, FIELD_DEPTH_M)
      boreholeEntries.push({ borehole, index, group, start, normal, end })
    })
  })

  boreholeGroup = new THREE.Group()
  boreholeGroup.name = '巷道表面钻入围岩的三组实体钻孔'
  const count = boreholeEntries.length
  const tubeGeometry = new THREE.CylinderGeometry(.048, .048, 1, 8, 1, true)
  const collarGeometry = new THREE.SphereGeometry(.075, 8, 6)
  const headGeometry = new THREE.SphereGeometry(.085, 8, 6)
  boreholeTubes = new THREE.InstancedMesh(
    tubeGeometry,
    new THREE.MeshBasicMaterial({ transparent: true, opacity: .82, depthWrite: false, vertexColors: true }),
    count
  )
  boreholeCollars = new THREE.InstancedMesh(
    collarGeometry,
    new THREE.MeshBasicMaterial({ vertexColors: true }),
    count
  )
  boreholeHeads = new THREE.InstancedMesh(
    headGeometry,
    new THREE.MeshBasicMaterial({ vertexColors: true }),
    count
  )
  boreholeTubes.renderOrder = 7
  boreholeCollars.renderOrder = 8
  boreholeHeads.renderOrder = 8

  boreholeEntries.forEach((entry, index) => {
    setCylinderMatrix(boreholeTubes, entry.start, entry.end, index)
    setInstancePosition(boreholeCollars, entry.start, index, 1)
  })
  boreholeTubes.instanceMatrix.needsUpdate = true
  boreholeCollars.instanceMatrix.needsUpdate = true
  boreholeGroup.add(boreholeTubes, boreholeCollars, boreholeHeads)
  rootGroup.add(boreholeGroup)
  updateBoreholeColors()
  updateBoreholeHeads()
}

function updateBoreholeColors() {
  if (!boreholeTubes || !boreholeCollars || !boreholeHeads) return
  boreholeEntries.forEach((entry, index) => {
    const selected = isSelectedBorehole(entry.borehole, entry.index)
    boreholeTubes.setColorAt(index, scratchColor.set(selected ? '#e9fdff' : '#b7d6de'))
    boreholeCollars.setColorAt(index, scratchColor.set(selected ? '#75e6f5' : '#d1e8ed'))
    boreholeHeads.setColorAt(index, scratchColor.set(selected ? '#ffd16a' : '#d0ae58'))
  })
  if (boreholeTubes.instanceColor) boreholeTubes.instanceColor.needsUpdate = true
  if (boreholeCollars.instanceColor) boreholeCollars.instanceColor.needsUpdate = true
  if (boreholeHeads.instanceColor) boreholeHeads.instanceColor.needsUpdate = true
  requestRender()
}

function updateBoreholeHeads() {
  if (!boreholeHeads) return
  const radialRatio = THREE.MathUtils.clamp(props.slice / 100, 0, 1)
  boreholeEntries.forEach((entry, index) => {
    const position = scratchMidpoint.copy(entry.start).addScaledVector(entry.normal, FIELD_DEPTH_M * radialRatio)
    setInstancePosition(boreholeHeads, position, index, isSelectedBorehole(entry.borehole, entry.index) ? 1.28 : .82)
  })
  boreholeHeads.instanceMatrix.needsUpdate = true

  const center = sectionGroups.value[Math.floor(sectionGroups.value.length / 2)]
  const selectedIndex = Math.max(0, Number(props.selectedBoreholeId.match(/(\d+)$/)?.[1] || 1) - 1)
  const borehole = center?.boreholes?.[selectedIndex]
  const sample = sampleAtDepth(borehole, radialRatio)
  if (borehole && sample) emit('sample', { borehole, sample, sliceProgress: props.slice })
}

function updateAnalysisSlice(force = false) {
  if (!fieldSurfaceMaterial || !fieldSurface) return
  const ratio = THREE.MathUtils.clamp(props.slice / 100, 0, 1)
  const positionAttribute = fieldSurface.geometry.getAttribute('position')
  const basePositions = fieldSurface.userData.basePositions
  const outward = fieldSurface.userData.outward
  const distance = FIELD_DEPTH_M * ratio
  for (let index = 0; index < positionAttribute.array.length; index += 3) {
    positionAttribute.array[index] = basePositions[index] + outward[index] * distance
    positionAttribute.array[index + 1] = basePositions[index + 1] + outward[index + 1] * distance
    positionAttribute.array[index + 2] = basePositions[index + 2] + outward[index + 2] * distance
  }
  positionAttribute.needsUpdate = true
  const band = Math.round(ratio * RADIAL_STEPS)
  if (force || band !== lastSurfaceBand) {
    lastSurfaceBand = band
    const sampledRatio = band / RADIAL_STEPS
    const colorAttribute = fieldSurface.geometry.getAttribute('color')
    let vertexIndex = 0
    for (let xi = 0; xi < X_STEPS; xi += 1) {
      const x = THREE.MathUtils.lerp(LONGITUDINAL_MIN, LONGITUDINAL_MAX, xi / (X_STEPS - 1))
      for (let si = 0; si <= SURFACE_STEPS; si += 1) {
        colorAt(fieldAt(x, si / SURFACE_STEPS, sampledRatio), scratchColor)
        colorAttribute.setXYZ(vertexIndex, scratchColor.r, scratchColor.g, scratchColor.b)
        vertexIndex += 1
      }
    }
    colorAttribute.needsUpdate = true
  }
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
  if (!fieldPoints || !fieldSurface || !rockMass) return
  const pointOpacity = props.viewMode === 'section' ? .12 : props.viewMode === 'iso' ? .72 : .56
  const surfaceOpacity = props.viewMode === 'section' ? .82 : props.viewMode === 'iso' ? .28 : .58
  fieldPointMaterial.opacity = pointOpacity
  fieldPointMaterial.size = props.viewMode === 'iso' ? .105 : props.compact ? .082 : .095
  fieldSurfaceMaterial.opacity = surfaceOpacity
  fieldSurface.visible = props.viewMode !== 'iso'
  rockMass.material[0].opacity = props.viewMode === 'section' ? .13 : .22
  rockMass.material[1].opacity = props.viewMode === 'section' ? .075 : .13
  cavitySurface.material.opacity = props.viewMode === 'section' ? .16 : .31
  roadwayFloor.material.opacity = props.viewMode === 'section' ? .14 : .28
  requestRender()
}

function updateAutoRotate() {
  if (!controls) return
  controls.autoRotate = props.autoRotate
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
  if (!container.value) return
  try {
    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2('#06111a', .018)
    camera = new THREE.PerspectiveCamera(34, container.value.clientWidth / container.value.clientHeight, .1, 120)
    camera.position.set(17.8, 9.4, 19.6)

    renderer = new THREE.WebGLRenderer({
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
    container.value.prepend(renderer.domElement)
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
    rootGroup.rotation.x = -.025
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
  controls.autoRotate = props.autoRotate
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

onMounted(init)
onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  controls?.dispose()
  if (scene) disposeObject(scene)
  renderer?.dispose()
  renderer?.domElement?.remove()
})
</script>

<style scoped>
.volume-cloud-canvas { position: absolute; inset: 0; overflow: hidden; }
.volume-cloud-canvas::after { position: absolute; inset: 0; z-index: 1; content: ''; pointer-events: none; background: radial-gradient(circle at 52% 45%, transparent 46%, rgba(3, 10, 17, .46) 100%); }
.volume-cloud-canvas :deep(canvas) { display: block; width: 100%; height: 100%; outline: none; }
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
