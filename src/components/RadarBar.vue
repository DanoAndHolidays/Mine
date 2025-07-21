<template>
  <div>
    <div class="right-bar">
      <p class="text-gradient btn-hover">雷达图</p>
    </div>
    <div ref="target" class="w-full h-4/5"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import * as echarts from "echarts";
// 定义接收父组件传来的值
const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
});
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
    radar: {
      indicator: [
        { name: 'Sales', max: 6500 },
        { name: 'Administration', max: 16000 },
        { name: 'Information Technology', max: 30000 },
        { name: 'Customer Support', max: 38000 },
        { name: 'Development', max: 52000 },
        { name: 'Marketing', max: 25000 }
      ]
    },
    series: [
      {
        name: 'Budget vs spending',
        type: 'radar',
        data: [
          {
            value: [4200, 3000, 20000, 35000, 50000, 18000],
            name: 'Allocated Budget'
          },
          {
            value: [5000, 14000, 28000, 26000, 42000, 21000],
            name: 'Actual Spending'
          },
          {
            value: [5455, 14545, 25483, 17743, 9935, 15454, 443],
            name: 'dano'
          }
        ]
      }
    ]
  };
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);
};
watch(() => props.data, renderChart)

</script>

<style lang="scss" scoped></style>