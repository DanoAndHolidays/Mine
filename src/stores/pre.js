import { defineStore } from "pinia";
import { ref } from "vue";

export const usePreStore = defineStore('pre', () => {
    const reset = ref(false);
    const reset2 = ref(false);

    const data = ref([]);

    

    return { data, reset, reset2 };
})