<template>
  <div>
    <div class="right-bar">
      <p class="text-gradient btn-hover">煤岩损伤演化阶段</p>
    </div>
    <div class="damage-div flex items-center">

      <div :class="[color1]" class="px-3 py-5 m-3">
        <p class="text-gradient text-sm">演化阶段：</p>
        <h1 class="text-2xl">{{ dam1 }}</h1>
      </div>

      <div :class="[color2]" class="px-3 py-5 m-3">
        <p class="text-gradient text-sm">预测阶段：</p>
        <h1 class="text-2xl">{{ dam2 }}</h1>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useCsvStore } from "../stores/csv";
import { usePreStore } from "../stores/pre";

const color1 = ref('blue');
const color2 = ref('blue');

const csvStore = useCsvStore();
const preStore = usePreStore();

const dam1 = ref("请选择数据");
const dam2 = ref("预测中...");

const dam1Index = ref(0);
const dam2Index = ref(0);

const damageStage = ref(["弹性加载", "裂隙演化", "急剧破坏"]);
const damageStage2 = ref(["弹性加载", "裂隙演化", "急剧破坏"]);

function setDamage(input) {
  if (input == 0) {
    return 0
  } else if (input == 1) {
    return 1
  }
  else if (input == 2) {
    return 2
  }
  else {
    return 3
  }
}

function setColor() {
  if (dam1Index.value == 0) {
    color1.value = 'green'
  }
  if (dam1Index.value == 1) {
    color1.value = 'yellow'
  }
  if (dam1Index.value == 2) {
    color1.value = 'red'
  }
  if (dam2Index.value == 0) {
    color2.value = 'green'
  }
  if (dam2Index.value == 1) {
    color2.value = 'yellow'
  }
  if (dam2Index.value == 2) {
    color2.value = 'red'
  }

}

watch(
  () => preStore.data,
  () => {
    dam1Index.value = setDamage(csvStore.data.map(item => item.damage_stage)[0])
    dam2Index.value = setDamage(preStore.data.map(item => item.damage_stage)[0])

    setColor();

    dam1.value = damageStage.value[dam1Index.value];
    dam2.value = damageStage2.value[dam2Index.value];
  })




</script>

<style lang="scss">
.damage-div {
  height: 80%;
  display: flex;

  div {
    width: 50%;
    border: rgb(57, 107, 184) solid 1px;
    border-radius: 20px;
  }
}

.red {
  background-color: rgba(255, 0, 0, 0.4);
}

.green {
  background-color: rgba(0, 128, 0, 0.4);
}

.yellow {
  background-color: rgba(255, 255, 0, 0.4);
}

.blue {
  background-color: rgba(0, 0, 255, 0.4);
}
</style>
