<template>
  <div class="w-full h-full">
    <!--加载页面-->
    <div v-if="loading"
      class="loading-container bg-[url('assets/images/bg7.jpeg')] bg-cover bg-center  h-screen w-full flex justify-center items-center">

      <p class="text-blue-200 text-[6rem] font-[Myfont] pl-3">
        <i class="fa-solid fa-rotate fa-spin fa-md "></i> 加载中...
      </p>
    </div>
    <!--主页面-->
    <div class="bg-[url('assets/images/bg5.jpeg')] bg-cover bg-center h-screen
     text-white p-10 pt-20 flex overflow-hidden" v-else>

      <div class="header header-gradient"> “深岩智测”——基于多维信息感知与智能分析的深部开采煤岩损伤演化预警平台</div>
      <div class="routerlink ">
        <button @click="toDetail" class="text-gradient header ">多样本切换</button>
      </div>
      <!-- left -->
      <div class="flex-1 rounded-xl p-3 mr-3 border border-dark-100 shadow-md
       bg-dark-200/20   shadow-blue-800/40">
        <!-- ae -->
        <HorizontalBar class="h-[30%] box-border pb-2" />
        <!-- b值 -->
        <RadarBar class="h-[20%] box-border pb-2" />
        <!-- 应力 -->
        <HorizontalBarCopy class="h-[25%]" />
        <!--应变-->
        <HorizontalBarCopy2 class="h-[25%]" />
      </div>
      <!-- center -->
      <div class="w-1/2 mr-3 flex flex-col rounded-xl">
        <!-- 控制台 -->
        <TotalData class=" border border-dark-100 shadow-md 
       bg-dark-200/20  shadow-blue-800/40 p-3 rounded-xl" />
        <!-- 预测部分 -->
        <MapChart class=" border border-dark-100 shadow-md
       bg-dark-200/20   shadow-blue-800/40  p-3 mt-3 flex-1 rounded-xl" />
      </div>
      <!-- right -->
      <div class="flex-1  border border-dark-100 shadow-md
       bg-dark-200/20   shadow-blue-800/40  p-3 rounded-xl flex flex-col">
        <!-- 风险 -->
        <VerticalBar class="h-1/3 box-border pb-2" />
        <!-- 解释 -->
        <RingBar class="h-1/3 box-border pb-2" />
        <!-- 分析 -->
        <WordCloud class="h-1/3" />
      </div>
    </div>
  </div>
</template>

<script setup>
import HorizontalBar from "@/components/HorizontalBar.vue";
import RadarBar from "@/components/RadarBar.vue";
import TotalData from "@/components/TotalData.vue";
import MapChart from "@/components/MapChart.vue";
import VerticalBar from "@/components/VerticalBar.vue";
import RingBar from "@/components/RingBar.vue";
import WordCloud from "@/components/WordCloud.vue";
import HorizontalBarCopy from "../../components/HorizontalBar copy.vue";
import HorizontalBarCopy2 from "../../components/HorizontalBar copy 2.vue";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { throttleTimeAndTimer } from "../../utils/utils";

// 加载状态
const loading = ref(true);
const $router = useRouter();
// 获取宽度
const windowSize = () => {
  let width = document.documentElement.clientWidth;
  width <= 768 ? $router.push({ path: "/m" }) : "";
  
  loading.value = true;

  setTimeout(() => {
    loading.value = false;
  }, 500);
};
const toDetail = () => {
  $router.push({ path: "/detail" })
}
// window.addEventListener("resize", windowSize);
window.onresize = () => {
  // 页面大小变化时，刷新页面
  windowSize();
  throttleTimeAndTimer(window.history.go(0), 500);
};
windowSize();
</script>

<style scoped lang="scss">
.loading-container {
  transform: all 0.5s ease;
}

@import '@/assets/style/loading.scss';
</style>
