<template>
  <div>
    <h1>由于数据展示所需空间较大,暂不支持移动端</h1>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";

const $router = useRouter()
// 获取宽度
const windowSize = () => {
  let width = document.documentElement.clientWidth;
  width >= 768 ? $router.push({ path: "/" }) : ""
}
window.addEventListener("resize", windowSize);
windowSize()
</script>

<style scoped>
* {
  box-sizing: border-box;

}

div {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  overflow: hidden;
  background-color: orange;
  color: white;
  font-weight: bolder;
  font-size: 1rem;
}
</style>
