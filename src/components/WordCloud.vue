
<template>
  <div>
    <div>【关键词条】</div>
    <div ref="target" class="w-full h-full"></div>
  </div>
</template>

<script setup>
import { ref, onMounted,watch } from 'vue';
import * as echarts from "echarts";
import 'echarts-wordcloud'
// 定义接收父组件传来的值
const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
});
// 1.初始化
let myChart = null;
const target = ref(null);
onMounted(() => {
  myChart = echarts.init(target.value);
  renderChart();
});

// console.log(props.data, "云图");

const randowRGB = () => {
  const r = Math.floor(Math.random() * 255)
  const g = Math.floor(Math.random() * 255)
  const b = Math.floor(Math.random() * 255)

  return `rgb(${r},${g},${b})`
}

// 2.构建 option 配置对象
const renderChart = () => {
  const options = {
    series: [
      {
        type: 'wordCloud',
        sizeRange: [8, 46],
        rotationRange: [0, 0],
        gridSize: 0,
        layoutAnimation: true,
        textStyle: {
          color:randowRGB
        },
        emphasis: {
          textStyle: {
            fontWeight: 'bold',
            color:'#ffffff'
          }
        },
        data:props.data.datas
      }
    ] 
  }
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);
};
watch(() => props.data,renderChart)
</script>

<style lang="scss" scoped>

</style>