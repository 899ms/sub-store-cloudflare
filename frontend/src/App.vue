<template>
  <!-- <GlobalNotify /> -->
  <NavBar />
  <SideBar v-show="shouldShowSideBar" />
  <main class="page-body">
    <router-view />
  </main>
</template>

<script setup lang="ts">
// import GlobalNotify from '@/components/GlobalNotify.vue';
import SideBar from "@/components/SideBar.vue";
import NavBar from "@/components/NavBar.vue";
import { useWideScreenNarrowMode } from "@/hooks/useWideScreenNarrowMode";
import { useThemes } from "@/hooks/useThemes";
import { useGlobalStore } from "@/store/global";
import { useSubsStore } from "@/store/subs";
import { getFlowsUrlList } from "@/utils/getFlowsUrlList";
import { initStores } from "@/utils/initApp";
import { storeToRefs } from "pinia";
import { ref, watchEffect, onMounted } from "vue";

const subsStore = useSubsStore();
const globalStore = useGlobalStore();
const { shouldShowSideBar } = useWideScreenNarrowMode();

const { subs, flows } = storeToRefs(subsStore);

const allLength = ref(null);

// 处于 pwa 且屏幕底部有小白条时将底部安全距离写入 global store
type NavigatorExtend = Navigator & {
  standalone?: boolean;
};
const navigator: NavigatorExtend = window.navigator;

// 判断是否为非全面屏设备
function isLegacyDevices() {
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  if (
    (screenWidth === 375 && screenHeight === 667) ||
    (screenWidth === 414 && screenHeight === 736)
  ) {
    return true;
  }
  return false;
}

globalStore.setBottomSafeArea(
  navigator.standalone && !isLegacyDevices() ? 18 : 0
);

// 初始化颜色主题
useThemes();

onMounted(() => {
  initStores(true, true, false);
});

// 设置流量刷新状态
watchEffect(() => {
  const flowKeys = getFlowsUrlList(subs.value).map(([url]) => url);
  allLength.value = flowKeys.length;
  globalStore.setFlowFetching(
    flowKeys.some(url => !(url in flows.value)),
  );
});

</script>

<style lang="scss">
#app {
  font-family: "Roboto", "nutui-iconfont", "Noto Sans", Arial, "PingFang SC",
    "Source Han Sans SC", "Source Han Sans CN", "Microsoft YaHei", "ST Heiti",
    SimHei, sans-serif;
  display: flex;
  align-items: center;
  flex-direction: column;
  position: absolute;
  min-height: 100%;
  width: 100%;
  background: var(--background-color);
  overflow: hidden;

  .page-body {
    // overflow: hidden;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
    width: 100%;
    @include responsive-container-width;
  }

  overflow-y: auto;
}

</style>
