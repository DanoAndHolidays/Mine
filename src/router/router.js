import { createRouter, createWebHistory,createWebHashHistory } from 'vue-router';
const routes = [
  {
    // PC
    path: '/',
    name: "index",
    component: ()=> import("../views/index/index.vue"),
  },
  {
    // 移动
    path: '/m',
    name: "m",
    component: ()=> import("../views/m/m.vue"),
  }
]
const router = createRouter({
  // history:createWebHistory(),
  history:createWebHashHistory(),
  routes,
  scrollBehavior(){
    return{
      el: '#app',
      top: 0,
      behavior: 'smooth',
    }
  }
})

export default router