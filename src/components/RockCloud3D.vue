<template>
  <div ref="container" class="rock-cloud-canvas" @pointermove="onPointerMove">
    <div class="view-hint" :class="{ visible: hovered }">
      <span>拖拽旋转</span><i></i><span>滚轮缩放</span>
    </div>
    <div v-if="!webglReady" class="webgl-fallback">
      <strong>3D ENGINE OFFLINE</strong>
      <span>当前浏览器未启用 WebGL</span>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const props = defineProps({
  progress: { type: Number, default: 42 },
  metric: { type: String, default: 'stress' },
  slice: { type: Number, default: 0 },
  autoRotate: { type: Boolean, default: true },
  viewMode: { type: String, default: 'cloud' }
})

const emit = defineEmits(['sample'])
const container = ref(null)
const hovered = ref(false)
const webglReady = ref(true)

let scene
let camera
let renderer
let controls
let animationFrame
let resizeObserver
let tunnelGroup
let shellMesh
let sectionMesh
let shellMaterial
let sectionMaterial
let slicePlaneMesh
let clock
let raycaster
let pointer
const sensorNodes = []
const loadArrows = []
const dynamicMaterials = []

const palette = [
  [0.00, new THREE.Color('#1037e6')],
  [0.18, new THREE.Color('#087ef5')],
  [0.36, new THREE.Color('#04cfd0')],
  [0.53, new THREE.Color('#29d16d')],
  [0.68, new THREE.Color('#d8e72a')],
  [0.82, new THREE.Color('#ff9d18')],
  [1.00, new THREE.Color('#f12622')]
]

function colorAt(value) {
  const v = THREE.MathUtils.clamp(value, 0, 1)
  for (let i = 0; i < palette.length - 1; i += 1) {
    const [a, ca] = palette[i]
    const [b, cb] = palette[i + 1]
    if (v <= b) return ca.clone().lerp(cb, (v - a) / (b - a))
  }
  return palette.at(-1)[1].clone()
}

function metricFactor() {
  if (props.metric === 'displacement') return 0.76
  if (props.metric === 'plastic') return 1.12
  return 1
}

function stressValue(longitudinal, angle, radial = 0) {
  const phase = props.progress / 100
  const faceHotspot = Math.exp(-Math.pow(longitudinal - 0.05, 2) / (0.045 + phase * 0.09))
  const crownPressure = 0.58 + 0.22 * Math.cos(angle * 2 - 0.45) + 0.12 * Math.sin(angle * 5 + phase * 4)
  const radialDecay = Math.exp(-radial * (1.75 - phase * 0.55))
  const wave = 0.05 * Math.sin(longitudinal * 28 - phase * 8 + angle * 3)
  return THREE.MathUtils.clamp((0.10 + faceHotspot * crownPressure * radialDecay * (0.63 + phase * 0.55) + wave) * metricFactor(), 0, 1)
}

function createRockShell() {
  const geometry = new THREE.CylinderGeometry(3.18, 3.18, 10.2, 72, 34, true)
  geometry.rotateZ(Math.PI / 2)
  const count = geometry.attributes.position.count
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  shellMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
    roughness: 0.48,
    metalness: 0.08,
    clippingPlanes: []
  })
  shellMesh = new THREE.Mesh(geometry, shellMaterial)
  shellMesh.name = '围岩等效应力云图'
  tunnelGroup.add(shellMesh)

  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({ color: '#58b7ff', transparent: true, opacity: 0.16, clippingPlanes: [] })
  )
  wire.name = 'finite-element-grid'
  tunnelGroup.add(wire)
  dynamicMaterials.push(wire.material)
}

function createSectionGeometry() {
  const radialSteps = 8
  const angularSteps = 72
  const inner = 1.08
  const outer = 3.2
  const positions = []
  const colors = []
  const indices = []
  for (let r = 0; r <= radialSteps; r += 1) {
    const radius = inner + (outer - inner) * (r / radialSteps)
    for (let a = 0; a <= angularSteps; a += 1) {
      const theta = (a / angularSteps) * Math.PI * 2
      positions.push(-5.13, Math.cos(theta) * radius, Math.sin(theta) * radius)
      colors.push(0, 0.5, 1)
    }
  }
  const row = angularSteps + 1
  for (let r = 0; r < radialSteps; r += 1) {
    for (let a = 0; a < angularSteps; a += 1) {
      const i = r * row + a
      indices.push(i, i + row, i + 1, i + 1, i + row, i + row + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createCrossSection() {
  const geometry = createSectionGeometry()
  sectionMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.6,
    metalness: 0.05
  })
  sectionMesh = new THREE.Mesh(geometry, sectionMaterial)
  sectionMesh.name = '掌子面应力分区'
  tunnelGroup.add(sectionMesh)

  const grid = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({ color: '#071d3c', transparent: true, opacity: 0.28 })
  )
  grid.position.x = -0.012
  tunnelGroup.add(grid)

  const portal = new THREE.Mesh(
    new THREE.CircleGeometry(1.075, 64),
    new THREE.MeshStandardMaterial({ color: '#071221', metalness: 0.72, roughness: 0.3, side: THREE.DoubleSide })
  )
  portal.rotation.y = Math.PI / 2
  portal.position.x = -5.16
  tunnelGroup.add(portal)

  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.08, 0.055, 12, 64),
    new THREE.MeshBasicMaterial({ color: '#ffb12a', transparent: true, opacity: 0.82 })
  )
  portalRing.rotation.y = Math.PI / 2
  portalRing.position.x = -5.19
  tunnelGroup.add(portalRing)
}

function createTunnelWall() {
  const wallGeometry = new THREE.CylinderGeometry(1.08, 1.08, 10.48, 64, 18, true)
  wallGeometry.rotateZ(Math.PI / 2)
  const wall = new THREE.Mesh(
    wallGeometry,
    new THREE.MeshStandardMaterial({
      color: '#10273a',
      metalness: 0.48,
      roughness: 0.32,
      side: THREE.BackSide,
      clippingPlanes: []
    })
  )
  wall.name = '巷道开挖面'
  tunnelGroup.add(wall)
  dynamicMaterials.push(wall.material)

  const guide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5.35, 0, 0), new THREE.Vector3(5.8, 0, 0)]),
    new THREE.LineDashedMaterial({ color: '#5fdcff', dashSize: 0.22, gapSize: 0.13, transparent: true, opacity: 0.7 })
  )
  guide.computeLineDistances()
  tunnelGroup.add(guide)
}

function createSensors() {
  const locations = [
    [-3.8, 2.55, 1.78], [-2.15, -2.78, 1.42], [-0.3, 2.82, -1.2],
    [1.25, -2.62, -1.63], [2.55, 1.4, 2.75], [4.1, -0.75, 3.05]
  ]
  locations.forEach((position, index) => {
    const group = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshBasicMaterial({ color: index < 2 ? '#ffb12a' : '#6cecff' })
    )
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 14),
      new THREE.MeshBasicMaterial({ color: index < 2 ? '#ff7a1a' : '#1fb6ff', transparent: true, opacity: 0.18 })
    )
    group.add(core, halo)
    group.position.set(...position)
    group.userData = { halo, index }
    sensorNodes.push(group)
    tunnelGroup.add(group)
  })
}

function createLoadArrows() {
  const positions = [-3.5, -1.7, 0.1, 1.9, 3.7]
  positions.forEach((x, index) => {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(x, 4.25, index % 2 ? 0.35 : -0.35),
      0.9,
      '#ffb12a',
      0.24,
      0.13
    )
    arrow.userData.index = index
    loadArrows.push(arrow)
    tunnelGroup.add(arrow)
  })
}

function createSceneDecor() {
  const floor = new THREE.GridHelper(24, 24, '#164f75', '#0b263e')
  floor.position.y = -3.65
  floor.material.transparent = true
  floor.material.opacity = 0.28
  scene.add(floor)

  const sliceMaterial = new THREE.MeshBasicMaterial({ color: '#59d9ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  slicePlaneMesh = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), sliceMaterial)
  slicePlaneMesh.rotation.y = Math.PI / 2
  slicePlaneMesh.visible = false
  scene.add(slicePlaneMesh)

  const starsGeometry = new THREE.BufferGeometry()
  const stars = []
  for (let i = 0; i < 220; i += 1) {
    stars.push((Math.random() - 0.5) * 26, (Math.random() - 0.3) * 15, (Math.random() - 0.5) * 20)
  }
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3))
  scene.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: '#4bbcff', size: 0.025, transparent: true, opacity: 0.45 })))
}

function updateCloud() {
  if (!shellMesh || !sectionMesh) return
  const position = shellMesh.geometry.attributes.position
  const colors = shellMesh.geometry.attributes.color
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const longitudinal = THREE.MathUtils.clamp((x + 5.1) / 10.2, 0, 1)
    const angle = Math.atan2(z, y)
    const color = colorAt(stressValue(longitudinal, angle, 0.5))
    colors.setXYZ(i, color.r, color.g, color.b)
  }
  colors.needsUpdate = true

  const sectionPosition = sectionMesh.geometry.attributes.position
  const sectionColors = sectionMesh.geometry.attributes.color
  for (let i = 0; i < sectionPosition.count; i += 1) {
    const y = sectionPosition.getY(i)
    const z = sectionPosition.getZ(i)
    const radius = Math.sqrt(y * y + z * z)
    const radial = (radius - 1.08) / (3.2 - 1.08)
    const angle = Math.atan2(z, y)
    const value = stressValue(0.025, angle, radial)
    const color = colorAt(value)
    sectionColors.setXYZ(i, color.r, color.g, color.b)
  }
  sectionColors.needsUpdate = true
  emit('sample', {
    peak: Math.round(48 + props.progress * 0.31 * metricFactor()),
    plasticRadius: (1.42 + props.progress * 0.014).toFixed(2)
  })
}

function updateSlice() {
  if (!renderer || !slicePlaneMesh) return
  const active = props.slice > 2
  const x = -5.2 + (props.slice / 100) * 9.2
  const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), x)
  renderer.localClippingEnabled = true
  ;[shellMaterial, ...dynamicMaterials].forEach((material) => {
    if (material) material.clippingPlanes = active ? [plane] : []
  })
  slicePlaneMesh.visible = active
  slicePlaneMesh.position.x = x
}

function updateViewMode() {
  if (!shellMesh || !sectionMesh) return
  shellMesh.material.opacity = props.viewMode === 'section' ? 0.18 : props.viewMode === 'iso' ? 0.46 : 0.76
  sectionMesh.visible = props.viewMode !== 'iso'
  sensorNodes.forEach((node) => { node.visible = props.viewMode !== 'section' })
}

function onPointerMove(event) {
  hovered.value = true
  if (!container.value || !raycaster || !camera || !shellMesh) return
  const rect = container.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  container.value.style.cursor = raycaster.intersectObjects([shellMesh, sectionMesh]).length ? 'grab' : 'default'
}

function init() {
  if (!container.value) return
  try {
    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2('#031020', 0.032)
    camera = new THREE.PerspectiveCamera(38, container.value.clientWidth / container.value.clientHeight, 0.1, 100)
    camera.position.set(-10.8, 6.7, 11.2)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
    renderer.setSize(container.value.clientWidth, container.value.clientHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.value.prepend(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.055
    controls.minDistance = 8
    controls.maxDistance = 26
    controls.autoRotate = props.autoRotate
    controls.autoRotateSpeed = 0.65
    controls.target.set(-0.5, 0, 0)

    scene.add(new THREE.HemisphereLight('#b9eaff', '#06101c', 1.45))
    const keyLight = new THREE.DirectionalLight('#72d7ff', 3.2)
    keyLight.position.set(-7, 10, 9)
    scene.add(keyLight)
    const warmLight = new THREE.PointLight('#ff7b24', 18, 15)
    warmLight.position.set(-6.5, 1, 3)
    scene.add(warmLight)

    tunnelGroup = new THREE.Group()
    tunnelGroup.rotation.z = -0.035
    scene.add(tunnelGroup)
    createRockShell()
    createCrossSection()
    createTunnelWall()
    createSensors()
    createLoadArrows()
    createSceneDecor()
    updateCloud()
    updateSlice()
    updateViewMode()

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
    })
    resizeObserver.observe(container.value)
    animate()
  } catch (error) {
    webglReady.value = false
    console.error(error)
  }
}

function animate() {
  animationFrame = requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()
  controls.autoRotate = props.autoRotate
  controls.update()
  sensorNodes.forEach((node, index) => {
    const pulse = 1 + Math.sin(elapsed * 2.7 + index) * 0.32
    node.userData.halo.scale.setScalar(pulse)
    node.userData.halo.material.opacity = 0.12 + (pulse - 0.68) * 0.12
  })
  loadArrows.forEach((arrow, index) => {
    arrow.position.y = Math.sin(elapsed * 2 + index * 0.65) * 0.12
  })
  renderer.render(scene, camera)
}

watch(() => [props.progress, props.metric], updateCloud)
watch(() => props.slice, updateSlice)
watch(() => props.viewMode, updateViewMode)

onMounted(init)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  controls?.dispose()
  if (scene) {
    scene.traverse((object) => {
      object.geometry?.dispose?.()
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
      else object.material?.dispose?.()
    })
  }
  renderer?.dispose()
  renderer?.domElement?.remove()
})
</script>

<style scoped>
.rock-cloud-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.rock-cloud-canvas::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 48% 48%, transparent 30%, rgba(2, 10, 22, .28) 78%, rgba(2, 8, 18, .74) 100%);
}

.rock-cloud-canvas :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}

.view-hint {
  position: absolute;
  z-index: 4;
  right: 18px;
  bottom: 15px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: rgba(167, 213, 240, .42);
  font-size: 10px;
  letter-spacing: 1px;
  opacity: .62;
  transition: opacity .2s ease;
}

.view-hint.visible { opacity: 1; }
.view-hint i { width: 1px; height: 10px; background: rgba(117, 198, 240, .25); }

.webgl-fallback {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-content: center;
  gap: 8px;
  text-align: center;
  color: #8fbad0;
  background: rgba(2, 10, 22, .92);
}

.webgl-fallback strong { color: #42d9ff; letter-spacing: 3px; }
</style>
