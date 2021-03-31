<template>
  <div class="content">
    <div class="content__nav">
      <help-nav :helpNavSections="helpNavSections"></help-nav>
    </div>
    <div class="content__view">
      <router-view :key="fullPath"></router-view>
    </div>
  </div>
</template>

<script lang="ts">
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { defineComponent, ref, onUpdated } from "vue";
import HelpNav from "@/components/help/HelpNav.vue";
import { HelpNavSection, rootKey } from "@/store/types";

export default defineComponent({
  components: { HelpNav },
  props: {
    article: {
      type: String,
      required: false,
      default: null,
    },
  },
  setup() {
    const route = useRoute();
    const fullPath = ref(route.fullPath);

    onUpdated(() => {
      fullPath.value = route.fullPath;
    });

    const store = useStore(rootKey);
    const helpNavSections: HelpNavSection[] =
      store.getters["help/getHelpNavSections"];

    return {
      helpNavSections,
      fullPath,
    };
  },
});
</script>

<style lang="scss" scoped>
.content {
  display: flex;
  margin: 2rem;

  &__view {
    display: flex;
    flex-flow: column;
    align-items: center;
    width: 70%;
    margin: 0 auto;
  }
}
</style>