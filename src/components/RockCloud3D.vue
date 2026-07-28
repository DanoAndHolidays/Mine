<template>
  <div ref="container" class="volume-cloud-canvas" :class="{ compact }" @pointermove="onPointerMove" @pointerleave="hovered = false" @click="onSceneClick">
    <div class="field-header">
      <span class="field-symbol">{{ metricMeta.symbol }}</span>
      <div>
        <strong>{{ metricMeta.title }}</strong>
        <small>{{ metricMeta.subtitle }}</small>
      </div>
    </div>

    <div class="coordinate-note">
      <span><b>θ</b> 11 孔环向位置</span>
      <span><b>r</b> 径向钻深 0–{{ maxDepth }} cm</span>
      <span><b>X<sub>t</sub></b> 时间展开轴（非实测纵向距离）</span>
    </div>

    <div class="slice-status">
      <span class="status-current"><i></i>当前演进面 {{ currentDepth.toFixed(1) }} cm</span>
      <span class="status-selected"><i></i>分析面 {{ selectedDepth.toFixed(1) }} cm</span>
      <span>连续包络连接 · Δr ≈ {{ sliceStepDepth.toFixed(1) }} cm</span>
    </div>

    <div class="slice-selector" @click.stop>
      <div class="selector-title"><span>TIME SLICES</span><strong>{{ selectedSliceIndex + 1 }} / {{ SLICE_COUNT }}</strong></div>
      <div class="selector-track">
        <button
          v-for="index in SLICE_COUNT"
          :key="index"
          :aria-label="`选择第 ${index} 个时序切面`"
          :title="`${sliceDepth(index - 1).toFixed(1)} cm`"
          :class="{
            passed: index - 1 <= currentSliceIndex,
            current: index - 1 === currentSliceIndex,
            selected: index - 1 === selectedSliceIndex
          }"
          @click="selectSlice(index - 1)"
        ><i></i></button>
      </div>
      <div class="selector-axis"><span>0 cm</span><span>径向钻深 / 时间</span><span>{{ maxDepth }} cm</span></div>
    </div>

    <div class="view-hint" :class="{ visible: hovered }">
      <span>拖拽旋转</span><i></i><span>滚轮缩放</span><i></i><span>点击切面分析</span>
    </div>
    <div v-if="viewMode === 'section'" class="mode-note"><i></i>单切面分析 · {{ selectedDepth.toFixed(1) }} cm</div>
    <div v-if="viewMode === 'iso'" class="mode-note"><i></i>等值点云 · 历史时序体</div>

    <div v-if="!webglReady" class="webgl-fallback">
      <strong>3D ENGINE OFFLINE</strong>
      <span>当前浏览器未启用 WebGL</span>
      <small v-if="webglError">{{ webglError }}</small>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

const props = defineProps({
  progress: { type: Number, default: 0 },
  metric: { type: String, default: 'stress' },
  slice: { type: Number, default: 0 },
  autoRotate: { type: Boolean, default: true },
  viewMode: { type: String, default: 'cloud' },
  compact: { type: Boolean, default: false },
  playing: { type: Boolean, default: true },
  speed: { type: Number, default: 1 },
  modelId: { type: String, default: 'v3' },
  boreholes: { type: Array, default: () => [] },
  selectedBoreholeId: { type: String, default: '' },
  maxDepth: { type: Number, default: 125 }
})

const emit = defineEmits(['sample', 'select', 'slice-select'])
const container = ref(null)
const hovered = ref(false)
const webglReady = ref(true)
const webglError = ref('')

const SLICE_COUNT = 17
const TUNNEL_RADIUS = 1.72
const CLOUD_RADIUS = 4.25
const VOLUME_LENGTH = 7.8
const RADIAL_STEPS = 32
const ANGULAR_STEPS = 96
const ENVELOPE_STEPS = 65

const metricMeta = computed(() => {
  if (props.metric === 'damage') return { symbol: 'D(θ,r,t)', title: '损伤反演拟合场', subtitle: 'DAMAGE INVERSION · PERIODIC RBF' }
  if (props.metric === 'error') return { symbol: 'E(θ,r,t)', title: '联合误差拟合场', subtitle: 'NORMALIZED JOINT ERROR FIELD' }
  return { symbol: 'σ(θ,r,t)', title: '应力反演拟合场', subtitle: 'STRESS INVERSION · PERIODIC RBF' }
})

const currentRatio = computed(() => THREE.MathUtils.clamp(props.progress / 100, 0, 1))
const selectedRatio = computed(() => THREE.MathUtils.clamp(props.slice / 100, 0, 1))
const currentDepth = computed(() => props.maxDepth * currentRatio.value)
const selectedDepth = computed(() => props.maxDepth * selectedRatio.value)
const sliceStepDepth = computed(() => props.maxDepth / (SLICE_COUNT - 1))
const currentSliceIndex = computed(() => Math.round(currentRatio.value * (SLICE_COUNT - 1)))
const selectedSliceIndex = computed(() => Math.round(selectedRatio.value * (SLICE_COUNT - 1)))

let scene, camera, renderer, labelRenderer, controls, animationFrame, resizeObserver, clock
let rootGroup, tunnelMesh, tunnelWire, temporalCage, temporalEnvelope, temporalTrajectoryGroup, analysisBoreholeGroup
let raycaster, pointer
const temporalSlices = []
const temporalTrajectories = []
const sliceHitTargets = []
const boreholeObjects = []
const boreholeTargets = []

// Deep, high-contrast scientific palettes. Stress and damage remain visually
// distinct while keeping the same low-to-high reading direction.
const palettes = {
  stress: [
    [0.00, new THREE.Color('#000b38')],
    [0.16, new THREE.Color('#0037a8')],
    [0.34, new THREE.Color('#007fc4')],
    [0.52, new THREE.Color('#00a86b')],
    [0.68, new THREE.Color('#9cb900')],
    [0.82, new THREE.Color('#e47700')],
    [0.93, new THREE.Color('#e62b00')],
    [1.00, new THREE.Color('#9d001f')]
  ],
  damage: [
    [0.00, new THREE.Color('#10002f')],
    [0.16, new THREE.Color('#351080')],
    [0.34, new THREE.Color('#2656b8')],
    [0.52, new THREE.Color('#008c8f')],
    [0.68, new THREE.Color('#72a800')],
    [0.82, new THREE.Color('#d47400')],
    [0.93, new THREE.Color('#d52300')],
    [1.00, new THREE.Color('#82001d')]
  ],
  error: [
    [0.00, new THREE.Color('#020914')],
    [0.28, new THREE.Color('#123d62')],
    [0.55, new THREE.Color('#168b91')],
    [0.78, new THREE.Color('#d28b18')],
    [1.00, new THREE.Color('#9d071d')]
  ]
}

function sliceDepth(index) {
  return index / (SLICE_COUNT - 1) * props.maxDepth
}

function selectSlice(index) {
  emit('slice-select', index / (SLICE_COUNT - 1) * 100)
}

function colorAt(value) {
  const palette = palettes[props.metric] || palettes.stress
  const normalized = THREE.MathUtils.clamp(value, 0, 1)
  for (let index = 0; index < palette.length - 1; index += 1) {
    const [start, startColor] = palette[index]
    const [end, endColor] = palette[index + 1]
    if (normalized <= end) return startColor.clone().lerp(endColor, (normalized - start) / (end - start))
  }
  return palette.at(-1)[1].clone()
}

function sampleAtRatio(borehole, ratio) {
  const rows = borehole?.samples || []
  if (!rows.length) return null
  const index = Math.min(Math.round(THREE.MathUtils.clamp(ratio, 0, 1) * (rows.length - 1)), rows.length - 1)
  return rows[index]
}

function interpolatedFieldAtRatio(borehole, ratio) {
  const rows = borehole?.samples || []
  if (!rows.length) return 0
  if (rows.length === 1) return normalizedField(rows[0])
  const position = THREE.MathUtils.clamp(ratio, 0, 1) * (rows.length - 1)
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.min(lowerIndex + 1, rows.length - 1)
  const amount = position - lowerIndex
  return THREE.MathUtils.lerp(normalizedField(rows[lowerIndex]), normalizedField(rows[upperIndex]), amount)
}

function normalizedField(sample) {
  if (!sample) return 0
  const prediction = sample.predictions?.[props.modelId] || {}
  const predictedDamage = Number(prediction.damage ?? sample.actualDamage ?? 0)
  const predictedStress = Number(prediction.stress ?? sample.actualStress ?? 0)
  if (props.metric === 'damage') return THREE.MathUtils.clamp(predictedDamage / 80, 0, 1)
  if (props.metric === 'error') {
    const damageError = Math.abs(predictedDamage - Number(sample.actualDamage || 0)) / 80
    const stressError = Math.abs(predictedStress - Number(sample.actualStress || 0)) / 40
    return THREE.MathUtils.clamp((damageError + stressError) / 2, 0, 1)
  }
  return THREE.MathUtils.clamp(predictedStress / 40, 0, 1)
}

function circularDistance(a, b) {
  const distance = Math.abs(a - b) % (Math.PI * 2)
  return Math.min(distance, Math.PI * 2 - distance)
}

function fieldAt(angle, radialRatio) {
  if (!props.boreholes.length) return 0
  // Periodic Gaussian RBF interpolation. The tighter, data-spacing-derived
  // bandwidth preserves measured borehole peaks instead of washing them out.
  const spread = (Math.PI * 2 / props.boreholes.length) * 0.46
  let weighted = 0
  let totalWeight = 0
  props.boreholes.forEach((borehole) => {
    const boreholeAngle = THREE.MathUtils.degToRad(Number(borehole.angleDeg || 0))
    const distance = circularDistance(angle, boreholeAngle)
    const weight = Math.exp(-0.5 * Math.pow(distance / spread, 2)) + 0.0002
    weighted += interpolatedFieldAtRatio(borehole, radialRatio) * weight
    totalWeight += weight
  })
  return totalWeight ? weighted / totalWeight : 0
}

function pointOnRing(radius, angle, x = 0) {
  return new THREE.Vector3(x, Math.sin(angle) * radius, Math.cos(angle) * radius)
}

function createAnnularGeometry() {
  const positions = []
  const colors = []
  const indices = []
  for (let radial = 0; radial <= RADIAL_STEPS; radial += 1) {
    const radius = TUNNEL_RADIUS + (CLOUD_RADIUS - TUNNEL_RADIUS) * (radial / RADIAL_STEPS)
    for (let angular = 0; angular <= ANGULAR_STEPS; angular += 1) {
      const angle = angular / ANGULAR_STEPS * Math.PI * 2
      const point = pointOnRing(radius, angle)
      positions.push(point.x, point.y, point.z)
      colors.push(0.04, 0.08, 0.12)
    }
  }
  for (let radial = 0; radial < RADIAL_STEPS; radial += 1) {
    for (let angular = 0; angular < ANGULAR_STEPS; angular += 1) {
      const current = radial * (ANGULAR_STEPS + 1) + angular
      const next = current + ANGULAR_STEPS + 1
      indices.push(current, next, current + 1, current + 1, next, next + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function makeLabel(className) {
  const element = document.createElement('div')
  element.className = `spatial-label ${className}`
  const label = new CSS2DObject(element)
  label.center.set(0.5, 0.5)
  return label
}

function createTunnelReference() {
  const geometry = new THREE.CylinderGeometry(TUNNEL_RADIUS, TUNNEL_RADIUS, VOLUME_LENGTH + 2, 72, 12, true)
  geometry.rotateZ(Math.PI / 2)
  tunnelMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color: '#315363', transparent: true, opacity: 0.028, side: THREE.DoubleSide,
      roughness: 0.9, metalness: 0, depthWrite: false
    })
  )
  rootGroup.add(tunnelMesh)
  tunnelWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({ color: '#7895a0', transparent: true, opacity: 0.012, depthWrite: false })
  )
  rootGroup.add(tunnelWire)
}

function createTemporalCage() {
  temporalCage = new THREE.Group()
  const guideMaterial = new THREE.LineBasicMaterial({ color: '#7895a0', transparent: true, opacity: 0.075, depthWrite: false })
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2
    const geometry = new THREE.BufferGeometry().setFromPoints([
      pointOnRing(CLOUD_RADIUS, angle, -VOLUME_LENGTH / 2),
      pointOnRing(CLOUD_RADIUS, angle, VOLUME_LENGTH / 2)
    ])
    temporalCage.add(new THREE.Line(geometry, guideMaterial.clone()))
  }
  const axis = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-VOLUME_LENGTH / 2 - 0.7, -CLOUD_RADIUS - 0.38, 0),
    VOLUME_LENGTH + 1.4,
    '#92a8b1',
    0.25,
    0.12
  )
  temporalCage.add(axis)
  const label = makeLabel('time-axis-label')
  label.element.innerHTML = '<span>X<sub>t</sub></span><strong>TIME-ORDERED SECTIONS</strong><small>仅为时序展开，不代表巷道纵向采样</small>'
  label.position.set(VOLUME_LENGTH / 2 + 0.8, -CLOUD_RADIUS - 0.38, 0)
  temporalCage.add(label)
  rootGroup.add(temporalCage)
}

function createTemporalEnvelope() {
  const positions = []
  const colors = []
  const indices = []
  for (let sliceIndex = 0; sliceIndex < ENVELOPE_STEPS; sliceIndex += 1) {
    const ratio = sliceIndex / (ENVELOPE_STEPS - 1)
    const x = (ratio - 0.5) * VOLUME_LENGTH
    const radius = TUNNEL_RADIUS + (CLOUD_RADIUS - TUNNEL_RADIUS) * ratio
    for (let angular = 0; angular <= ANGULAR_STEPS; angular += 1) {
      const angle = angular / ANGULAR_STEPS * Math.PI * 2
      const point = pointOnRing(radius, angle, x)
      positions.push(point.x, point.y, point.z)
      colors.push(0.04, 0.08, 0.11)
    }
  }
  for (let sliceIndex = 0; sliceIndex < ENVELOPE_STEPS - 1; sliceIndex += 1) {
    for (let angular = 0; angular < ANGULAR_STEPS; angular += 1) {
      const current = sliceIndex * (ANGULAR_STEPS + 1) + angular
      const next = current + ANGULAR_STEPS + 1
      indices.push(current, next, current + 1, current + 1, next, next + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  temporalEnvelope = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.68,
      toneMapped: false,
      depthWrite: false
    })
  )
  temporalEnvelope.name = '连续时序插值包络体'
  temporalEnvelope.renderOrder = 2
  rootGroup.add(temporalEnvelope)
  recolorTemporalEnvelope()
}

function recolorTemporalEnvelope() {
  if (!temporalEnvelope) return
  const colors = temporalEnvelope.geometry.attributes.color
  for (let sliceIndex = 0; sliceIndex < ENVELOPE_STEPS; sliceIndex += 1) {
    const ratio = sliceIndex / (ENVELOPE_STEPS - 1)
    for (let angular = 0; angular <= ANGULAR_STEPS; angular += 1) {
      const angle = angular / ANGULAR_STEPS * Math.PI * 2
      const color = colorAt(fieldAt(angle, ratio)).lerp(new THREE.Color('#07121d'), 0.06)
      const vertex = sliceIndex * (ANGULAR_STEPS + 1) + angular
      colors.setXYZ(vertex, color.r, color.g, color.b)
    }
  }
  colors.needsUpdate = true
}

function rebuildTemporalTrajectories() {
  if (!rootGroup) return
  if (temporalTrajectoryGroup) {
    rootGroup.remove(temporalTrajectoryGroup)
    disposeObject(temporalTrajectoryGroup)
  }
  temporalTrajectories.length = 0
  temporalTrajectoryGroup = new THREE.Group()
  temporalTrajectoryGroup.name = '钻孔时序轨迹'
  rootGroup.add(temporalTrajectoryGroup)

  props.boreholes.forEach((borehole) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.18, depthWrite: false })
    )
    line.renderOrder = 22
    temporalTrajectoryGroup.add(line)
    temporalTrajectories.push({ borehole, line })
  })
  updateTemporalTrajectories()
}

function updateTemporalTrajectories() {
  if (!temporalTrajectoryGroup) return
  const currentIndex = currentSliceIndex.value
  temporalTrajectoryGroup.visible = props.viewMode !== 'section' && currentIndex > 0
  temporalTrajectories.forEach((item) => {
    const angle = THREE.MathUtils.degToRad(Number(item.borehole.angleDeg || 0))
    const points = []
    for (let sliceIndex = 0; sliceIndex <= currentIndex; sliceIndex += 1) {
      const ratio = sliceIndex / (SLICE_COUNT - 1)
      const x = (ratio - 0.5) * VOLUME_LENGTH
      const radius = TUNNEL_RADIUS + (CLOUD_RADIUS - TUNNEL_RADIUS) * ratio
      points.push(pointOnRing(radius, angle, x))
    }
    item.line.geometry.dispose()
    item.line.geometry = new THREE.BufferGeometry().setFromPoints(points)
    const selected = item.borehole.id === props.selectedBoreholeId
    const special = item.borehole.role === 'special-variable-stress'
    item.line.material.color.set(selected ? '#75d7e8' : special ? '#d0a956' : '#8aa0a8')
    item.line.material.opacity = selected ? 0.72 : special ? 0.36 : 0.17
  })
}

function createTemporalVolume() {
  temporalSlices.length = 0
  sliceHitTargets.length = 0
  for (let index = 0; index < SLICE_COUNT; index += 1) {
    const ratio = index / (SLICE_COUNT - 1)
    const x = (ratio - 0.5) * VOLUME_LENGTH
    const geometry = createAnnularGeometry()
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2,
      toneMapped: false,
      depthWrite: false,
      alphaTest: 0.002
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.x = x
    mesh.userData = { sliceIndex: index, ratio }
    mesh.renderOrder = 4 + index
    rootGroup.add(mesh)
    sliceHitTargets.push(mesh)

    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        vertexColors: true, size: 0.062, transparent: true, opacity: 0.6,
        toneMapped: false,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    )
    points.position.x = x + 0.018
    points.visible = false
    points.renderOrder = 30 + index
    rootGroup.add(points)

    const outlineMaterial = new THREE.MeshBasicMaterial({ color: '#718c98', transparent: true, opacity: 0.08, depthWrite: false })
    const outerRim = new THREE.Mesh(new THREE.TorusGeometry(CLOUD_RADIUS, 0.024, 8, 120), outlineMaterial)
    outerRim.rotation.y = Math.PI / 2
    outerRim.position.x = x
    outerRim.renderOrder = 40 + index
    rootGroup.add(outerRim)
    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(TUNNEL_RADIUS, 0.018, 8, 120), outlineMaterial.clone())
    innerRim.rotation.y = Math.PI / 2
    innerRim.position.x = x
    innerRim.renderOrder = 40 + index
    rootGroup.add(innerRim)

    const label = makeLabel('slice-label')
    label.element.innerHTML = `<span>T${String(index + 1).padStart(2, '0')}</span><strong>${sliceDepth(index).toFixed(1)} cm</strong>`
    label.position.set(x, CLOUD_RADIUS + 0.34, 0)
    label.visible = false
    rootGroup.add(label)

    temporalSlices.push({ index, ratio, x, mesh, points, outerRim, innerRim, label })
  }
  recolorVolume()
  updateVolumeState()
}

function recolorVolume() {
  temporalSlices.forEach((sliceItem) => {
    const position = sliceItem.mesh.geometry.attributes.position
    const colors = sliceItem.mesh.geometry.attributes.color
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const y = position.getY(vertex)
      const z = position.getZ(vertex)
      const radius = Math.sqrt(y * y + z * z)
      const radialRatio = THREE.MathUtils.clamp((radius - TUNNEL_RADIUS) / (CLOUD_RADIUS - TUNNEL_RADIUS), 0, 1)
      const angle = Math.atan2(y, z)
      const reveal = 1 - THREE.MathUtils.smoothstep(radialRatio, sliceItem.ratio - 0.028, sliceItem.ratio + 0.025)
      const activeColor = colorAt(fieldAt(angle, radialRatio))
      const dormantColor = new THREE.Color('#07131e')
      const color = dormantColor.lerp(activeColor, reveal)
      if (props.viewMode === 'iso' && normalizedFieldAtVertex(angle, radialRatio) < 0.52) color.multiplyScalar(0.12)
      colors.setXYZ(vertex, color.r, color.g, color.b)
    }
    colors.needsUpdate = true
  })
  recolorTemporalEnvelope()
}

function normalizedFieldAtVertex(angle, radialRatio) {
  return fieldAt(angle, radialRatio)
}

function updateVolumeState() {
  if (!temporalSlices.length) return
  const currentIndex = currentSliceIndex.value
  const selectedIndex = selectedSliceIndex.value
  temporalSlices.forEach((sliceItem) => {
    const passed = sliceItem.index <= currentIndex
    const selected = sliceItem.index === selectedIndex
    const current = sliceItem.index === currentIndex
    const sectionMode = props.viewMode === 'section'
    const isoMode = props.viewMode === 'iso'

    // In cloud mode the dense interpolated envelope carries the history.
    // Keeping only the current/analysis caps removes visible gaps in side view.
    sliceItem.mesh.visible = !isoMode && (sectionMode ? selected : current || selected)
    sliceItem.points.visible = isoMode && (passed || selected)
    sliceItem.mesh.material.opacity = sectionMode
      ? (selected ? 1 : 0)
      : selected
        ? 0.92
        : current
          ? 0.78
          : passed
            ? 0.28
            : 0.012
    sliceItem.points.material.opacity = selected ? 1 : current ? 0.86 : 0.4

    const outlineColor = selected ? '#5ed7f2' : current ? '#f2c14e' : '#718c98'
    const outlineOpacity = selected ? 0.64 : current ? 0.55 : passed ? 0.055 : 0.018
    sliceItem.outerRim.material.color.set(outlineColor)
    sliceItem.innerRim.material.color.set(outlineColor)
    sliceItem.outerRim.material.opacity = outlineOpacity
    sliceItem.innerRim.material.opacity = outlineOpacity
    sliceItem.outerRim.visible = sectionMode ? selected : current || selected
    sliceItem.innerRim.visible = sectionMode ? selected : current || selected
    sliceItem.label.visible = selected || current
    sliceItem.label.element.classList.toggle('selected', selected)
    sliceItem.label.element.classList.toggle('current', current)
  })
  if (temporalEnvelope) {
    const intervalIndexCount = ANGULAR_STEPS * 6
    const revealedIntervals = Math.ceil(currentRatio.value * (ENVELOPE_STEPS - 1))
    temporalEnvelope.geometry.setDrawRange(0, revealedIntervals * intervalIndexCount)
    temporalEnvelope.visible = props.viewMode === 'cloud' && revealedIntervals > 0
  }
  updateTemporalTrajectories()
  updateAnalysisBoreholes()
}

function disposeObject(object) {
  object.traverse?.((child) => {
    child.geometry?.dispose?.()
    if (Array.isArray(child.material)) child.material.forEach(material => material.dispose())
    else child.material?.dispose?.()
  })
}

function rebuildAnalysisBoreholes() {
  if (!rootGroup) return
  if (analysisBoreholeGroup) {
    rootGroup.remove(analysisBoreholeGroup)
    disposeObject(analysisBoreholeGroup)
  }
  boreholeObjects.length = 0
  boreholeTargets.length = 0
  analysisBoreholeGroup = new THREE.Group()
  analysisBoreholeGroup.name = '选中切面钻孔分析层'
  rootGroup.add(analysisBoreholeGroup)

  props.boreholes.forEach((borehole) => {
    const angle = THREE.MathUtils.degToRad(Number(borehole.angleDeg || 0))
    const path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([pointOnRing(TUNNEL_RADIUS, angle), pointOnRing(CLOUD_RADIUS, angle)]),
      new THREE.LineDashedMaterial({ color: '#7d929b', transparent: true, opacity: 0.42, dashSize: 0.09, gapSize: 0.06, depthWrite: false })
    )
    path.computeLineDistances()
    analysisBoreholeGroup.add(path)

    const activeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#5ed7f2', transparent: true, opacity: 0.9, depthWrite: false }))
    analysisBoreholeGroup.add(activeLine)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), new THREE.MeshBasicMaterial({ color: '#5ed7f2', depthWrite: false }))
    analysisBoreholeGroup.add(head)
    const target = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
    target.userData.boreholeId = borehole.id
    analysisBoreholeGroup.add(target)
    boreholeTargets.push(target)

    const label = makeLabel(borehole.role === 'special-variable-stress' ? 'borehole-label special' : 'borehole-label')
    label.position.copy(pointOnRing(CLOUD_RADIUS + 0.38, angle))
    analysisBoreholeGroup.add(label)
    boreholeObjects.push({ borehole, angle, path, activeLine, head, target, label })
  })
  updateAnalysisBoreholes()
}

function formatValue(value, digits = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : '--'
}

function updateAnalysisBoreholes() {
  if (!analysisBoreholeGroup) return
  const ratio = selectedRatio.value
  const selectedX = (selectedSliceIndex.value / (SLICE_COUNT - 1) - 0.5) * VOLUME_LENGTH
  analysisBoreholeGroup.position.x = selectedX + 0.035
  analysisBoreholeGroup.visible = props.viewMode !== 'iso'

  boreholeObjects.forEach((item) => {
    const sample = sampleAtRatio(item.borehole, ratio)
    const prediction = sample?.predictions?.[props.modelId] || {}
    const color = colorAt(normalizedField(sample))
    const start = pointOnRing(TUNNEL_RADIUS, item.angle)
    const end = pointOnRing(TUNNEL_RADIUS + (CLOUD_RADIUS - TUNNEL_RADIUS) * ratio, item.angle)
    item.activeLine.geometry.dispose()
    item.activeLine.geometry = new THREE.BufferGeometry().setFromPoints([start, end])
    item.activeLine.material.color.copy(color)
    item.head.position.copy(end)
    item.head.material.color.copy(color)
    item.target.position.copy(end)
    const selected = item.borehole.id === props.selectedBoreholeId
    item.path.material.opacity = selected ? 0.9 : 0.3
    item.path.material.color.set(selected ? '#f1f5f7' : item.borehole.role === 'special-variable-stress' ? '#c5a25b' : '#7d929b')
    item.head.scale.setScalar(selected ? 1.6 : 1)
    item.label.visible = selected
    item.label.element.classList.toggle('selected', selected)
    item.label.element.innerHTML = `
      <span>${item.borehole.id} · ${item.borehole.label}${item.borehole.role === 'special-variable-stress' ? ' · 变应力' : ''}</span>
      <strong>${props.metric === 'damage' ? `${formatValue(prediction.damage)}%` : props.metric === 'error' ? `E ${formatValue(normalizedField(sample), 2)}` : `${formatValue(prediction.stress, 1)} MPa`}</strong>`
  })

  const selectedHole = props.boreholes.find(item => item.id === props.selectedBoreholeId) || props.boreholes[0]
  if (selectedHole) emit('sample', { borehole: selectedHole, sample: sampleAtRatio(selectedHole, ratio), sliceProgress: props.slice })
}

function updateViewMode() {
  if (!temporalSlices.length) return
  tunnelMesh.material.opacity = props.viewMode === 'section' ? 0.012 : 0.028
  tunnelWire.material.opacity = props.viewMode === 'section' ? 0.008 : 0.012
  temporalCage.visible = props.viewMode !== 'section'
  if (temporalEnvelope) temporalEnvelope.visible = props.viewMode === 'cloud' && currentSliceIndex.value > 0
  recolorVolume()
  updateVolumeState()
}

function onPointerMove(event) {
  hovered.value = true
  if (!container.value || !raycaster || !camera) return
  const rect = container.value.getBoundingClientRect()
  pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height * 2 - 1)
  raycaster.setFromCamera(pointer, camera)
  const hitsBorehole = raycaster.intersectObjects(boreholeTargets, false).length > 0
  const hitsSlice = raycaster.intersectObjects(sliceHitTargets.filter(item => item.visible), false).length > 0
  container.value.style.cursor = hitsBorehole || hitsSlice ? 'pointer' : 'grab'
}

function onSceneClick(event) {
  if (event.target.closest?.('.slice-selector')) return
  raycaster.setFromCamera(pointer, camera)
  const boreholeHit = raycaster.intersectObjects(boreholeTargets, false)[0]
  if (boreholeHit?.object?.userData?.boreholeId) {
    emit('select', boreholeHit.object.userData.boreholeId)
    return
  }
  const sliceHit = raycaster.intersectObjects(sliceHitTargets.filter(item => item.visible), false)[0]
  if (sliceHit?.object?.userData?.sliceIndex !== undefined) selectSlice(sliceHit.object.userData.sliceIndex)
}

function init() {
  if (!container.value) return
  try {
    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2('#06111a', 0.018)
    camera = new THREE.PerspectiveCamera(34, container.value.clientWidth / container.value.clientHeight, 0.1, 100)
    camera.position.set(12.8, 6.8, 11.2)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
    renderer.setSize(container.value.clientWidth, container.value.clientHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    container.value.prepend(renderer.domElement)

    labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(container.value.clientWidth, container.value.clientHeight)
    labelRenderer.domElement.className = 'three-label-layer'
    Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '2' })
    container.value.append(labelRenderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.055
    controls.minDistance = 10
    controls.maxDistance = 30
    controls.autoRotate = props.autoRotate
    controls.autoRotateSpeed = 0.32
    controls.target.set(0, 0, 0)

    scene.add(new THREE.HemisphereLight('#d9edf2', '#071019', 1.2))
    const keyLight = new THREE.DirectionalLight('#d7eef2', 2.15)
    keyLight.position.set(7, 9, 11)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#5b85a0', 1.4)
    fillLight.position.set(-8, -2, -7)
    scene.add(fillLight)

    rootGroup = new THREE.Group()
    rootGroup.rotation.x = -0.03
    scene.add(rootGroup)
    createTunnelReference()
    createTemporalCage()
    createTemporalEnvelope()
    createTemporalVolume()
    rebuildTemporalTrajectories()
    rebuildAnalysisBoreholes()

    raycaster = new THREE.Raycaster()
    pointer = new THREE.Vector2()
    clock = new THREE.Clock()
    resizeObserver = new ResizeObserver(() => {
      if (!container.value || !renderer || !camera) return
      const width = container.value.clientWidth
      const height = container.value.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      labelRenderer.setSize(width, height)
    })
    resizeObserver.observe(container.value)
    animate()
  } catch (error) {
    webglReady.value = false
    webglError.value = error?.message || String(error)
    console.error(error)
  }
}

function animate() {
  animationFrame = requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()
  controls.autoRotate = props.autoRotate
  controls.update()
  const currentItem = temporalSlices[currentSliceIndex.value]
  if (currentItem) {
    const pulse = props.playing ? 0.72 + Math.sin(elapsed * 3.2) * 0.12 : 0.78
    if (currentItem.index !== selectedSliceIndex.value) {
      currentItem.outerRim.material.opacity = pulse
      currentItem.innerRim.material.opacity = pulse
    }
  }
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

watch(() => props.boreholes, () => {
  recolorVolume()
  rebuildTemporalTrajectories()
  rebuildAnalysisBoreholes()
})
watch(() => [props.metric, props.modelId], () => {
  recolorVolume()
  updateAnalysisBoreholes()
})
watch(() => props.progress, updateVolumeState)
watch(() => props.slice, updateVolumeState)
watch(() => props.selectedBoreholeId, () => {
  updateTemporalTrajectories()
  updateAnalysisBoreholes()
})
watch(() => props.viewMode, updateViewMode)

onMounted(init)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  controls?.dispose()
  if (scene) disposeObject(scene)
  renderer?.dispose()
  renderer?.domElement?.remove()
  labelRenderer?.domElement?.remove()
})
</script>

<style scoped>
.volume-cloud-canvas { position: absolute; inset: 0; overflow: hidden; }
.volume-cloud-canvas::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 52% 46%, transparent 35%, rgba(4, 13, 21, .18) 76%, rgba(3, 10, 17, .58) 100%); }
.volume-cloud-canvas :deep(canvas) { display: block; width: 100%; height: 100%; outline: none; }
.volume-cloud-canvas :deep(.three-label-layer) { overflow: hidden; }
.volume-cloud-canvas :deep(.spatial-label) { color: #8ea6af; font: 7px/1.2 Electronic, monospace; white-space: nowrap; pointer-events: none; }
.volume-cloud-canvas :deep(.borehole-label) { min-width: 68px; padding: 3px 5px; text-align: center; background: rgba(7, 18, 26, .82); border: 1px solid rgba(129, 160, 172, .2); transform: scale(.82); transition: .2s ease; }
.volume-cloud-canvas :deep(.borehole-label span) { display: block; color: #708c98; font-size: 6px; }
.volume-cloud-canvas :deep(.borehole-label strong) { display: block; margin-top: 2px; color: #d9e6e9; font-size: 8px; font-weight: 400; }
.volume-cloud-canvas :deep(.borehole-label.special) { border-color: rgba(194, 166, 96, .5); border-style: dashed; }
.volume-cloud-canvas :deep(.borehole-label.selected) { border-color: #5ed7f2; background: rgba(8, 31, 42, .94); box-shadow: 0 0 10px rgba(94, 215, 242, .18); transform: scale(.96); }
.volume-cloud-canvas :deep(.slice-label) { padding: 3px 6px; text-align: center; background: rgba(7, 17, 24, .76); border-bottom: 1px solid #718c98; }
.volume-cloud-canvas :deep(.slice-label span) { color: #718c98; font-size: 6px; }
.volume-cloud-canvas :deep(.slice-label strong) { display: block; color: #b6c6cc; font-size: 8px; font-weight: 400; }
.volume-cloud-canvas :deep(.slice-label.selected) { border-color: #5ed7f2; }
.volume-cloud-canvas :deep(.slice-label.selected strong) { color: #8ce7f7; }
.volume-cloud-canvas :deep(.slice-label.current:not(.selected)) { border-color: #f2c14e; }
.volume-cloud-canvas :deep(.slice-label.current:not(.selected) strong) { color: #f2c14e; }
.volume-cloud-canvas :deep(.time-axis-label) { min-width: 160px; padding: 4px 7px; background: rgba(7, 17, 24, .78); border-left: 2px solid #8ea2aa; }
.volume-cloud-canvas :deep(.time-axis-label span) { color: #d5e0e3; font-size: 9px; }
.volume-cloud-canvas :deep(.time-axis-label strong), .volume-cloud-canvas :deep(.time-axis-label small) { display: block; color: #8ea2aa; font-size: 6px; font-weight: 400; }
.volume-cloud-canvas.compact .coordinate-note,
.volume-cloud-canvas.compact .slice-selector,
.volume-cloud-canvas.compact .view-hint,
.volume-cloud-canvas.compact .slice-status span:last-child { display: none; }
.volume-cloud-canvas.compact .field-header { top: 10px; left: 11px; }
.volume-cloud-canvas.compact .field-symbol { min-width: 58px; height: 28px; }
.volume-cloud-canvas.compact .slice-status { top: 11px; right: 10px; }
.volume-cloud-canvas.compact .mode-note { top: 44px; }
.field-header { position: absolute; z-index: 4; top: 14px; left: 14px; display: flex; align-items: center; gap: 9px; pointer-events: none; }
.field-symbol { display: grid; place-items: center; min-width: 66px; height: 32px; color: #dce8eb; font: 11px Georgia, serif; font-style: italic; background: rgba(7, 18, 26, .72); border: 1px solid rgba(132, 164, 175, .28); }
.field-header strong, .field-header small { display: block; }
.field-header strong { color: #d4e1e4; font-size: 10px; font-weight: 500; letter-spacing: 1px; }
.field-header small { margin-top: 2px; color: #607b87; font-size: 6px; letter-spacing: 1.2px; }
.coordinate-note { position: absolute; z-index: 4; top: 54px; left: 14px; display: flex; gap: 4px; pointer-events: none; }
.coordinate-note span { padding: 3px 6px; color: #6f8893; font-size: 7px; background: rgba(7, 18, 26, .64); border: 1px solid rgba(113, 145, 157, .16); }
.coordinate-note b { margin-right: 3px; color: #cbd9dc; font-family: Georgia, serif; font-style: italic; }
.slice-status { position: absolute; z-index: 4; top: 15px; right: 16px; display: flex; gap: 5px; pointer-events: none; }
.slice-status span { display: flex; align-items: center; gap: 5px; padding: 4px 7px; color: #708893; font-size: 7px; background: rgba(7, 18, 26, .7); border: 1px solid rgba(115, 146, 157, .17); }
.slice-status i { width: 10px; height: 2px; background: #718c98; }
.slice-status .status-current { color: #c6ad63; }.slice-status .status-current i { background: #f2c14e; }
.slice-status .status-selected { color: #75cadd; }.slice-status .status-selected i { background: #5ed7f2; }
.slice-selector { position: absolute; z-index: 6; left: 50%; bottom: 54px; width: min(410px, 54%); padding: 6px 9px; transform: translateX(-50%); background: rgba(6, 16, 24, .84); border: 1px solid rgba(123, 153, 164, .2); backdrop-filter: blur(7px); }
.selector-title, .selector-axis { display: flex; justify-content: space-between; color: #5f7883; font: 6px Electronic, monospace; }
.selector-title strong { color: #9fb2ba; font-weight: 400; }
.selector-track { display: grid; grid-template-columns: repeat(17, 1fr); gap: 3px; margin: 5px 0 4px; }
.selector-track button { appearance: none; height: 14px; padding: 0; background: transparent; border: 0; cursor: pointer; }
.selector-track button i { display: block; width: 100%; height: 3px; background: #29404b; transition: .18s ease; }
.selector-track button:hover i, .selector-track button.passed i { background: #607c87; }
.selector-track button.current i { height: 6px; background: #f2c14e; }
.selector-track button.selected i { height: 9px; background: #5ed7f2; box-shadow: 0 0 6px rgba(94, 215, 242, .32); }
.view-hint { position: absolute; z-index: 4; left: 17px; bottom: 15px; display: flex; align-items: center; gap: 7px; color: rgba(154, 180, 190, .42); font-size: 8px; opacity: .58; transition: opacity .2s; }
.view-hint.visible { opacity: 1; }.view-hint i { width: 1px; height: 9px; background: rgba(137, 165, 176, .25); }
.mode-note { position: absolute; z-index: 4; left: 50%; top: 51px; display: flex; align-items: center; gap: 7px; padding: 5px 10px; transform: translateX(-50%); color: #9eb2ba; font-size: 7px; letter-spacing: 1.3px; background: rgba(7, 18, 26, .78); border: 1px solid rgba(127, 159, 170, .18); pointer-events: none; }
.mode-note i { width: 16px; height: 1px; background: #5ed7f2; }
.webgl-fallback { position: absolute; inset: 0; z-index: 10; display: grid; place-content: center; gap: 8px; text-align: center; color: #8fa8b2; background: rgba(5, 13, 20, .95); }
.webgl-fallback strong { color: #8ce7f7; letter-spacing: 3px; }
@media (max-width: 1100px) { .coordinate-note { display: none; } .volume-cloud-canvas :deep(.borehole-label) { transform: scale(.7); } }
</style>
