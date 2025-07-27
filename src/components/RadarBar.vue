<template>
  <div>
    <div class="right-bar">
      <p class="text-gradient btn-hover">AE统计特征参数</p>
    </div>
    <div ref="target" class="w-full h-4/5"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useCsvStore } from "../stores/csv";
import * as echarts from "echarts";
import { data } from 'autoprefixer';

const csvStore = useCsvStore();

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
    xAxis: {
      type: 'category',
      position: 'top',
      data: csvStore.data.map(item => item.time),

    },
    yAxis: {
      type: 'value',
      name: 'b_val',
      data: '损伤变量d',
      min: 1,
      splitLine: {
        show: true,  // 显示网格线
        lineStyle: {
          color: '#a0a0a0',  // 浅灰色网格线
          width: 1,
          type: 'dashed'  // 虚线样式
        }
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: 'white',
          color: '#505050',
        }
      }
    },
    grid: {
      left: '2%',
      right: '5%',
      bottom: '10%',
      top: '5%',
      containLabel: true,
    },
    series: [
      {
        label: {
          show: true,
          color: 'white',
          position: 'bottom'
        },
        data: csvStore.data.map(item => (item.b_val)),
        name: '损伤变量d',
        type: 'line',
        symbol: 'triangle',
        symbolSize: 10,
        lineStyle: {
          color: 'orange',
          width: 3,
        },
        itemStyle: {
          borderWidth: 1,
          color: 'orangered'
        }
      },
    ]
  };
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);
};
watch(() => csvStore.data, () => { renderChart(); })

</script>

<style lang="scss" scoped></style>