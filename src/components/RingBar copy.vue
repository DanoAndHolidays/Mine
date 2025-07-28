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

// console.log(props.data);
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
    toolbox: {
      show: true,
      iconStyle: {
        borderColor: 'white',
      },
      feature: {
        saveAsImage: {
        },
      }
    },
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
      bottom: 0,
      textStyle: {
        fontSize: 14,       // 文字大小
        fontFamily: 'Arial', // 字体
        color: '#ffffff',       // 文字颜色
        fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
        fontStyle: 'normals'  // 字体风格（normal/italic/oblique）
      },
    },
    xAxis: {
      type: 'category',
      data: csvStore.data.map(item => item.time_index),
    },
    yAxis: {
      type: 'value',
      splitLine: {
        show: true,  // 显示网格线
        lineStyle: {
          color: '#a0a0a0',  // 浅灰色网格线
          width: 1,
          type: 'dashed'  // 虚线样式
        }
      },
    },
    grid: {
      top: '20%',
      left: '0%',
      right: '0%',
      bottom: '10%',
      containLabel: true,
    },
    series: [
      {
        lineStyle: {
          color: '#5F9064',

        },
        itemStyle: {
          color: '#5F9064',

        },
        name: '原始应力数据',
        type: 'line',
        data: csvStore.data.map(item => item.stress),
        markPoint: {
          data: [
            { type: 'max', name: 'Max' },
            { type: 'min', name: 'Min' }
          ]
        },
        markLine: {
          data: [{ type: 'average', name: 'Avg' }]
        }
      },

      {
        lineStyle: {
          color: '#EAB308',
          type: 'dashed',
        },
        itemStyle: {
          color: '#EAB308',

        },
        name: '预测应力数据',
        type: 'line',
        data: preStore.data.map(item => item.pre_stress),
        markPoint: {
          data: [{ name: '周最低', value: -2, xAxis: 1, yAxis: -1.5 }]
        },
        markLine: {
          data: [
            { type: 'average', name: 'Avg' },
            [
              {
                symbol: 'none',
                x: '90%',
                yAxis: 'max'
              },
              {
                symbol: 'circle',
                label: {
                  position: 'start',
                  formatter: 'Max'
                },
                type: 'max',
                name: '最高点'
              }
            ]
          ]
        }
      }
    ]
  };
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);
};
watch(() => csvStore.data, renderChart)
</script>

<style lang="scss" scoped></style>
