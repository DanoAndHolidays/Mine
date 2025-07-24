<script setup>
import { onMounted, ref } from 'vue';
import * as echarts from "echarts";

const props = defineProps({
    data: {
        type: Object,
        required: true,
    },
});

const target = ref(null);
const target2 = ref(null);
const target3 = ref(null);
let myChart = null;
let myChart2 = null;
let myChart3 = null;
const options = {
    xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    yAxis: {
        type: 'value'
    },
    series: [
        {
            data: [150, 230, 224, 218, 135, 147, 260],
            type: 'line'
        }
    ]
};
const options2 = {
    xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    yAxis: {
        type: 'value'
    },
    series: [
        {
            data: [150, 230, 224, 218, 135, 147, 260],
            type: 'line'
        }
    ]
};
const options3 = {
    xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    yAxis: {
        type: 'value'
    },
    series: [
        {
            data: [150, 230, 224, 218, 135, 147, 260],
            type: 'line'
        }
    ]
};
onMounted(() => {
    myChart = echarts.init(target.value);
    myChart.setOption(options);

    myChart2 = echarts.init(target2.value);
    myChart2.setOption(options2);

    myChart3 = echarts.init(target3.value);
    myChart3.setOption(options3);
})


</script>
<template>

    <div class="relative w-full h-full">
        <div class="right-bar w-[400px] absolute top-[-30px] left-[-10px]">
            <p class="text-gradient btn-hover ">{{ data.name + " " + data.age }}</p>
        </div>
        <div class="flex h-full w-full">
            <div ref="target" class="h-full flex-1"></div>
            <div ref="target2" class="h-full flex-1"></div>
            <div ref="target3" class="h-full flex-1"></div>
            <div ref="target4" class="h-full flex-1">test</div>
            <div ref="target4" class="h-full  flex-1">test</div>
        </div>
    </div>
</template>

<style scoped></style>