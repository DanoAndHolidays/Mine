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
  addArray();
  renderChart();
});

// 用于存储累积结果的全局数组
let simCsv = [];
let preCsv = [];
let timCsv = [];
let damCsv = [];

function reSetArray() {
  simCsv = [];
  preCsv = [];
  timCsv = [];
  damCsv = [];
}

function getValueRanges(arr) {
  const result = [];
  let currentValue = null;
  let startIndex = null;

  for (let index = 0; index < arr.length; index++) {
    const value = arr[index];
    if (currentValue === null) {
      currentValue = value;
      startIndex = index;
    } else if (value !== currentValue) {
      result.push([currentValue + 1, startIndex, index - 1]);
      currentValue = value;
      startIndex = index;
    }
  }

  if (currentValue !== null) {
    result.push([currentValue, startIndex, arr.length - 1]);
  }

  return result;
}

function accumulateTimArray(newArray) {
  // 验证输入是否为数组
  if (!Array.isArray(newArray)) {
    console.error('传入的不是数组，无法累积');
    return timCsv;
  }
  // 将新数组元素添加到累积数组中
  timCsv = [...timCsv, ...newArray];
  // 返回更新后的累积数组
  return timCsv;
}

function accumulateSimArray(newArray) {
  // 验证输入是否为数组
  if (!Array.isArray(newArray)) {
    console.error('传入的不是数组，无法累积');
    return simCsv;
  }
  // 将新数组元素添加到累积数组中
  simCsv = [...simCsv, ...newArray];
  // 返回更新后的累积数组
  return simCsv;
}

function accumulatePreArray(newArray) {
  // 验证输入是否为数组
  if (!Array.isArray(newArray)) {
    console.error('传入的不是数组，无法累积');
    return preCsv;
  }
  // 将新数组元素添加到累积数组中
  preCsv = [...preCsv, ...newArray];
  // 返回更新后的累积数组
  return preCsv;
}

function accumulateDamArray(newArray) {
  // 验证输入是否为数组
  if (!Array.isArray(newArray)) {
    console.error('传入的不是数组，无法累积');
    return damCsv;
  }
  // 将新数组元素添加到累积数组中
  damCsv = [...damCsv, ...newArray];
  // 返回更新后的累积数组
  return damCsv;
}

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
      data: timCsv,
    },
    yAxis: {
      splitLine: {
        show: true,  // 显示网格线
        lineStyle: {
          color: '#a0a0a0',  // 浅灰色网格线
          width: 1,
          type: 'dashed'  // 虚线样式
        }
      },
      type: 'value'
    },
    series: [
      {
        showSymbol: false,
        name: '原始数据',
        type: 'line', // 修改为 line 表示柱状图
        data: simCsv,
        // 柱子颜色
        itemStyle: {
          color: '#37A2DA'
        }
      },
      {
        showSymbol: false,
        name: '预测数据',
        type: 'line',
        data: preCsv,
        lineStyle: {
          // 设置为虚线
          type: 'dashed',  // 'dashed' 虚线, 'dotted' 点线
          width: 2,        // 线宽
          color: '#FD666D', // 线颜色
        },
        itemStyle: {
          color: '#FD666D',
        },
        markArea: {
          itemStyle: {
            color: 'rgba(181, 234, 140, 0.4)'
          },
          data: [
            [
              {
                name: 'Evening Peak',
                xAxis: '2'
              },
              {
                xAxis: '5'
              }
            ]
          ]
        },
      }
    ]
  };
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);

};

function addArray() {
  accumulateTimArray(csvStore.data.map(item => item.time_index));
  accumulateSimArray(csvStore.data.map(item => item.ae_energy));
  accumulatePreArray(preStore.data.map(item => item.pre_ae_energy));
  accumulateDamArray(preStore.data.map(item => item.damage_stage));
}

watch(
  () => [preStore.data, preStore.reset],
  () => {
    const ranges = getValueRanges(damCsv);
    console.log('每个数据的起始位置和结束位置：', ranges);
    renderChart();
    addArray();
    if (preStore.reset) {
      reSetArray();
      preStore.reset = false;
    }
  }
);
</script>

<style lang="scss" scoped></style>
