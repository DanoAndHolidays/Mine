<template>
  <div>
    <div ref="target" class="w-full h-full"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import * as echarts from "echarts";
import { useCsvStore } from "../stores/csv";
import { usePreStore } from "../stores/pre";
const csvStore = useCsvStore();
const preStore = usePreStore();

const target = ref(null);
let myChart = null;

onMounted(() => {
  myChart = echarts.init(target.value);
  renderChart();
});

const renderChart = () => {
  const options = {
    textStyle: {       // 文字大小
      fontFamily: 'Arial', // 字体
      color: '#ffffff',       // 文字颜色
      fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
      fontStyle: 'normals'  // 字体风格（normal/italic/oblique）
    },
    grid: {
      left: '0%',
      right: '0%',
      bottom: '0%',
      top: '20%',
      containLabel: true,
    },
    title: {
      text: 'ae',
      textStyle: {
        fontSize: 30,       // 文字大小
        fontFamily: 'Arial', // 字体
        color: '#ffffff',       // 文字颜色
        fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
        fontStyle: 'normals'  // 字体风格（normal/italic/oblique）
      },
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['原始数据', '预测数据'],
      textStyle: {
        fontSize: 14,       // 文字大小
        fontFamily: 'Arial', // 字体
        color: '#ffffff',       // 文字颜色
        fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
      },
    },
    xAxis: {
      type: 'category',
      data: csvStore.data.map(item => item.time_index),
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '原始数据',
        type: 'line', // 修改为 line 表示柱状图
        data: csvStore.data.map(item => item.ae_energy),
        // 柱子颜色
        itemStyle: {
          color: '#37A2DA'
        }
      },
      {
        name: '预测数据',
        type: 'line',
        data: preStore.data.map(item => item.pre_ae_energy),
        itemStyle: {
          color: '#FD666D'
        }
      }
    ]
  };
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);

};

watch(
  () => preStore.data,
  () => renderChart()
);
</script>

<style lang="scss" scoped></style>
