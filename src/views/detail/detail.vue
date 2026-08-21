<script setup>
import { computed, ref } from 'vue'
import SavModel3D from '../../components/SavModel3D.vue'

const afterManifestUrl = `${import.meta.env.BASE_URL}models/xieyahou/manifest.json`

const viewerStatuses = ref({
  before: { state: 'loading', message: '', manifest: null, metrics: null },
  after: { state: 'loading', message: '', manifest: null, metrics: null }
})

const modelSize = computed(() => {
  const bounds = viewerStatuses.value.before.manifest?.model?.bounds
  if (!Array.isArray(bounds) || bounds.length !== 2) return '--'
  return bounds[1]
    .map((value, axis) => Number(value) - Number(bounds[0][axis]))
    .map((value) => value.toFixed(1))
    .join(' × ')
})

const allReady = computed(() => (
  viewerStatuses.value.before.state === 'ready'
  && viewerStatuses.value.after.state === 'ready'
))

const peakChange = computed(() => {
  const beforePeak = Number(viewerStatuses.value.before.metrics?.peakStressMpa)
  const afterPeak = Number(viewerStatuses.value.after.metrics?.peakStressMpa)
  if (!Number.isFinite(beforePeak) || !Number.isFinite(afterPeak)) return null
  return (afterPeak - beforePeak) / beforePeak * 100
})

const peakChangeLabel = computed(() => {
  if (peakChange.value === null) return '--'
  const sign = peakChange.value > 0 ? '+' : ''
  return `${sign}${peakChange.value.toFixed(1)}%`
})

function updateStatus(status) {
  viewerStatuses.value = {
    ...viewerStatuses.value,
    [status.phase || 'before']: status
  }
}
</script>

<template>
  <main class="sav-viewer-page">
    <header class="sav-page-header">
      <router-link class="back-button" to="/" title="返回随钻智控主界面" aria-label="返回主页">
        <span aria-hidden="true">‹</span>
      </router-link>
      <div class="page-brand">
        <span>SZIC / RELIEF COMPARISON</span>
        <strong>巷道卸压前后数值演示对比</strong>
      </div>
      <div class="source-state">
        <i :class="{ ready: allReady }"></i>
        <span>
          <strong>{{ allReady ? '前后对比模型已载入' : '正在载入对比模型' }}</strong>
          <small>xieyaqian.f3sav → xieyahou.f3sav · {{ modelSize }} m</small>
        </span>
      </div>
    </header>

    <section class="model-workspace">
      <div class="workspace-label">
        <span>BEFORE / AFTER</span>
        <strong>800米埋深巷道卸压过程对比</strong>
        <small>左侧为 xieyaqian.f3sav 卸压前模型 · 右侧为 xieyahou.f3sav 卸压后模型</small>
      </div>
      <div class="comparison-grid">
        <article class="comparison-panel phase-before">
          <header class="phase-heading">
            <span>01 / 卸压前</span>
            <strong>高应力靶区识别</strong>
            <small>真实 SAV 体单元应力场</small>
          </header>
          <div class="model-viewport">
            <i class="corner top-left"></i>
            <i class="corner top-right"></i>
            <i class="corner bottom-left"></i>
            <i class="corner bottom-right"></i>
            <SavModel3D
              phase="before"
              default-target-active
              @status="updateStatus"
            />
          </div>
        </article>

        <article class="comparison-panel phase-after">
          <header class="phase-heading">
            <span>02 / 卸压后</span>
            <strong>残余高应力区评估</strong>
            <small>真实 SAV 卸压后体单元应力场</small>
          </header>
          <div class="model-viewport">
            <i class="corner top-left"></i>
            <i class="corner top-right"></i>
            <i class="corner bottom-left"></i>
            <i class="corner bottom-right"></i>
            <SavModel3D
              phase="after"
              :manifest-url="afterManifestUrl"
              default-target-active
              @status="updateStatus"
            />
          </div>
        </article>
      </div>
      <footer class="model-source">
        <span>来源</span>
        <strong>FLAC3D 6.0 SAVE</strong>
        <i></i>
        <span>卸压前高应力单元</span>
        <strong>{{ viewerStatuses.before.metrics?.highStressZoneCount?.toLocaleString('zh-CN') || '--' }}</strong>
        <i></i>
        <span>卸压后残余单元</span>
        <strong>{{ viewerStatuses.after.metrics?.highStressZoneCount?.toLocaleString('zh-CN') || '--' }}</strong>
        <i></i>
        <span>峰值变化率</span>
        <strong :class="{ reduction: peakChange !== null && peakChange <= 0, increase: peakChange > 0 }">
          {{ peakChangeLabel }}
        </strong>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.sav-viewer-page {
  --cyan: #69d2e3;
  --line: rgba(113, 174, 190, .22);
  position: relative;
  display: grid;
  grid-template-rows: 64px minmax(0, 1fr);
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
  color: #dce8ea;
  background:
    linear-gradient(rgba(81, 139, 157, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(81, 139, 157, .035) 1px, transparent 1px),
    #040d13;
  background-size: 38px 38px;
}

.sav-viewer-page::before {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
  background: linear-gradient(180deg, rgba(4, 13, 19, .08), rgba(2, 8, 12, .58));
}

.sav-page-header {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 42px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  background: rgba(4, 14, 21, .93);
  border-bottom: 1px solid var(--line);
}

.back-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: #84a9b4;
  text-decoration: none;
  background: rgba(95, 151, 165, .06);
  border: 1px solid rgba(112, 176, 191, .22);
  transition: color .2s ease, border-color .2s ease, background .2s ease;
}

.back-button:hover {
  color: #e2f1f3;
  background: rgba(91, 177, 195, .13);
  border-color: rgba(111, 211, 229, .52);
}

.back-button span {
  margin-top: -2px;
  font: 25px/1 Arial, sans-serif;
}

.page-brand span,
.page-brand strong,
.source-state strong,
.source-state small {
  display: block;
}

.page-brand span {
  color: #537680;
  font: 9px Electronic, monospace;
  letter-spacing: 1.6px;
}

.page-brand strong {
  margin-top: 3px;
  color: #dce9eb;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 1px;
}

.source-state {
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: right;
}

.source-state > i {
  width: 7px;
  height: 7px;
  background: #c59d58;
  border-radius: 50%;
  box-shadow: 0 0 9px rgba(197, 157, 88, .65);
}

.source-state > i.ready {
  background: #66c99e;
  box-shadow: 0 0 9px rgba(102, 201, 158, .72);
}

.source-state > i.error {
  background: #d65d4a;
  box-shadow: 0 0 9px rgba(214, 93, 74, .72);
}

.source-state strong {
  color: #cfdcdf;
  font-size: 11px;
  font-weight: 500;
}

.source-state small {
  margin-top: 2px;
  color: #59727c;
  font: 9px Electronic, monospace;
}

.model-workspace {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: 49px minmax(0, 1fr) 34px;
  min-height: 0;
  padding: 12px 16px 14px;
}

.workspace-label {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.workspace-label > span {
  color: #6dc7d7;
  font: 10px Electronic, monospace;
  letter-spacing: 1.8px;
}

.workspace-label > strong {
  color: #d7e5e7;
  font-size: 16px;
  font-weight: 500;
}

.workspace-label > small {
  color: #58737d;
  font-size: 10px;
}

.comparison-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-height: 0;
}

.comparison-grid::after {
  position: absolute;
  z-index: 12;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  color: #9ed5dc;
  font: 19px/28px Arial, sans-serif;
  text-align: center;
  background: #06141c;
  border: 1px solid rgba(105, 210, 227, .46);
  content: '→';
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.comparison-panel {
  display: grid;
  grid-template-rows: 35px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
}

.phase-heading {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 0 11px;
  background: rgba(4, 14, 21, .72);
  border: 1px solid rgba(111, 174, 189, .16);
  border-bottom: 0;
}

.phase-heading span {
  color: #70cbd9;
  font: 10px Electronic, monospace;
}

.phase-heading strong {
  color: #d8e7e9;
  font-size: 12px;
  font-weight: 500;
}

.phase-heading small {
  color: #5f7b84;
  font-size: 9px;
}

.phase-after .phase-heading span {
  color: #75d1a8;
}

.model-viewport {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: rgba(4, 14, 21, .58);
  border: 1px solid rgba(111, 174, 189, .2);
  box-shadow: inset 0 0 45px rgba(31, 104, 124, .06);
}

.corner {
  position: absolute;
  z-index: 8;
  width: 21px;
  height: 21px;
  pointer-events: none;
}

.top-left { top: -1px; left: -1px; border-top: 2px solid var(--cyan); border-left: 2px solid var(--cyan); }
.top-right { top: -1px; right: -1px; border-top: 2px solid var(--cyan); border-right: 2px solid var(--cyan); }
.bottom-left { bottom: -1px; left: -1px; border-bottom: 2px solid var(--cyan); border-left: 2px solid var(--cyan); }
.bottom-right { right: -1px; bottom: -1px; border-right: 2px solid var(--cyan); border-bottom: 2px solid var(--cyan); }

.model-source {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  color: #57717b;
  font-size: 9px;
}

.model-source strong {
  color: #9eb4ba;
  font: 10px Electronic, monospace;
  font-weight: 400;
}

.model-source .reduction {
  color: #74d4aa;
}

.model-source .increase {
  color: #ef9a73;
}

.model-source i {
  width: 1px;
  height: 9px;
  margin: 0 4px;
  background: rgba(111, 164, 177, .22);
}

@media (max-width: 720px) {
  .sav-page-header {
    grid-template-columns: 36px 1fr;
    padding: 0 12px;
  }
  .source-state { display: none; }
  .sav-viewer-page {
    height: auto;
    overflow: auto;
  }
  .model-workspace {
    grid-template-rows: 54px auto 38px;
    padding: 9px;
  }
  .workspace-label { display: block; }
  .workspace-label > span,
  .workspace-label > strong { display: block; }
  .workspace-label > strong { margin-top: 4px; font-size: 14px; }
  .workspace-label > small { display: none; }
  .comparison-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .comparison-grid::after { display: none; }
  .comparison-panel { grid-template-rows: 35px 560px; }
  .phase-heading small { display: none; }
  .model-source {
    flex-wrap: wrap;
    justify-content: center;
    padding-top: 7px;
  }
}
</style>
