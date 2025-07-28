<template>
  <div>
    <div class="right-bar">
      <p class="text-gradient btn-hover">应力</p>
    </div>
    <div ref="target" class="w-full h-4/5"></div>
  </div>

</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useCsvStore } from "../stores/csv";

const csvStore = useCsvStore();

import * as echarts from "echarts";
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

// 2.构建 option 配置对象
const renderChart = () => {
  const options = {
    textStyle: {
      fontSize: 14,       // 文字大小
      fontFamily: 'Arial', // 字体
      color: '#ffffff',       // 文字颜色
      fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
      fontStyle: 'normals'  // 字体风格（normal/italic/oblique）
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: 'white',
          color: '#505050',
        },
      }
    },
    legend: {
      top: 5,
      padding: 0,
      data: ['应力',],
      textStyle: {
        fontSize: 14,       // 文字大小
        fontFamily: 'Arial', // 字体
        color: '#ffffff',       // 文字颜色
        fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
        fontStyle: 'italic'  // 字体风格（normal/italic/oblique）
      },
    },
    grid: {
      top: '20%',
      left:'2%',
      right: '10%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        data: csvStore.data.map(item => item.time_index),
      }

    ],
    yAxis: [
      {
        splitLine: {
          show: true,  // 显示网格线
          lineStyle: {
            color: '#a0a0a0',  // 浅灰色网格线
            width: 1,
            type: 'dashed'  // 虚线样式
          }
        },
        type: 'value',
        name: 'stress',
        data: '应力',
      }
    ],
    //颜色 浅的#48D3FA 深的#1663B8
    series: [
      {
        lineStyle: {
          color: '#79AE70',
        },
        itemStyle: {
          color: '#79AE70',
        },
        name: '应力',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        label: {
          show: true,
          color: 'white',
          position: 'top'
        },
        emphasis: {
          focus: 'series'
        },
        data: csvStore.data.map(item => item.stress),
      },
    ]
  };
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);
};
watch(
  () => csvStore.data,
  (newVal) => {
    renderChart();
   
  },
  { deep: true }
);
</script>

<style scoped></style>
