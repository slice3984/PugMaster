<template>
  <div class="content">
    <div class="content__nav">
      <command-nav-categories
        :categories="commandCategoryNames"
        :activeCategory="activeCategory"
        @category-update="switchCategory"
      ></command-nav-categories>
      <div class="content__main">
        <command-nav
          :categories="commandCategories"
          :activeCategory="activeCategory"
        ></command-nav>
        <div class="content__view">
          <router-view :key="fullPath"></router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { useStore } from "vuex";
import { defineComponent, ref, computed, ComputedRef, onUpdated } from "vue";
import { CommandCategory, rootKey } from "@/store/types";
import CommandNav from "./commands-nav/CommandNavCommands.vue";
import CommandNavCategories from "./commands-nav/CommandNavCategories.vue";
import { useRoute } from "vue-router";

export default defineComponent({
  components: { CommandNav, CommandNavCategories },
  setup() {
    const store = useStore(rootKey);
    const route = useRoute();
    const activeCategory = ref(null);
    const fullPath = ref(route.fullPath);

    const switchCategory = (category) => {
      activeCategory.value = category;
    };

    const commandCategories: ComputedRef<CommandCategory[]> = computed(
      () => store.getters["command/getCommandCategories"]
    );

    const commandCategoryNames: ComputedRef<string[]> = computed(() => {
      return commandCategories.value.map((c) => c.category);
    });

    if (!commandCategories.value.length) {
      (async () => {
        await store.dispatch("command/fetchCommandCategories");
        activeCategory.value = commandCategories.value.find((c) =>
          c.commands.includes(route.params.command as string)
        ).category;
      })();
    } else {
      activeCategory.value = "pickup";
    }

    onUpdated(() => {
      fullPath.value = route.fullPath;
    });

    return {
      commandCategories,
      commandCategoryNames,
      activeCategory,
      fullPath,
      switchCategory,
    };
  },
});
</script>

<style lang="scss" scoped>
.content {
  margin-top: 2rem;

  &__main {
    display: flex;
  }

  &__view {
    margin: 0 auto;
    width: 50%;
  }
}
</style>