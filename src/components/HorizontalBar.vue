<template>
  <div>
    <div class="right-bar">
      <p class="text-gradient btn-hover">AE能量</p>
    </div>
    <div ref="target" class="w-full h-4/5"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useCsvStore } from "../stores/csv";

const csvStore = useCsvStore();



import * as echarts from "echarts";
import { data } from "autoprefixer";
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
          backgroundColor: '#343434'
        }
      }
    },
    legend: {
      top: 20,
      padding: 0,
      data: ['ae_energy', 'ae_cumsum'],
      textStyle: {
        fontSize: 14,       // 文字大小
        fontFamily: 'Arial', // 字体
        color: '#ffffff',       // 文字颜色
        fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
        fontStyle: 'italic'  // 字体风格（normal/italic/oblique）
      },
    },
    grid: {
      left: '0%',
      right: '5%',
      bottom: '0%',
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: csvStore.data.map(item => item.time),
      }
    ],
    yAxis: [
      {
        type: 'value',
        name: '累计',
        data: 'ae_cumsum',
      },
      {
        type: 'value',
        name: '单步',
        data: 'ae_energy',
      }
    ],
    //颜色 浅的#48D3FA 深的#1663B8
    series: [
      {
        lineStyle: {
          color: '#1663B8',
        },
        itemStyle: {
          color: '#1663B8',
        },
        name: 'ae_energy',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: csvStore.data.map(item => item.ae_energy),
      },
      {
        lineStyle: {
          color: '#48D3FA',
        },
        itemStyle: {
          color: '#48D3FA',
        },

        name: 'ae_cumsum',
        type: 'line',
        stack: 'Total',
        label: {
          show: true,
          position: 'top'
        },
        areaStyle: {},
        emphasis: {
          focus: 'series'
        },
        data: csvStore.data.map(item => item.ae_cumsum),
      }
    ]
  };
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);
};
watch(
  () => csvStore.data,
  (newVal) => {
    renderChart();
    console.log(newVal);
  },
  { deep: true }
);
</script>

<style scoped></style>
