<template>
  <div class="my-page-wrapper">
    <section class="status-panel">
      <div class="status-header">
        <nut-avatar
          size="56"
          bg-color="var(--card-color)"
          :url="icon"
          class="auto-reverse"
        />
        <div class="status-title">
          <h1>{{ appName }}</h1>
          <p>{{ runtimeLabel }}</p>
        </div>
      </div>
      <div class="status-grid">
        <div class="status-item">
          <span>运行环境</span>
          <strong>{{ env.runtime || env.backend || "Cloudflare Workers" }}</strong>
        </div>
        <div class="status-item">
          <span>存储</span>
          <strong>{{ env.storage || "D1" }}</strong>
        </div>
        <div class="status-item">
          <span>版本</span>
          <strong>v{{ env.version || "-" }}</strong>
        </div>
      </div>
    </section>

    <section class="settings-panel">
      <div class="settings-row">
        <div>
          <h2>语言</h2>
          <p>切换管理界面的显示语言。</p>
        </div>
        <LanguageSwitcherButton />
      </div>
      <div class="settings-row">
        <div>
          <h2>简洁模式</h2>
          <p>控制订阅列表和编辑器的展示密度。</p>
        </div>
        <nut-switch v-model="simpleMode" @change="saveAppearance" />
      </div>
      <div class="settings-row">
        <div>
          <h2>宽屏窄栏</h2>
          <p>在桌面宽屏下使用移动端式导航。</p>
        </div>
        <nut-switch v-model="wideScreenNarrowMode" @change="saveAppearance" />
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from "pinia";
import { computed, ref, watch } from "vue";

import LanguageSwitcherButton from "@/components/LanguageSwitcherButton.vue";
import { useBackend } from "@/hooks/useBackend";
import { useSettingsStore } from "@/store/settings";

const settingsStore = useSettingsStore();
const { appearanceSetting } = storeToRefs(settingsStore);
const { icon, env } = useBackend();

const simpleMode = ref(Boolean(appearanceSetting.value.isSimpleMode));
const wideScreenNarrowMode = ref(Boolean(appearanceSetting.value.useNarrowModeOnWideScreen));

const appName = computed(() => {
  return env.value?.app
    || env.value?.meta?.cloudflare?.env?.SUB_STORE_BACKEND_CUSTOM_NAME
    || "Sub-Store Cloudflare";
});

const runtimeLabel = computed(() => {
  return "订阅聚合、节点过滤和云端规则模板";
});

watch(
  () => appearanceSetting.value,
  (next) => {
    simpleMode.value = Boolean(next.isSimpleMode);
    wideScreenNarrowMode.value = Boolean(next.useNarrowModeOnWideScreen);
  },
  { deep: true },
);

const saveAppearance = async () => {
  await settingsStore.changeAppearanceSetting({
    appearanceSetting: {
      ...appearanceSetting.value,
      isSimpleMode: simpleMode.value,
      useNarrowModeOnWideScreen: wideScreenNarrowMode.value,
    },
  });
};
</script>

<style lang="scss" scoped>
.my-page-wrapper {
  width: calc(100% - 1.5rem);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.status-panel,
.settings-panel {
  border-radius: var(--item-card-radios);
  background: var(--card-color);
  color: var(--second-text-color);
  overflow: hidden;
}

.status-panel {
  padding: 18px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-title {
  min-width: 0;

  h1 {
    margin: 0;
    font-size: 18px;
    line-height: 1.35;
    color: var(--primary-text-color);
  }

  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--comment-text-color);
  }
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.status-item {
  min-width: 0;
  padding: 10px;
  border-radius: var(--item-card-radios);
  background: var(--background-color);

  span,
  strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 12px;
    color: var(--comment-text-color);
  }

  strong {
    margin-top: 4px;
    font-size: 13px;
    color: var(--primary-text-color);
  }
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--divider-color);

  &:last-child {
    border-bottom: 0;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
    color: var(--primary-text-color);
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--comment-text-color);
  }
}

@media screen and (max-width: 430px) {
  .status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
