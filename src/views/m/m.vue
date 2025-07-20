<template>
  <div
    class="m-full flex flex-col bg-[url('assets/images/H5.jpg')] bg-repeat-y bg-cover overflow-auto text-white"
    v-if="data"
  >
    <div class="flex-1 flex flex-col w-full p-3">
      <!-- 数据总览图 -->
      <m-total class="bg-opacity-50 bg-slate-800 p-3 mb-3" :data="data.totalData" />
      <!-- 横向柱状图 -->
      <HorizontalBar class=" h-72 box-border mb-3" :data="data.regionData" />
      <!-- 雷达图 -->
      <RadarBar class="h-72 box-border pb-2 mb-3" :data="data.riskData" />
      <!-- 关系图 -->
      <Relation class="h-72 mb-3" :data="data.relationData" />

      <!-- 竖向柱状图 -->
      <VerticalBar class="h-72 box-border pb-2 mb-3" :data="data.serverData" />
      <!-- 环形图 -->
      <RingBar class="h-72 box-border pb-2 mb-3" :data="data.abnormalData" />
      <!-- 文档云图 -->
      <WordCloud class="h-72" :data="data.wordCloudData" />
    </div>
  </div>
</template>

<script setup>


import HorizontalBar from "@/components/HorizontalBar.vue";
import RadarBar from "@/components/RadarBar.vue";
import Relation from "@/components/Relation.vue";
import MTotal from "@/components/m/Mtotal.vue";
import VerticalBar from "@/components/VerticalBar.vue";
import RingBar from "@/components/RingBar.vue";
import WordCloud from "@/components/WordCloud.vue";

import { ref,reactive } from "vue";
import { getVisualization } from "../../api/visualization";
import { useRouter } from "vue-router";

const data = ref(null);
// 本地mock数据
import mockData from "../../utils/mockData";
let _mockData = reactive(mockData);
const loadData = async () => {
  try {
    data.value = await getVisualization();
  } catch (error) {
    data.value = _mockData;
  }
};
loadData();

const $router = useRouter()
// 获取宽度
const windowSize = () => {
  let width = document.documentElement.clientWidth;
  width>=768?$router.push({ path: "/" }):""
}
window.addEventListener("resize", windowSize);
windowSize()

setInterval(() => {
  loadData();
}, 3000);
</script>

<style scoped>
.m-full{
  min-width:375px;
  height: 100vh;
}
</style>
