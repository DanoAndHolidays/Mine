<template>
  <div class="total-data">
    <div class="p-0">
      <!-- 总数据 -->

      <div class="total-text header-gradient">实验控制台</div>
      <div class="">

        <div class="w-full">
          <div class="max-w-5xl mx-auto overflow-hidden">
            <!-- 标题区域 <div class="bg-indigo-600 text-white p-6">
              <h1 class="text-2xl md:text-3xl font-bold flex items-center">
                <i class="fa fa-table mr-3"></i>CSV多行数据间隔展示工具
              </h1>
              <p class="mt-2 opacity-90">批量展示CSV数据，支持自定义行数和间隔时间</p>
            </div> -->


            <!-- 控制区域 -->
            <div>
              <div class="flex">
                <div class="mb-1 mr-2 w-2/5">
                  <label for="fileInput" class="block text-gradient text-sm font-medium mb-1 mt-1">选择CSV文件：</label>
                  <input type="file" id="fileInput" ref="fileInput" accept=".csv" style="color: white;"
                    class="w-full px-2 blue-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </div>
                <div class="w-3/5 mb-3">
                  <label class="block text-gradient text-sm font-medium my-1">进度信息：</label>
                  <div class="blue-border w-full px-1 flex gap-5">
                    <div>
                      <label for="" class="text-gradient text-sm">总体步长：</label>
                      <span class="header-gradient">{{ totalCsvRows }}步</span>
                    </div>
                    <div>
                      <label for="" class="text-gradient text-sm">展示范围：</label>
                      <span class="header-gradient">{{ csvStartIndex }}--{{ csvEndIndex }}步</span>
                    </div>
                    <div>
                      <label for="" class="text-gradient text-sm">剩余时间：</label>
                      <span class="header-gradient">{{ elapsedTime }}秒</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="blue-border  p-1">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                  <div>
                    <label for="interval" class="block text-gradient text-sm 700 font-medium mb-2">间隔(s)：</label>
                    <input type="number" id="interval" ref="intervalInput" value="1" min="0.5" max="10" step="0.5"
                      class="w-full px-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  </div>
                  <div>
                    <label for="rowCount" class="block text-gradient text-sm 700 font-medium mb-2">步长：</label>
                    <input type="number" id="rowCount" ref="rowCountInput" value="5" min="1" max="20" step="1"
                      class="w-full px-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  </div>
                  <div>
                    <label class="block text-gradient text-sm 700 font-medium mb-2">进度：</label>
                    <div class="flex items-center">
                      <span id="currentRange" ref="currentRange"
                        class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                        未加载数据
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button id="startBtn" ref="startBtn"
                    class="px-10 py-0 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
                    <i class="fa fa-play mr-2"></i>开始
                  </button>
                  <button id="pauseBtn" ref="pauseBtn"
                    class="px-10 py-0 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
                    <i class="fa fa-pause mr-2"></i>暂停
                  </button>
                  <button id="prevBtn" ref="prevBtn"
                    class="px-10 py-0 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
                    <i class="fa fa-step-backward mr-2"></i>后退
                  </button>
                  <button id="nextBtn" ref="nextBtn"
                    class="px-10 py-0 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
                    <i class="fa fa-step-forward mr-2"></i>前进
                  </button>
                  <button id="resetBtn" ref="resetBtn"
                    class="px-10 py-0 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled>
                    <i class="fa fa-refresh mr-2"></i>重置
                  </button>
                </div>
              </div>
            </div>


          </div>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCsvStore } from "../stores/csv";

const csvStore = useCsvStore();

const totalCsvRows = ref(0);
const csvStartIndex = ref(0);
const csvEndIndex = ref(0);

const elapsedTime = ref(0);

// 获取DOM元素
const fileInput = ref(null);
const intervalInput = ref(null);
const rowCountInput = ref(null);
const startBtn = ref(null);
const pauseBtn = ref(null);
const prevBtn = ref(null);
const nextBtn = ref(null);
const resetBtn = ref(null);
const currentRange = ref(null);

// 全局变量
let csvData = null; // 存储解析后的CSV数据 { headers: [], rows: [] }
let currentPage = 0; // 当前页码
let timer = null; // 定时器

onMounted(() => {
  // 事件监听
  fileInput.value.addEventListener('change', handleFileSelect);
  startBtn.value.addEventListener('click', startPresentation);
  pauseBtn.value.addEventListener('click', pausePresentation);
  prevBtn.value.addEventListener('click', showPreviousPage);
  nextBtn.value.addEventListener('click', showNextPage);
  resetBtn.value.addEventListener('click', resetPresentation);
})

// 处理文件选择
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 验证文件类型
  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    showError('请选择CSV格式的文件');
    return;
  }

  // 读取文件内容
  const reader = new FileReader();
  reader.onload = function (e) {

    const content = e.target.result;
    csvData = parseCSV(content);
    console.log(csvData);

    resetPresentation();
    enableControls();
    try {

    } catch (err) {
      showError('解析CSV文件失败: ' + err.message);
      csvData = null;
      disableControls();
    }
  };
  reader.readAsText(file);
}

// 解析CSV内容
function parseCSV(content) {
  const lines = content.split('\n')
    .map(line => line.trim())
    .filter(line => line);

  if (lines.length === 0) {
    throw new Error('CSV文件为空');
  }

  // 解析表头
  const headers = parseCSVLine(lines[0]);

  // 解析数据行
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length > 0) {
      // 创建键值对对象
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index] || '';
      });
      rows.push(rowData);
    }
  }

  if (rows.length === 0) {
    throw new Error('CSV文件没有数据行');
  }

  return { headers, rows };
}

// 解析CSV中的一行
function parseCSVLine(line) {
  const results = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      // 处理双引号转义
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // 处理分隔符
      results.push(current);
      current = '';
      i++;
    } else {
      // 普通字符
      current += char;
      i++;
    }
  }

  // 添加最后一个字段
  results.push(current);
  return results;
}

let timeInter = 0;

// 开始展示
function startPresentation() {

  if (!csvData || timer) return;

  const intervalMs = parseFloat(intervalInput.value.value) * 1000;

  timeInter = intervalMs;
  console.log('时间间隔:' + intervalMs);


  if (isNaN(intervalMs) || intervalMs <= 0) {
    showError('请输入有效的间隔时间');
    console.log(intervalMs);
    return;
  }

  // 禁用不必要的控件
  startBtn.value.disabled = true;
  pauseBtn.value.disabled = false;
  intervalInput.value.disabled = true;
  rowCountInput.value.disabled = true;
  console.log('禁用不必要的控件');


  // 设置定时器
  timer = setInterval(() => {
    const rowCount = parseInt(rowCountInput.value.value) || 5;
    console.log(rowCountInput.value.value);

    const totalPages = Math.ceil(csvData.rows.length / rowCount);

    if (currentPage < totalPages - 1) {
      currentPage++;
      displayCurrentPage();
    } else {
      // 到达最后一页时停止
      pausePresentation();
    }
  }, intervalMs);
}

// 暂停展示
function pausePresentation() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  startBtn.value.disabled = false;
  pauseBtn.value.disabled = true;
  intervalInput.value.disabled = false;
  rowCountInput.value.disabled = false;
}

// 显示上一页
function showPreviousPage() {
  if (!csvData || currentPage <= 0) return;
  currentPage--;
  displayCurrentPage();
}

// 显示下一页
function showNextPage() {
  if (!csvData) return;

  const rowCount = parseInt(rowCountInput.value.value) || 5;
  const totalPages = Math.ceil(csvData.rows.length / rowCount);

  if (currentPage < totalPages - 1) {
    currentPage++;
    displayCurrentPage();
  }
}

// 重置展示
function resetPresentation() {
  pausePresentation();
  currentPage = 0;
  if (csvData) {
    displayCurrentPage();
  }
  updatePageCounter();
}


// 显示当前页数据
function displayCurrentPage() {
  if (!csvData) return;

  const rowCount = parseInt(rowCountInput.value.value) || 5;
  const startIndex = currentPage * rowCount;
  const endIndex = Math.min(startIndex + rowCount, csvData.rows.length);
  let rows = [];
  // 显示当前页的所有行
  for (let i = startIndex; i < endIndex; i++) {
    console.log(i);

    const row = csvData.rows[i];
    rows.push(row);
  }
  csvStore.data = rows;
  updatePageCounter();
}

// 更新进度
function updatePageCounter() {
  if (!csvData) {
    currentRange.value.textContent = '未加载数据';
    return;
  }

  const rowCount = parseInt(rowCountInput.value.value) || 5;
  const startIndex = currentPage * rowCount + 1;
  const endIndex = Math.min((currentPage + 1) * rowCount, csvData.rows.length);
  const totalRows = csvData.rows.length;

  elapsedTime.value = ((totalRows - endIndex) / rowCount * timeInter / 1000).toFixed(0);

  totalCsvRows.value = totalRows;
  csvStartIndex.value = startIndex;
  csvEndIndex.value = endIndex;

  currentRange.value.textContent = `${(endIndex / totalRows * 100).toFixed(2)}%`;
}

// 启用控件
function enableControls() {
  startBtn.value.disabled = false;
  prevBtn.value.disabled = false;
  nextBtn.value.disabled = false;
  resetBtn.value.disabled = false;
}

// 禁用控件
function disableControls() {
  startBtn.value.disabled = true;
  pauseBtn.value.disabled = true;
  prevBtn.value.disabled = true;
  nextBtn.value.disabled = true;
  resetBtn.value.disabled = true;
}

</script>

<style lang="scss" scoped>
.total-data {
  background-image: url(/src/assets/images/bar1.png);
  background-position: 0px 0px;
  background-size: 100%;
  background-repeat: no-repeat;
  padding-top: 0;
}

.total-text {
  text-align: center;
  font-weight: bold;
  font-size: 30px;
  letter-spacing: 3px;
}

input {
  color: black;
}
</style>